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
