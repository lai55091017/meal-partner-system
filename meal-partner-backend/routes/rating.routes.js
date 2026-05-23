const express = require("express");
const pool = require("../db");

const router = express.Router();

async function ensureRatingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(party_id, from_user_id, to_user_id)
    )
  `);
}

ensureRatingsTable().catch((error) => {
  console.error("ratings 資料表建立失敗：", error);
});

/**
 * 檢查使用者是否已評價過某場飯局
 * GET /api/ratings/check?partyId=1&userId=2
 */
router.get("/check", async (req, res) => {
  try {
    const { partyId, userId } = req.query;

    if (!partyId || !userId) {
      return res.status(400).json({ message: "缺少 partyId 或 userId" });
    }

    const result = await pool.query(
      `
      SELECT id
      FROM ratings
      WHERE party_id = $1 AND from_user_id = $2
      LIMIT 1
      `,
      [partyId, userId]
    );

    res.json({ reviewed: result.rows.length > 0 });
  } catch (error) {
    console.error("檢查評價狀態失敗：", error);
    res.status(500).json({ message: "檢查評價狀態失敗", error: error.message });
  }
});

/**
 * 取得使用者收到的評價紀錄
 * GET /api/ratings/received/:userId
 */
router.get("/received/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.party_id,
        p.title AS party_name,
        r.from_user_id AS reviewer_id,
        reviewer.name AS reviewer_name,
        reviewer.account AS reviewer_account,
        r.to_user_id AS target_id,
        target.name AS target_name,
        target.account AS target_account,
        r.score,
        r.comment,
        r.created_at
      FROM ratings r
      JOIN parties p ON r.party_id = p.id
      JOIN users reviewer ON r.from_user_id = reviewer.id
      JOIN users target ON r.to_user_id = target.id
      WHERE r.to_user_id = $1
      ORDER BY r.created_at DESC
      `,
      [userId]
    );

    res.json({ ratings: result.rows });
  } catch (error) {
    console.error("取得評價紀錄失敗：", error);
    res.status(500).json({ message: "取得評價紀錄失敗", error: error.message });
  }
});

/**
 * 取得使用者平均評分
 * GET /api/ratings/summary/:userId
 */
router.get("/summary/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS count,
        ROUND(AVG(score)::numeric, 2) AS average
      FROM ratings
      WHERE to_user_id = $1
      `,
      [userId]
    );

    const row = result.rows[0];

    res.json({
      summary: {
        count: Number(row.count || 0),
        average: row.average === null ? null : Number(row.average),
      },
    });
  } catch (error) {
    console.error("取得平均評分失敗：", error);
    res.status(500).json({ message: "取得平均評分失敗", error: error.message });
  }
});

/**
 * 送出評價
 * POST /api/ratings
 * body: { partyId, reviewerId, ratings: [{ targetId, score, comment }] }
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { partyId, reviewerId, ratings = [] } = req.body;

    if (!partyId || !reviewerId) {
      return res.status(400).json({ message: "缺少飯局 id 或評價者 id" });
    }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({ message: "請至少評價一位成員" });
    }

    await client.query("BEGIN");

    const reviewerUser = await getUserForRegularAction(client, reviewerId);
    if (!reviewerUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到評價者" });
    }

    if (isAdminUserRow(reviewerUser)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能送出一般使用者評價" });
    }

    const partyResult = await client.query(
      `
      SELECT id, status
      FROM parties
      WHERE id = $1
      `,
      [partyId]
    );

    if (partyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到飯局" });
    }

    if (partyResult.rows[0].status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "已取消的飯局不能評價" });
    }

    const reviewerMember = await client.query(
      `
      SELECT user_id
      FROM party_members
      WHERE party_id = $1 AND user_id = $2
      `,
      [partyId, reviewerId]
    );

    if (reviewerMember.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "只有飯局成員可以送出評價" });
    }

    const alreadyReviewed = await client.query(
      `
      SELECT id
      FROM ratings
      WHERE party_id = $1 AND from_user_id = $2
      LIMIT 1
      `,
      [partyId, reviewerId]
    );

    if (alreadyReviewed.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "你已經評價過這場飯局" });
    }

    const insertedRatings = [];

    for (const item of ratings) {
      const targetId = Number(item.targetId);
      const score = Number(item.score);
      const comment = String(item.comment || "").trim();

      if (!targetId || targetId === Number(reviewerId)) continue;

      if (!Number.isInteger(score) || score < 1 || score > 5) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "評分必須介於 1 到 5 顆星" });
      }

      const targetMember = await client.query(
        `
        SELECT user_id
        FROM party_members
        WHERE party_id = $1 AND user_id = $2
        `,
        [partyId, targetId]
      );

      if (targetMember.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "只能評價同一場飯局的成員" });
      }

      const insertResult = await client.query(
        `
        INSERT INTO ratings (party_id, from_user_id, to_user_id, score, comment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [partyId, reviewerId, targetId, score, comment]
      );

      insertedRatings.push(insertResult.rows[0]);
    }

    if (insertedRatings.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "沒有可儲存的評價對象" });
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "評價送出成功",
      ratings: insertedRatings,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(400).json({ message: "你已經評價過此成員" });
    }

    console.error("送出評價失敗：", error);
    res.status(500).json({ message: "送出評價失敗", error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
