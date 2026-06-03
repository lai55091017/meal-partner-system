const express = require("express");
const pool = require("../db");

const router = express.Router();

const MESSAGE_SELECT = `
  cm.id,
  cm.party_id,
  cm.user_id,
  cm.message,
  cm.is_recalled,
  cm.edited_at,
  cm.created_at,
  u.name AS sender_name,
  u.account AS sender_account
`;

async function getUserForRegularAction(userId) {
  const result = await pool.query(
    `
    SELECT id, account, role
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

function isAdminUserRow(user) {
  return user?.role === "admin" || user?.account === "admin";
}

let chatTableReady = false;

async function ensureChatTable() {
  if (chatTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_recalled BOOLEAN DEFAULT FALSE,
      edited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN DEFAULT FALSE");
  await pool.query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP");

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

async function fetchMessageWithSender(messageId, partyId) {
  const result = await pool.query(
    `
    SELECT ${MESSAGE_SELECT}
    FROM chat_messages cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.id = $1 AND cm.party_id = $2
    `,
    [messageId, partyId]
  );

  return result.rows[0] || null;
}

async function assertCanModifyMessage(partyId, userId, messageId) {
  const viewer = await getUserForRegularAction(userId);
  if (!viewer) {
    return { error: { status: 404, message: "找不到使用者" } };
  }

  if (isAdminUserRow(viewer)) {
    return { error: { status: 403, message: "管理員帳號為純後台模式，不能使用一般聊天室" } };
  }

  const party = await checkPartyMember(partyId, userId);
  if (!party) {
    return { error: { status: 403, message: "只有主辦人或已加入成員可以操作聊天室訊息" } };
  }

  const message = await fetchMessageWithSender(messageId, partyId);
  if (!message) {
    return { error: { status: 404, message: "找不到訊息" } };
  }

  if (Number(message.user_id) !== Number(userId)) {
    return { error: { status: 403, message: "只能編輯或收回自己傳送的訊息" } };
  }

  if (message.is_recalled) {
    return { error: { status: 400, message: "此訊息已收回，無法再編輯" } };
  }

  return { party, message };
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

    const viewer = await getUserForRegularAction(userId);
    if (!viewer) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (isAdminUserRow(viewer)) {
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能使用一般聊天室" });
    }

    const party = await checkPartyMember(partyId, userId);

    if (!party) {
      return res.status(403).json({
        message: "只有主辦人或已加入成員可以查看聊天室",
      });
    }

    const result = await pool.query(
      `
      SELECT ${MESSAGE_SELECT}
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

    const sender = await getUserForRegularAction(userId);
    if (!sender) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (isAdminUserRow(sender)) {
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能傳送一般聊天室訊息" });
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
      RETURNING id
      `,
      [partyId, userId, String(message).trim()]
    );

    const messageRow = await fetchMessageWithSender(result.rows[0].id, partyId);

    res.status(201).json({
      message: messageRow,
    });
  } catch (error) {
    console.error("傳送聊天室訊息失敗：", error);

    res.status(500).json({
      message: "傳送聊天室訊息失敗",
      error: error.message,
    });
  }
});

/**
 * 收回訊息（保留資料，更新狀態）
 * PATCH /api/chats/:partyId/messages/:messageId/recall
 * body: { userId }
 */
router.patch("/:partyId/messages/:messageId/recall", async (req, res) => {
  try {
    await ensureChatTable();

    const { partyId, messageId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "缺少使用者 id" });
    }

    const check = await assertCanModifyMessage(partyId, userId, messageId);
    if (check.error) {
      return res.status(check.error.status).json({ message: check.error.message });
    }

    const result = await pool.query(
      `
      UPDATE chat_messages
      SET is_recalled = TRUE
      WHERE id = $1 AND party_id = $2 AND user_id = $3 AND is_recalled = FALSE
      RETURNING id
      `,
      [messageId, partyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "此訊息已收回或無法收回" });
    }

    const messageRow = await fetchMessageWithSender(messageId, partyId);

    res.json({
      message: "訊息已收回",
      chatMessage: messageRow,
    });
  } catch (error) {
    console.error("收回聊天室訊息失敗：", error);

    res.status(500).json({
      message: "收回聊天室訊息失敗",
      error: error.message,
    });
  }
});

/**
 * 編輯訊息
 * PATCH /api/chats/:partyId/messages/:messageId
 * body: { userId, message }
 */
router.patch("/:partyId/messages/:messageId", async (req, res) => {
  try {
    await ensureChatTable();

    const { partyId, messageId } = req.params;
    const { userId, message } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "缺少使用者 id" });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "訊息內容不能空白" });
    }

    const trimmedMessage = String(message).trim();
    if (trimmedMessage.length > 2000) {
      return res.status(400).json({ message: "訊息內容過長（最多 2000 字）" });
    }

    const check = await assertCanModifyMessage(partyId, userId, messageId);
    if (check.error) {
      return res.status(check.error.status).json({ message: check.error.message });
    }

    if (check.message.message === trimmedMessage) {
      const messageRow = await fetchMessageWithSender(messageId, partyId);
      return res.json({
        message: "訊息內容未變更",
        chatMessage: messageRow,
      });
    }

    const result = await pool.query(
      `
      UPDATE chat_messages
      SET message = $1,
          edited_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND party_id = $3 AND user_id = $4 AND is_recalled = FALSE
      RETURNING id
      `,
      [trimmedMessage, messageId, partyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "無法編輯此訊息" });
    }

    const messageRow = await fetchMessageWithSender(messageId, partyId);

    res.json({
      message: "訊息已更新",
      chatMessage: messageRow,
    });
  } catch (error) {
    console.error("編輯聊天室訊息失敗：", error);

    res.status(500).json({
      message: "編輯聊天室訊息失敗",
      error: error.message,
    });
  }
});

module.exports = router;
