const express = require("express");
const pool = require("../db");

const router = express.Router();

let chatTableReady = false;

async function ensureChatTable() {
  if (chatTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  chatTableReady = true;
}

async function checkPartyMember(partyId, userId) {
  const result = await pool.query(
    `
    SELECT p.id, p.title, p.status, p.host_id
    FROM parties p
    LEFT JOIN party_members pm
      ON pm.party_id = p.id AND pm.user_id = $2
    WHERE p.id = $1
      AND (p.host_id = $2 OR pm.user_id IS NOT NULL)
    `,
    [partyId, userId]
  );

  return result.rows[0] || null;
}

/**
 * 取得飯局聊天室訊息
 * GET /api/chats/:partyId/messages?userId=1
 */
router.get("/:partyId/messages", async (req, res) => {
  try {
    await ensureChatTable();

    const { partyId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "缺少使用者 id" });
    }

    const party = await checkPartyMember(partyId, userId);

    if (!party) {
      return res.status(403).json({
        message: "只有主辦人或已加入成員可以查看聊天室",
      });
    }

    const result = await pool.query(
      `
      SELECT
        cm.id,
        cm.party_id,
        cm.user_id,
        cm.message,
        cm.created_at,
        u.name AS sender_name,
        u.account AS sender_account
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.party_id = $1
      ORDER BY cm.created_at ASC, cm.id ASC
      `,
      [partyId]
    );

    res.json({
      party,
      messages: result.rows,
    });
  } catch (error) {
    console.error("取得聊天室訊息失敗：", error);

    res.status(500).json({
      message: "取得聊天室訊息失敗",
      error: error.message,
    });
  }
});

/**
 * 傳送飯局聊天室訊息
 * POST /api/chats/:partyId/messages
 */
router.post("/:partyId/messages", async (req, res) => {
  try {
    await ensureChatTable();

    const { partyId } = req.params;
    const { userId, message } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "缺少使用者 id" });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "訊息內容不能空白" });
    }

    const party = await checkPartyMember(partyId, userId);

    if (!party) {
      return res.status(403).json({
        message: "只有主辦人或已加入成員可以傳送訊息",
      });
    }

    if (party.status === "cancelled") {
      return res.status(400).json({ message: "已取消飯局不能傳送訊息" });
    }

    const result = await pool.query(
      `
      INSERT INTO chat_messages (party_id, user_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, party_id, user_id, message, created_at
      `,
      [partyId, userId, String(message).trim()]
    );

    const messageResult = await pool.query(
      `
      SELECT
        cm.id,
        cm.party_id,
        cm.user_id,
        cm.message,
        cm.created_at,
        u.name AS sender_name,
        u.account AS sender_account
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.id = $1
      `,
      [result.rows[0].id]
    );

    res.status(201).json({
      message: messageResult.rows[0],
    });
  } catch (error) {
    console.error("傳送聊天室訊息失敗：", error);

    res.status(500).json({
      message: "傳送聊天室訊息失敗",
      error: error.message,
    });
  }
});

module.exports = router;
