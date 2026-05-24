const express = require("express");
const pool = require("../db");

const router = express.Router();

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


async function getUserForRestaurantCreate(userId) {
  if (!userId) return null;
  const result = await pool.query(
    "SELECT id, role FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

function normalizeRestaurantBody(body = {}) {
  return {
    name: String(body.name || "").trim(),
    category: String(body.category || "").trim(),
    priceLevel: String(body.priceLevel || body.price_level || "$"),
    openingHours: String(body.openingHours || body.opening_hours || "").trim(),
    address: String(body.address || "").trim(),
    feature: String(body.feature || "").trim(),
  };
}

router.get("/", async (req, res) => {
  try {
    await ensureRestaurantsTable();

    const result = await pool.query(`
      SELECT id, name, category, price_level, opening_hours, address, feature, created_at
      FROM restaurants
      ORDER BY category ASC, name ASC
    `);

    res.json({ restaurants: result.rows });
  } catch (error) {
    console.error("取得餐廳清單失敗：", error);
    res.status(500).json({ message: "取得餐廳清單失敗", error: error.message });
  }
});

/**
 * 一般使用者建立飯局時新增其他餐廳
 * POST /api/restaurants
 */
router.post("/", async (req, res) => {
  try {
    await ensureRestaurantsTable();

    const { userId } = req.body || {};
    const user = await getUserForRestaurantCreate(userId);

    if (!user) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "管理員帳號為純後台模式，不能用一般流程新增餐廳" });
    }

    const restaurant = normalizeRestaurantBody(req.body);

    if (!restaurant.name || !restaurant.category || !restaurant.openingHours || !restaurant.address) {
      return res.status(400).json({ message: "請完整填寫餐廳名稱、類型、營業時間與地址" });
    }

    const insertResult = await pool.query(
      `
      INSERT INTO restaurants (name, category, price_level, opening_hours, address, feature)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name, category, price_level, opening_hours, address, feature, created_at
      `,
      [
        restaurant.name,
        restaurant.category,
        restaurant.priceLevel || "$",
        restaurant.openingHours,
        restaurant.address,
        restaurant.feature || "",
      ]
    );

    if (insertResult.rows.length > 0) {
      return res.status(201).json({
        message: "餐廳新增成功",
        restaurant: insertResult.rows[0],
        created: true,
      });
    }

    const existingResult = await pool.query(
      `
      SELECT id, name, category, price_level, opening_hours, address, feature, created_at
      FROM restaurants
      WHERE name = $1
      `,
      [restaurant.name]
    );

    res.json({
      message: "餐廳已存在，改用既有餐廳資料",
      restaurant: existingResult.rows[0],
      created: false,
    });
  } catch (error) {
    console.error("新增餐廳失敗：", error);
    res.status(500).json({ message: "新增餐廳失敗", error: error.message });
  }
});

module.exports = router;
