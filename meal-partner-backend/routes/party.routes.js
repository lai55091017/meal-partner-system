const express = require("express");
const pool = require("../db");

const router = express.Router();

let partyColumnsReady = false;

async function ensurePartyColumns() {
  if (partyColumnsReady) return;
  await pool.query("ALTER TABLE parties ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''");
  await pool.query("ALTER TABLE parties ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL");
  partyColumnsReady = true;
}

async function getUserForRegularAction(db, userId) {
  const result = await db.query(
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

function parsePartyTime(partyTime) {
  const text = String(partyTime || "");
  const match = text.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const time = new Date();
  time.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return time;
}

function isPartyTimeEnded(partyTime) {
  const partyDateTime = parsePartyTime(partyTime);
  return Boolean(partyDateTime && Date.now() >= partyDateTime.getTime());
}

function normalizePartyStatusForResponse(party) {
  if (!party) return party;
  if (party.status === "open" && isPartyTimeEnded(party.party_time)) {
    return { ...party, status: "ended" };
  }
  return party;
}

async function markPartyEndedIfTimePassed(client, party) {
  if (!party || party.status !== "open" || !isPartyTimeEnded(party.party_time)) {
    return party;
  }

  const result = await client.query(
    `
    UPDATE parties
    SET status = 'ended'
    WHERE id = $1 AND status = 'open'
    RETURNING *
    `,
    [party.id]
  );

  return result.rows[0] || { ...party, status: "ended" };
}

async function markExpiredOpenPartiesEnded() {
  const result = await pool.query(
    `
    SELECT id, party_time
    FROM parties
    WHERE status = 'open'
    `
  );

  const expiredIds = result.rows
    .filter((party) => isPartyTimeEnded(party.party_time))
    .map((party) => party.id);

  if (expiredIds.length > 0) {
    await pool.query(
      `
      UPDATE parties
      SET status = 'ended'
      WHERE id = ANY($1::int[]) AND status = 'open'
      `,
      [expiredIds]
    );
  }
}

function buildPartyFlowInfo(party) {
  const normalizedParty = normalizePartyStatusForResponse(party);
  const currentPeople = Number(normalizedParty.current_people || 0);
  const maxPeople = Number(normalizedParty.max_people || 0);
  const isEnded = normalizedParty.status === "ended";
  const isCancelled = normalizedParty.status === "cancelled";
  const isFull = !isEnded && !isCancelled && maxPeople > 0 && currentPeople >= maxPeople;

  return {
    ...normalizedParty,
    is_full: isFull,
    can_join: normalizedParty.status === "open" && !isFull,
  };
}

/**
 * 取得所有飯局
 * GET /api/parties?userId=1
 * userId 可選，用來判斷目前登入者是否已加入該飯局。
 */
router.get("/", async (req, res) => {
  try {
    await ensurePartyColumns();
    const userId = req.query.userId ? Number(req.query.userId) : null;

    await markExpiredOpenPartiesEnded();

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
        p.restaurant_id,
        r.name AS restaurant_name,
        r.category AS restaurant_category,
        r.price_level AS restaurant_price_level,
        r.opening_hours AS restaurant_opening_hours,
        r.address AS restaurant_address,
        r.feature AS restaurant_feature,
        p.status,
        p.created_at,
        u.id AS host_id,
        u.name AS host_name,
        u.account AS host_account,
        u.avatar AS host_avatar,
        COUNT(pm.user_id)::int AS current_people,
        EXISTS (
          SELECT 1
          FROM party_members pm2
          WHERE pm2.party_id = p.id
            AND ($1::int IS NOT NULL AND pm2.user_id = $1::int)
        ) AS is_current_user_member
      FROM parties p
      LEFT JOIN restaurants r ON r.id = p.restaurant_id
      JOIN users u ON p.host_id = u.id
      LEFT JOIN party_members pm ON p.id = pm.party_id
      GROUP BY p.id, u.id, r.id
      ORDER BY p.created_at DESC
      `,
      [Number.isFinite(userId) ? userId : null]
    );

    res.json({
      parties: result.rows.map(buildPartyFlowInfo),
    });
  } catch (error) {
    console.error("取得飯局失敗：", error);

    res.status(500).json({
      message: "取得飯局失敗",
      error: error.message,
    });
  }
});

/**
 * 取得單一飯局詳情
 * GET /api/parties/:id
 */
router.get("/:id", async (req, res) => {
  try {
    await ensurePartyColumns();
    const { id } = req.params;

    const partyResult = await pool.query(
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
        p.restaurant_id,
        r.name AS restaurant_name,
        r.category AS restaurant_category,
        r.price_level AS restaurant_price_level,
        r.opening_hours AS restaurant_opening_hours,
        r.address AS restaurant_address,
        r.feature AS restaurant_feature,
        p.status,
        p.created_at,
        u.id AS host_id,
        u.name AS host_name,
        u.account AS host_account,
        u.department AS host_department,
        u.bio AS host_bio,
        u.avatar AS host_avatar,
        COUNT(pm.user_id) AS current_people
      FROM parties p
      LEFT JOIN restaurants r ON r.id = p.restaurant_id
      JOIN users u ON p.host_id = u.id
      LEFT JOIN party_members pm ON p.id = pm.party_id
      WHERE p.id = $1
      GROUP BY p.id, u.id, r.id
      `,
      [id]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({
        message: "找不到飯局",
      });
    }

    const membersResult = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.account,
        u.department,
        u.avatar,
        pm.joined_at
      FROM party_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.party_id = $1
      ORDER BY pm.joined_at ASC
      `,
      [id]
    );

    const party = await markPartyEndedIfTimePassed(pool, partyResult.rows[0]);

    res.json({
      party: buildPartyFlowInfo(party),
      members: membersResult.rows,
    });
  } catch (error) {
    console.error("取得飯局詳情失敗：", error);

    res.status(500).json({
      message: "取得飯局詳情失敗",
      error: error.message,
    });
  }
});

/**
 * 建立飯局
 * POST /api/parties
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensurePartyColumns();
    const {
      title,
      hostId,
      store,
      restaurantId,
      mealType,
      partyTime,
      maxPeople,
      description,
      imageUrl,
    } = req.body;

    if (!title || !hostId || !restaurantId || !mealType || !partyTime || !maxPeople) {
      return res.status(400).json({
        message: "請完整填寫飯局名稱、主辦人、餐廳、餐期、時間與人數上限",
      });
    }

    if (Number(maxPeople) < 2) {
      return res.status(400).json({
        message: "人數上限至少需要 2 人",
      });
    }

    await client.query("BEGIN");

    const hostUser = await getUserForRegularAction(client, hostId);

    if (!hostUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "找不到主辦人",
      });
    }

    if (isAdminUserRow(hostUser)) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "管理員帳號為純後台模式，不能建立飯局",
      });
    }

    const restaurantResult = await client.query(
      `
      SELECT id, name
      FROM restaurants
      WHERE id = $1
      `,
      [restaurantId]
    );

    if (restaurantResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "找不到選擇的餐廳",
      });
    }

    const selectedRestaurant = restaurantResult.rows[0];

    const partyResult = await client.query(
      `
      INSERT INTO parties
      (title, host_id, store, restaurant_id, meal_type, party_time, max_people, description, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
      RETURNING *
      `,
      [
        title,
        hostId,
        selectedRestaurant.name,
        Number(restaurantId),
        mealType,
        partyTime,
        Number(maxPeople),
        description || "",
        imageUrl || "",
      ]
    );

    const party = partyResult.rows[0];

    await client.query(
      `
      INSERT INTO party_members (party_id, user_id)
      VALUES ($1, $2)
      `,
      [party.id, hostId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "飯局建立成功",
      party,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("建立飯局失敗：", error);

    res.status(500).json({
      message: "建立飯局失敗",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * 加入飯局
 * POST /api/parties/:id/join
 */
router.post("/:id/join", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "缺少使用者 id",
      });
    }

    await client.query("BEGIN");

    const joiningUser = await getUserForRegularAction(client, userId);
    if (!joiningUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (isAdminUserRow(joiningUser)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能加入飯局" });
    }


    // 先鎖定飯局資料，避免多人同時加入導致超過人數上限
    const partyResult = await client.query(
      `
      SELECT
        id,
        host_id,
        max_people,
        party_time,
        status
      FROM parties
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (partyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "找不到飯局",
      });
    }

    let party = partyResult.rows[0];
    party = await markPartyEndedIfTimePassed(client, party);

    // 再另外計算目前人數
    const countResult = await client.query(
      `
      SELECT COUNT(*) AS current_people
      FROM party_members
      WHERE party_id = $1
      `,
      [id]
    );

    const currentPeople = Number(countResult.rows[0].current_people);

    if (party.status !== "open") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: party.status === "ended" ? "此飯局已結束，無法加入" : "此飯局目前無法加入",
      });
    }

    if (Number(party.host_id) === Number(userId)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "你是主辦人，不需要重複加入",
      });
    }

    if (currentPeople >= Number(party.max_people)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "此飯局已額滿",
      });
    }

    await client.query(
      `
      INSERT INTO party_members (party_id, user_id)
      VALUES ($1, $2)
      `,
      [id, userId]
    );

    await client.query("COMMIT");

    res.json({
      message: "加入飯局成功",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(400).json({
        message: "你已經加入過此飯局",
      });
    }

    console.error("加入飯局失敗：", error);

    res.status(500).json({
      message: "加入飯局失敗",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * 退出飯局
 * POST /api/parties/:id/leave
 */
router.post("/:id/leave", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "缺少使用者 id",
      });
    }

    const leavingUser = await getUserForRegularAction(pool, userId);
    if (!leavingUser) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (isAdminUserRow(leavingUser)) {
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能退出飯局" });
    }

    const partyResult = await pool.query(
      `
      SELECT id, host_id, status, party_time
      FROM parties
      WHERE id = $1
      `,
      [id]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({
        message: "找不到飯局",
      });
    }

    let party = partyResult.rows[0];
    party = await markPartyEndedIfTimePassed(pool, party);

    if (party.status === "cancelled") {
      return res.status(400).json({
        message: "此飯局已取消，不能退出",
      });
    }

    if (party.status === "ended") {
      return res.status(400).json({
        message: "此飯局已結束，不能退出",
      });
    }

    if (Number(party.host_id) === Number(userId)) {
      return res.status(400).json({
        message: "主辦人不能退出自己的飯局，請使用取消飯局",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM party_members
      WHERE party_id = $1 AND user_id = $2
      RETURNING *
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "你尚未加入此飯局",
      });
    }

    res.json({
      message: "退出飯局成功",
    });
  } catch (error) {
    console.error("退出飯局失敗：", error);

    res.status(500).json({
      message: "退出飯局失敗",
      error: error.message,
    });
  }
});


