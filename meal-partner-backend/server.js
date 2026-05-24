//-------------------------- 1. 匯入套件--------------------------- 
//資料庫套件
const fs = require("fs");
const path = require("path");
//伺服器套件
const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

// --------------------------2. 建立 app---------------------------
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const partyRoutes = require("./routes/party.routes");
const chatRoutes = require("./routes/chat.routes");
const notificationRoutes = require("./routes/notification.routes");
const ratingRoutes = require("./routes/rating.routes");
const uploadRoutes = require("./routes/upload.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const adminRoutes = require("./routes/admin.routes");
const reportRoutes = require("./routes/report.routes");

const app = express();
const PORT = process.env.PORT || 3000;
//-------------------------- 3. middleware---------------------------
app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/uploads", uploadRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/chats", chatRoutes);

//-------------------------- 4. API routes---------------------------
app.get("/", (req, res) => {
  res.json({
    message: "飯搭子後端伺服器運作中",
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");

    res.json({
      message: "PostgreSQL 連線成功",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("PostgreSQL 連線失敗：", error);

    res.status(500).json({
      message: "PostgreSQL 連線失敗",
      error: error.message,
    });
  }
});

// 自動初始化資料庫：後端啟動時會先讀取 schema.sql，補齊資料表、欄位、索引與預設資料。
async function initializeDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  await pool.query(schema);
  console.log("資料庫初始化完成");
}

// 保留手動初始化 API，平常不需要使用；只有資料庫異常或展示前想手動補救時才使用。
app.get("/api/init-db", async (req, res) => {
  try {
    await initializeDatabase();

    res.json({
      message: "資料表建立成功",
    });
  } catch (error) {
    console.error("資料表建立失敗：", error);

    res.status(500).json({
      message: "資料表建立失敗",
      error: error.message,
    });
  }
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("後端啟動失敗，資料庫初始化未完成：", error);
    process.exit(1);
  }
}

//--------------------------- 5. 最後才啟動 server---------------------------
startServer();

