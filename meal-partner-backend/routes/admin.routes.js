const express = require("express");
const pool = require("../db");

const router = express.Router();

async function ensureAdminRoleColumn() {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_status VARCHAR(20) DEFAULT 'approved'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_url TEXT DEFAULT ''");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_review_note TEXT DEFAULT ''");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_reviewed_at TIMESTAMP");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await pool.query("UPDATE users SET role = 'admin' WHERE account = 'admin'");
  await pool.query("UPDATE users SET verify_status = 'approved' WHERE verify_status IS NULL OR account = 'admin'");
}


const SEED_RESTAURANTS = [
  ["校門口便當", "便當", "$", "10:30-20:00", "校門口周邊商圈", "出餐快、適合午餐、價格親民"],
  ["學餐二樓簡餐", "簡餐", "$", "11:00-19:30", "校內學餐二樓", "距離近、座位多、適合下課聚餐"],
  ["吳興街牛肉麵", "麵食", "$$", "11:00-21:00", "吳興街周邊", "份量足、熱食、適合晚餐"],
  ["信義咖哩屋", "咖哩", "$$", "11:30-20:30", "信義區校園周邊", "咖哩口味濃、適合小團體"],
  ["和平東路水餃館", "麵食", "$", "10:30-20:30", "和平東路周邊", "水餃與湯品、價格穩定"],
  ["校園早午餐", "早午餐", "$$", "07:00-14:00", "校園周邊巷弄", "早餐、蛋餅、吐司，適合早八前"],
  ["學生滷味店", "滷味", "$", "16:00-23:00", "夜市/商圈周邊", "可客製、適合宵夜"],
  ["日式丼飯小屋", "日式", "$$", "11:00-21:00", "校園附近商店街", "丼飯、炸物、適合晚餐"],
  ["韓式飯捲店", "韓式", "$$", "11:00-20:00", "校園周邊巷口", "飯捲、泡菜鍋，適合少人聚餐"],
  ["健康沙拉餐盒", "健康餐", "$$", "10:30-19:30", "校園周邊商圈", "低油、蔬菜多、適合健身族"],
  ["義大利麵小館", "義式", "$$$", "11:30-21:00", "校園附近主要道路", "氣氛較好，適合慢慢聊天"],
  ["平價火鍋店", "火鍋", "$$$", "11:00-22:00", "校園周邊商圈", "適合多人、晚餐聚會"],
  ["炸雞漢堡店", "速食", "$$", "10:00-22:00", "校門口附近", "快速、好分食、適合臨時約飯"],
  ["巷弄咖啡館", "咖啡廳", "$$", "09:00-18:00", "校園周邊巷弄", "安靜、可討論作業、適合下午"],
  ["自助餐小站", "自助餐", "$", "10:30-20:00", "校園周邊便當街", "菜色多、價格彈性、適合日常用餐"],
];

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

async function getReportWarningTarget(reportId) {
  const result = await pool.query(
    `
    SELECT
      rp.id,
      rp.target_type,
      rp.target_id,
      rp.party_id,
      rp.reason,
      rp.description,
      party_target.id AS target_party_id,
      party_target.title AS target_party_title,
      party_target.host_id AS target_party_host_id,
      user_target.id AS target_user_id,
      user_target.name AS target_user_name,
      chat_target.id AS target_chat_id,
      chat_target.user_id AS chat_sender_id,
      chat_target.party_id AS chat_party_id,
      chat_party.title AS chat_party_title
    FROM reports rp
    LEFT JOIN parties party_target
      ON rp.target_type = 'party' AND party_target.id = rp.target_id
    LEFT JOIN users user_target
      ON rp.target_type = 'user' AND user_target.id = rp.target_id
    LEFT JOIN chat_messages chat_target
      ON rp.target_type = 'chat' AND chat_target.id = rp.target_id
    LEFT JOIN parties chat_party
      ON chat_party.id = COALESCE(rp.party_id, chat_target.party_id)
    WHERE rp.id = $1
    `,
    [reportId]
  );

  const report = result.rows[0];
  if (!report) return null;

  const warningReason = report.reason || "未填寫";
  const commonWarningText = `你因不良行為受到使用者檢舉警告。若多次再犯，帳號可能會被停權。警告原因：${warningReason}`;

  if (report.target_type === "party" && report.target_party_host_id) {
    return {
      userId: report.target_party_host_id,
      partyId: report.target_party_id,
      title: "飯局檢舉警告",
      message: `${commonWarningText}。相關飯局：${report.target_party_title || "未命名飯局"}。請留意飯局內容、說明與互動規範。`,
    };
  }

  if (report.target_type === "user" && report.target_user_id) {
    return {
      userId: report.target_user_id,
      partyId: report.party_id || null,
      title: "使用者檢舉警告",
      message: `${commonWarningText}。請留意與其他使用者互動時的禮貌、準時與平台規範。`,
    };
  }

  if (report.target_type === "chat" && report.chat_sender_id) {
    return {
      userId: report.chat_sender_id,
      partyId: report.chat_party_id || report.party_id || null,
      title: "聊天室檢舉警告",
      message: `${commonWarningText}。相關飯局：${report.chat_party_title || "聊天室"}。請留意聊天室發言內容與平台規範。`,
    };
  }

  return null;
}

