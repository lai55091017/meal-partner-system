const express = require("express");
const pool = require("../db");

const router = express.Router();

const VALID_TARGET_TYPES = new Set(["party", "user", "chat"]);

async function ensureReportsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type VARCHAR(20) NOT NULL,
      target_id INTEGER NOT NULL,
      party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
      reason VARCHAR(100) NOT NULL,
      description TEXT DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_note TEXT DEFAULT '',
      handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      handled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 若舊版 reports 表已存在但缺少欄位，啟動或呼叫路由時自動補齊。
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type VARCHAR(20)");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id INTEGER");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason VARCHAR(100)");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT ''");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS handled_at TIMESTAMP");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_once_per_target
    ON reports (reporter_id, target_type, target_id, COALESCE(party_id, 0))
  `);
}

async function getUser(userId) {
  const result = await pool.query(
    "SELECT id, account, role FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

function isAdminUserRow(user) {
  return user?.role === "admin" || user?.account === "admin";
}

async function getParty(partyId) {
  if (!partyId) return null;

  const result = await pool.query(
    `
    SELECT id, host_id, title
    FROM parties
    WHERE id = $1
    `,
    [partyId]
  );

  return result.rows[0] || null;
}

async function getPartyMemberIds(partyId) {
  const result = await pool.query(
    `
    SELECT user_id
    FROM party_members
    WHERE party_id = $1
    `,
    [partyId]
  );

  return new Set(result.rows.map((row) => Number(row.user_id)));
}

async function getReporterPartyRole(reporterId, party) {
  if (!party) return "none";

  if (Number(party.host_id) === Number(reporterId)) {
    return "host";
  }

  const result = await pool.query(
    `
    SELECT user_id
    FROM party_members
    WHERE party_id = $1 AND user_id = $2
    LIMIT 1
    `,
    [party.id, reporterId]
  );

  return result.rows.length > 0 ? "member" : "outsider";
}

async function validatePartyReport({ reporterId, targetId, partyId }) {
  const normalizedPartyId = partyId || targetId;
  const party = await getParty(normalizedPartyId);

  if (!party || Number(party.id) !== Number(targetId)) {
    return { ok: false, status: 404, message: "找不到檢舉飯局" };
  }

  const reporterRole = await getReporterPartyRole(reporterId, party);

  if (reporterRole === "host") {
    return {
      ok: false,
      status: 400,
      message: "主辦人不能檢舉自己建立的飯局，請改由後台管理處理",
    };
  }

  // 外部使用者與一般參與者都可以檢舉飯局本身。
  return { ok: true, partyId: party.id };
}

async function validateUserReport({ reporterId, targetId, partyId }) {
  if (!partyId) {
    return { ok: false, status: 400, message: "檢舉飯局成員時需要指定飯局" };
  }

  if (Number(targetId) === Number(reporterId)) {
    return { ok: false, status: 400, message: "不能檢舉自己" };
  }

  const party = await getParty(partyId);
  if (!party) {
    return { ok: false, status: 404, message: "找不到檢舉所屬飯局" };
  }

  const reporterRole = await getReporterPartyRole(reporterId, party);
  if (reporterRole === "outsider" || reporterRole === "none") {
    return {
      ok: false,
      status: 403,
      message: "只有飯局內部成員可以檢舉主辦人或其他參與者",
    };
  }

  const memberIds = await getPartyMemberIds(party.id);
  if (!memberIds.has(Number(targetId))) {
    return {
      ok: false,
      status: 404,
      message: "找不到檢舉對象，或該使用者不是這場飯局的成員",
    };
  }

  return { ok: true, partyId: party.id };
}

async function validateChatReport({ reporterId, targetId, partyId }) {
  if (!partyId) {
    return { ok: false, status: 400, message: "檢舉聊天室訊息時需要指定飯局" };
  }

  const party = await getParty(partyId);
  if (!party) {
    return { ok: false, status: 404, message: "找不到聊天室所屬飯局" };
  }

  const reporterRole = await getReporterPartyRole(reporterId, party);
  if (reporterRole === "outsider" || reporterRole === "none") {
    return { ok: false, status: 403, message: "只有飯局成員可以檢舉聊天室訊息" };
  }

  const messageResult = await pool.query(
    `
    SELECT id, user_id, party_id
    FROM chat_messages
    WHERE id = $1 AND party_id = $2
    `,
    [targetId, party.id]
  );

  const message = messageResult.rows[0];
  if (!message) {
    return { ok: false, status: 404, message: "找不到檢舉的聊天室訊息" };
  }

  if (Number(message.user_id) === Number(reporterId)) {
    return { ok: false, status: 400, message: "不能檢舉自己傳送的訊息" };
  }

  return { ok: true, partyId: party.id };
}

async function validateReportTarget({ reporterId, targetType, targetId, partyId }) {
  if (targetType === "party") {
    return validatePartyReport({ reporterId, targetId, partyId });
  }

  if (targetType === "user") {
    return validateUserReport({ reporterId, targetId, partyId });
  }

  if (targetType === "chat") {
    return validateChatReport({ reporterId, targetId, partyId });
  }

  return { ok: false, status: 400, message: "檢舉類型不正確" };
}

/**
 * 送出檢舉
 * POST /api/reports
 * body: { userId, targetType, targetId, partyId, reason, description }
 */
router.post("/", async (req, res) => {
  try {
    await ensureReportsTable();

    const { userId, targetType, targetId, partyId = null, reason, description = "" } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "請先登入後再檢舉" });
    }

    const reporter = await getUser(userId);
    if (!reporter) {
      return res.status(404).json({ message: "找不到檢舉者" });
    }

    if (isAdminUserRow(reporter)) {
      return res.status(403).json({ message: "管理員帳號不能使用一般檢舉功能" });
    }

    if (!VALID_TARGET_TYPES.has(targetType)) {
      return res.status(400).json({ message: "檢舉類型不正確" });
    }

    if (!targetId) {
      return res.status(400).json({ message: "缺少檢舉對象" });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "請選擇檢舉原因" });
    }

    const validation = await validateReportTarget({
      reporterId: Number(userId),
      targetType,
      targetId: Number(targetId),
      partyId: partyId ? Number(partyId) : null,
    });

    if (!validation.ok) {
      return res.status(validation.status || 400).json({ message: validation.message || "檢舉對象不符合規則" });
    }

    const normalizedPartyId = validation.partyId || partyId || null;

    const existingReport = await pool.query(
      `
      SELECT id
      FROM reports
      WHERE reporter_id = $1
        AND target_type = $2
        AND target_id = $3
        AND COALESCE(party_id, 0) = COALESCE($4::int, 0)
      LIMIT 1
      `,
      [userId, targetType, targetId, normalizedPartyId]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ message: "你已經檢舉過這個對象，不能重複檢舉" });
    }

    const result = await pool.query(
      `
      INSERT INTO reports (reporter_id, target_type, target_id, party_id, reason, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [userId, targetType, targetId, normalizedPartyId, String(reason).trim(), String(description || "").trim()]
    );

    res.status(201).json({
      message: "檢舉已送出，管理員會進行審核",
      report: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ message: "你已經檢舉過這個對象，不能重複檢舉" });
    }

    console.error("送出檢舉失敗：", error);
    res.status(500).json({ message: "送出檢舉失敗", error: error.message });
  }
});

module.exports = router;