/**
 * 取消飯局
 * POST /api/parties/:id/cancel
 */
router.post("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "缺少使用者 id",
      });
    }

    const cancelUser = await getUserForRegularAction(pool, userId);
    if (!cancelUser) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (isAdminUserRow(cancelUser)) {
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能使用一般取消飯局功能，請使用後台管理操作" });
    }

    const partyResult = await pool.query(
      `
      SELECT id, host_id, status, party_time
      FROM parties
      WHERE id = $1
      `,
      [id]
    );

    if (partyResult.rows.length === 0) {
      return res.status(404).json({
        message: "找不到飯局",
      });
    }

    let party = partyResult.rows[0];
    party = await markPartyEndedIfTimePassed(pool, party);

    if (Number(party.host_id) !== Number(userId)) {
      return res.status(403).json({
        message: "只有主辦人可以取消飯局",
      });
    }

    if (party.status === "cancelled") {
      return res.status(400).json({
        message: "此飯局已經取消",
      });
    }

    if (party.status === "ended") {
      return res.status(400).json({
        message: "此飯局已結束，不能取消"
      });
    }

    const result = await pool.query(
      `
      UPDATE parties
      SET status = 'cancelled'
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    res.json({
      message: "飯局已取消",
      party: result.rows[0],
    });
  } catch (error) {
    console.error("取消飯局失敗：", error);

    res.status(500).json({
      message: "取消飯局失敗",
      error: error.message,
    });
  }
});

/**
 * 真正刪除飯局
 * DELETE /api/parties/:id
 * 只有主辦人可以刪除。刪除時會同步清除成員、聊天室、評價，通知則保留但解除 party_id。
 */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "缺少使用者 id" });
    }

    await client.query("BEGIN");

    const deleteUser = await getUserForRegularAction(client, userId);
    if (!deleteUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (isAdminUserRow(deleteUser)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能使用一般刪除飯局功能，請使用後台管理操作" });
    }


    const partyResult = await client.query(
      `
      SELECT id, host_id, status, party_time
      FROM parties
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (partyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到飯局" });
    }

    let party = partyResult.rows[0];
    party = await markPartyEndedIfTimePassed(client, party);

    if (Number(party.host_id) !== Number(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "只有主辦人可以刪除飯局" });
    }

    if (!["cancelled", "ended"].includes(party.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "只有已取消或已結束的飯局可以刪除記錄" });
    }

    await client.query("DELETE FROM chat_messages WHERE party_id = $1", [id]);
    await client.query("DELETE FROM ratings WHERE party_id = $1", [id]);
    await client.query("DELETE FROM party_members WHERE party_id = $1", [id]);
    await client.query("UPDATE notifications SET party_id = NULL WHERE party_id = $1", [id]);
    await client.query("DELETE FROM parties WHERE id = $1", [id]);

    await client.query("COMMIT");

    res.json({ message: "飯局已從資料庫刪除" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("刪除飯局失敗：", error);
    res.status(500).json({ message: "刪除飯局失敗", error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;