async function createReportWarningNotification(reportId) {
  await ensureNotificationsTable();

  const target = await getReportWarningTarget(reportId);
  if (!target?.userId) return null;

  const result = await pool.query(
    `
    INSERT INTO notifications (user_id, type, title, message, party_id)
    VALUES ($1, 'report_warning', $2, $3, $4)
    RETURNING id, user_id, type, title, message, party_id, created_at
    `,
    [target.userId, target.title, target.message, target.partyId || null]
  );

  return result.rows[0] || null;
}

async function ensureRestaurantsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      category VARCHAR(50) NOT NULL,
      price_level VARCHAR(10) NOT NULL DEFAULT '$',
      opening_hours VARCHAR(100) NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      feature TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query("ALTER TABLE parties ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL");

  for (const item of SEED_RESTAURANTS) {
    await pool.query(
      `
      INSERT INTO restaurants (name, category, price_level, opening_hours, address, feature)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (name) DO NOTHING
      `,
      item
    );
  }
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

    await ensureRestaurantsTable();

    await ensureReportsTable();

    const [users, parties, messages, ratings, restaurants, pendingReports, pendingVerifications, cancelled, ended] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM parties"),
      pool.query("SELECT COUNT(*)::int AS count FROM chat_messages"),
      pool.query("SELECT COUNT(*)::int AS count FROM ratings"),
      pool.query("SELECT COUNT(*)::int AS count FROM restaurants"),
      pool.query("SELECT COUNT(*)::int AS count FROM reports WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE verify_status = 'pending'"),
      pool.query("SELECT COUNT(*)::int AS count FROM parties WHERE status = 'cancelled'"),
      pool.query("SELECT COUNT(*)::int AS count FROM parties WHERE status = 'ended'"),
    ]);

    res.json({
      summary: {
        users: users.rows[0].count,
        parties: parties.rows[0].count,
        messages: messages.rows[0].count,
        ratings: ratings.rows[0].count,
        restaurants: restaurants.rows[0].count,
        pendingReports: pendingReports.rows[0].count,
        pendingVerifications: pendingVerifications.rows[0].count,
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
        COALESCE(u.verify_status, 'approved') AS verify_status,
        COALESCE(u.student_card_url, '') AS student_card_url,
        COALESCE(u.student_card_review_note, '') AS student_card_review_note,
        u.student_card_reviewed_at,
        reviewer.name AS student_card_reviewed_by_name,
        u.created_at,
        COUNT(DISTINCT p.id)::int AS hosted_count,
        COUNT(DISTINCT pm.party_id)::int AS joined_count,
        COUNT(DISTINCT r.id)::int AS received_rating_count,
        ROUND(AVG(r.score)::numeric, 2) AS average_rating
      FROM users u
      LEFT JOIN parties p ON p.host_id = u.id
      LEFT JOIN party_members pm ON pm.user_id = u.id
      LEFT JOIN ratings r ON r.to_user_id = u.id
      LEFT JOIN users reviewer ON reviewer.id = u.student_card_reviewed_by
      GROUP BY u.id, reviewer.name
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
        p.restaurant_id,
        r.name AS restaurant_name,
        r.category AS restaurant_category,
        r.price_level AS restaurant_price_level,
        r.opening_hours AS restaurant_opening_hours,
        r.address AS restaurant_address,
        r.feature AS restaurant_feature,
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
      LEFT JOIN restaurants r ON r.id = p.restaurant_id
      JOIN users u ON p.host_id = u.id
      LEFT JOIN party_members pm ON pm.party_id = p.id
      GROUP BY p.id, u.id, r.id
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
 * 管理員審核學生證
 * PUT /api/admin/users/:id/verification
 */
router.put("/users/:id/verification", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureAdminRoleColumn();

    const { id } = req.params;
    const { status, note = "" } = req.body;
    const allowedStatuses = new Set(["pending", "approved", "rejected"]);

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "審核狀態不正確" });
    }

    const targetResult = await pool.query(
      "SELECT id, account, role FROM users WHERE id = $1",
      [id]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    const targetUser = targetResult.rows[0];

    if (targetUser.role === "admin" || targetUser.account === "admin") {
      return res.status(400).json({ message: "管理員帳號不需要學生證審核" });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET verify_status = $1,
          student_card_review_note = $2,
          student_card_reviewed_at = CURRENT_TIMESTAMP,
          student_card_reviewed_by = $3
      WHERE id = $4
      RETURNING id, account, name, student_id, department, avatar, bio, role,
                verify_status, student_card_url, student_card_review_note,
                student_card_reviewed_at, created_at
      `,
      [status, String(note || "").trim(), admin.id, id]
    );

    res.json({
      message: status === "approved" ? "學生證審核已通過" : status === "rejected" ? "學生證審核已退回" : "學生證審核狀態已改為待審",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("更新學生證審核狀態失敗：", error);
    res.status(500).json({ message: "更新學生證審核狀態失敗", error: error.message });
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



/**
 * 餐廳列表
 * GET /api/admin/restaurants?userId=1
 */
router.get("/restaurants", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureRestaurantsTable();

    const result = await pool.query(`
      SELECT
        r.id,
        r.name,
        r.category,
        r.price_level,
        r.opening_hours,
        r.address,
        r.feature,
        r.created_at,
        COUNT(p.id)::int AS party_count
      FROM restaurants r
      LEFT JOIN parties p ON p.restaurant_id = r.id
      GROUP BY r.id
      ORDER BY r.id ASC
    `);

    res.json({ restaurants: result.rows });
  } catch (error) {
    console.error("取得後台餐廳失敗：", error);
    res.status(500).json({ message: "取得後台餐廳失敗", error: error.message });
  }
});

/**
 * 新增餐廳
 * POST /api/admin/restaurants
 */
router.post("/restaurants", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureRestaurantsTable();

    const { name, category, priceLevel, openingHours, address, feature } = req.body;

    if (!name || !category || !priceLevel || !openingHours || !address) {
      return res.status(400).json({ message: "請完整填寫餐廳名稱、類型、價格、營業時間與地址" });
    }

    const result = await pool.query(
      `
      INSERT INTO restaurants (name, category, price_level, opening_hours, address, feature)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [name.trim(), category.trim(), priceLevel.trim(), openingHours.trim(), address.trim(), String(feature || "").trim()]
    );

    res.status(201).json({ message: "餐廳新增成功", restaurant: result.rows[0] });
  } catch (error) {
    console.error("新增餐廳失敗：", error);
    res.status(500).json({ message: error.code === "23505" ? "餐廳名稱已存在" : "新增餐廳失敗", error: error.message });
  }
});

