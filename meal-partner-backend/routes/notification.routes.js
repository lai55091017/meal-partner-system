const express = require("express");
const pool = require("../db");

const router = express.Router();

async function ensureNotificationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL DEFAULT 'system',
      title VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function parsePartyStartTime(partyTime) {
  const text = String(partyTime || "").trim();
  const dateTimeMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})$/);

  if (dateTimeMatch) {
    const [, year, month, day, hour, minute] = dateTimeMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  }

  const todayMatch = text.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (todayMatch) {
    const time = new Date();
    time.setHours(Number(todayMatch[1]), Number(todayMatch[2]), 0, 0);
    return time;
  }

  return null;
}

async function createUpcomingPartyReminders(userId) {
  const partiesResult = await pool.query(
    `
    SELECT DISTINCT
      p.id,
      p.title,
      p.party_time
    FROM parties p
    LEFT JOIN party_members pm ON pm.party_id = p.id
    WHERE (p.host_id = $1 OR pm.user_id = $1)
      AND p.status = 'open'
    `,
    [userId]
  );

  const now = Date.now();
  const reminderWindowMs = 30 * 60 * 1000;

  for (const party of partiesResult.rows) {
    const startTime = parsePartyStartTime(party.party_time);
    if (!startTime) continue;

    const diff = startTime.getTime() - now;
    if (diff < 0 || diff > reminderWindowMs) continue;

    const existing = await pool.query(
      `
      SELECT id
      FROM notifications
      WHERE user_id = $1
        AND party_id = $2
        AND type = 'party_reminder'
      LIMIT 1
      `,
      [userId, party.id]
    );

    if (existing.rows.length > 0) continue;

    await pool.query(
      `
      INSERT INTO notifications (user_id, type, title, message, party_id)
      VALUES ($1, 'party_reminder', $2, $3, $4)
      `,
      [
        userId,
        "飯局即將開始",
        `你的飯局「${party.title}」將在 30 分鐘內開始，時間：${party.party_time}。`,
        party.id,
      ]
    );
  }
}

/**
 * 取得指定使用者通知
 * GET /api/notifications/:userId
 */
router.get("/:userId", async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { userId } = req.params;

    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    await createUpcomingPartyReminders(userId);

    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        type,
        title,
        message,
        party_id,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error("取得通知失敗：", error);
    res.status(500).json({
      message: "取得通知失敗",
      error: error.message,
    });
  }
});

/**
 * 新增通知
 * POST /api/notifications
 */
router.post("/", async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { userId, type = "system", title, message, partyId = null } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ message: "缺少通知使用者、標題或內容" });
    }

    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    const normalizedPartyId = partyId === "" || partyId === undefined ? null : partyId;

    const result = await pool.query(
      `
      INSERT INTO notifications (user_id, type, title, message, party_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, type, title, message, party_id, is_read, created_at
      `,
      [userId, type, title, message, normalizedPartyId]
    );

    res.status(201).json({
      message: "通知建立成功",
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("新增通知失敗：", error);
    res.status(500).json({
      message: "新增通知失敗",
      error: error.message,
    });
  }
});

/**
 * 將指定使用者所有通知標記為已讀
 * PUT /api/notifications/:userId/read
 */
router.put("/:userId/read", async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { userId } = req.params;

    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE
      RETURNING id
      `,
      [userId]
    );

    res.json({
      message: "通知已標記為已讀",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    console.error("標記通知已讀失敗：", error);
    res.status(500).json({
      message: "標記通知已讀失敗",
      error: error.message,
    });
  }
});

/**
 * 刪除通知
 * DELETE /api/notifications/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    await ensureNotificationsTable();

    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "缺少使用者 id" });
    }

    const result = await pool.query(
      `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到通知，或沒有刪除權限" });
    }

    res.json({ message: "通知已刪除" });
  } catch (error) {
    console.error("刪除通知失敗：", error);
    res.status(500).json({
      message: "刪除通知失敗",
      error: error.message,
    });
  }
});

module.exports = router;
