const express = require("express");
const pool = require("../db");

const router = express.Router();

async function ensureAdminRoleColumn() {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'");
  await pool.query("UPDATE users SET role = 'admin' WHERE account = 'admin'");
}

async function requireAdmin(userId) {
  await ensureAdminRoleColumn();

  if (!userId) return null;

  const result = await pool.query(
    `
    SELECT id, account, name, role
    FROM users
    WHERE id = $1
      AND (role = 'admin' OR account = 'admin')
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function assertAdmin(req, res) {
  const userId = req.query.userId || req.body.userId;
  const admin = await requireAdmin(userId);

  if (!admin) {
    res.status(403).json({ message: "只有管理員可以使用後台功能" });
    return null;
  }

  return admin;
}

/**
 * 後台統計
 * GET /api/admin/summary?userId=1
 */
router.get("/summary", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const [users, parties, messages, ratings, cancelled, ended] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM parties"),
      pool.query("SELECT COUNT(*)::int AS count FROM chat_messages"),
      pool.query("SELECT COUNT(*)::int AS count FROM ratings"),
      pool.query("SELECT COUNT(*)::int AS count FROM parties WHERE status = 'cancelled'"),
      pool.query("SELECT COUNT(*)::int AS count FROM parties WHERE status = 'ended'"),
    ]);

    res.json({
      summary: {
        users: users.rows[0].count,
        parties: parties.rows[0].count,
        messages: messages.rows[0].count,
        ratings: ratings.rows[0].count,
        cancelledParties: cancelled.rows[0].count,
        endedParties: ended.rows[0].count,
      },
    });
  } catch (error) {
    console.error("取得後台統計失敗：", error);
    res.status(500).json({ message: "取得後台統計失敗", error: error.message });
  }
});

/**
 * 使用者列表
 * GET /api/admin/users?userId=1
 */
router.get("/users", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.account,
        u.name,
        u.student_id,
        u.department,
        u.avatar,
        u.bio,
        COALESCE(u.role, 'user') AS role,
        u.created_at,
        COUNT(DISTINCT p.id)::int AS hosted_count,
        COUNT(DISTINCT pm.party_id)::int AS joined_count,
        COUNT(DISTINCT r.id)::int AS received_rating_count,
        ROUND(AVG(r.score)::numeric, 2) AS average_rating
      FROM users u
      LEFT JOIN parties p ON p.host_id = u.id
      LEFT JOIN party_members pm ON pm.user_id = u.id
      LEFT JOIN ratings r ON r.to_user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC, u.id DESC
      `
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error("取得後台使用者失敗：", error);
    res.status(500).json({ message: "取得後台使用者失敗", error: error.message });
  }
});

/**
 * 飯局列表
 * GET /api/admin/parties?userId=1
 */
router.get("/parties", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.title,
        p.store,
        p.meal_type,
        p.party_time,
        p.max_people,
        p.description,
        p.image_url,
        p.status,
        p.created_at,
        u.id AS host_id,
        u.name AS host_name,
        u.account AS host_account,
        COUNT(pm.user_id)::int AS current_people
      FROM parties p
      JOIN users u ON p.host_id = u.id
      LEFT JOIN party_members pm ON pm.party_id = p.id
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC, p.id DESC
      `
    );

    res.json({ parties: result.rows });
  } catch (error) {
    console.error("取得後台飯局失敗：", error);
    res.status(500).json({ message: "取得後台飯局失敗", error: error.message });
  }
});

/**
 * 聊天訊息列表
 * GET /api/admin/chats?userId=1
 */
router.get("/chats", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const result = await pool.query(
      `
      SELECT
        cm.id,
        cm.party_id,
        p.title AS party_title,
        cm.user_id,
        u.name AS sender_name,
        u.account AS sender_account,
        cm.message,
        cm.created_at
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      JOIN parties p ON cm.party_id = p.id
      ORDER BY cm.created_at DESC, cm.id DESC
      LIMIT 100
      `
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error("取得後台聊天室訊息失敗：", error);
    res.status(500).json({ message: "取得後台聊天室訊息失敗", error: error.message });
  }
});

/**
 * 管理員取消飯局
 * POST /api/admin/parties/:id/cancel
 */
router.post("/parties/:id/cancel", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE parties
      SET status = 'cancelled'
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到飯局" });
    }

    res.json({ message: "飯局已由管理員取消", party: result.rows[0] });
  } catch (error) {
    console.error("管理員取消飯局失敗：", error);
    res.status(500).json({ message: "管理員取消飯局失敗", error: error.message });
  }
});

/**
 * 管理員刪除飯局
 * DELETE /api/admin/parties/:id
 */
router.delete("/parties/:id", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM parties
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到飯局" });
    }

    res.json({ message: "飯局已刪除" });
  } catch (error) {
    console.error("管理員刪除飯局失敗：", error);
    res.status(500).json({ message: "管理員刪除飯局失敗", error: error.message });
  }
});

/**
 * 管理員刪除使用者
 * DELETE /api/admin/users/:id
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const { id } = req.params;

    if (Number(id) === Number(admin.id)) {
      return res.status(400).json({ message: "管理員不能刪除自己的帳號" });
    }

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, account, name
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    res.json({ message: "使用者已刪除", user: result.rows[0] });
  } catch (error) {
    console.error("管理員刪除使用者失敗：", error);
    res.status(500).json({ message: "管理員刪除使用者失敗", error: error.message });
  }
});

/**
 * 管理員刪除聊天室訊息
 * DELETE /api/admin/chats/:id
 */
router.delete("/chats/:id", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM chat_messages
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到聊天室訊息" });
    }

    res.json({ message: "聊天室訊息已刪除" });
  } catch (error) {
    console.error("管理員刪除聊天室訊息失敗：", error);
    res.status(500).json({ message: "管理員刪除聊天室訊息失敗", error: error.message });
  }
});

module.exports = router;