/**
 * 編輯餐廳
 * PUT /api/admin/restaurants/:id
 */
router.put("/restaurants/:id", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureRestaurantsTable();

    const { id } = req.params;
    const { name, category, priceLevel, openingHours, address, feature } = req.body;

    if (!name || !category || !priceLevel || !openingHours || !address) {
      return res.status(400).json({ message: "請完整填寫餐廳名稱、類型、價格、營業時間與地址" });
    }

    const result = await pool.query(
      `
      UPDATE restaurants
      SET name = $1,
          category = $2,
          price_level = $3,
          opening_hours = $4,
          address = $5,
          feature = $6
      WHERE id = $7
      RETURNING *
      `,
      [name.trim(), category.trim(), priceLevel.trim(), openingHours.trim(), address.trim(), String(feature || "").trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到餐廳" });
    }

    await pool.query("UPDATE parties SET store = $1 WHERE restaurant_id = $2", [result.rows[0].name, id]);

    res.json({ message: "餐廳更新成功", restaurant: result.rows[0] });
  } catch (error) {
    console.error("更新餐廳失敗：", error);
    res.status(500).json({ message: error.code === "23505" ? "餐廳名稱已存在" : "更新餐廳失敗", error: error.message });
  }
});

/**
 * 刪除餐廳
 * DELETE /api/admin/restaurants/:id
 */
router.delete("/restaurants/:id", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureRestaurantsTable();

    const { id } = req.params;

    const used = await pool.query("SELECT COUNT(*)::int AS count FROM parties WHERE restaurant_id = $1", [id]);
    if (Number(used.rows[0].count) > 0) {
      return res.status(400).json({ message: "此餐廳已有飯局使用，請先刪除或修改相關飯局後再刪除" });
    }

    const result = await pool.query("DELETE FROM restaurants WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到餐廳" });
    }

    res.json({ message: "餐廳已刪除" });
  } catch (error) {
    console.error("刪除餐廳失敗：", error);
    res.status(500).json({ message: "刪除餐廳失敗", error: error.message });
  }
});


/**
 * 檢舉列表
 * GET /api/admin/reports?userId=1
 */
router.get("/reports", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureReportsTable();

    const result = await pool.query(
      `
      SELECT
        rp.id,
        rp.reporter_id,
        reporter.name AS reporter_name,
        reporter.account AS reporter_account,
        rp.target_type,
        rp.target_id,
        rp.party_id,
        rp.reason,
        rp.description,
        rp.status,
        rp.admin_note,
        rp.handled_at,
        rp.created_at,
        handler.name AS handled_by_name,
        party_target.title AS target_party_title,
        user_target.name AS target_user_name,
        user_target.account AS target_user_account,
        chat_target.message AS target_chat_message,
        chat_party.title AS chat_party_title
      FROM reports rp
      JOIN users reporter ON reporter.id = rp.reporter_id
      LEFT JOIN users handler ON handler.id = rp.handled_by
      LEFT JOIN parties party_target ON rp.target_type = 'party' AND party_target.id = rp.target_id
      LEFT JOIN users user_target ON rp.target_type = 'user' AND user_target.id = rp.target_id
      LEFT JOIN chat_messages chat_target ON rp.target_type = 'chat' AND chat_target.id = rp.target_id
      LEFT JOIN parties chat_party ON chat_party.id = COALESCE(rp.party_id, chat_target.party_id)
      ORDER BY
        CASE WHEN rp.status = 'pending' THEN 0 ELSE 1 END,
        rp.created_at DESC,
        rp.id DESC
      LIMIT 100
      `
    );

    res.json({ reports: result.rows });
  } catch (error) {
    console.error("取得檢舉列表失敗：", error);
    res.status(500).json({ message: "取得檢舉列表失敗", error: error.message });
  }
});

/**
 * 更新檢舉處理狀態
 * PUT /api/admin/reports/:id/status
 */
router.put("/reports/:id/status", async (req, res) => {
  try {
    const admin = await assertAdmin(req, res);
    if (!admin) return;

    await ensureReportsTable();

    const { id } = req.params;
    const { status, adminNote = "" } = req.body;
    const allowed = new Set(["pending", "resolved", "rejected"]);

    if (!allowed.has(status)) {
      return res.status(400).json({ message: "檢舉狀態不正確" });
    }

    const result = await pool.query(
      `
      UPDATE reports
      SET status = $1::varchar,
          admin_note = $2::text,
          handled_by = CASE WHEN $1::varchar = 'pending' THEN NULL ELSE $3::int END,
          handled_at = CASE WHEN $1::varchar = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END
      WHERE id = $4::int
      RETURNING *
      `,
      [status, String(adminNote || "").trim(), admin.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "找不到檢舉資料" });
    }

    let warningNotification = null;
    if (status === "resolved") {
      warningNotification = await createReportWarningNotification(id);
    }

    res.json({
      message: status === "resolved" && warningNotification
        ? "檢舉狀態已更新，並已發送警告通知"
        : "檢舉狀態已更新",
      report: result.rows[0],
      warningNotification,
    });
  } catch (error) {
    console.error("更新檢舉狀態失敗：", error);
    res.status(500).json({ message: "更新檢舉狀態失敗", error: error.message });
  }
});

module.exports = router;
