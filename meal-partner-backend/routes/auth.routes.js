const express = require("express");
const pool = require("../db");
//密碼加密套件
const bcrypt = require("bcryptjs");

const router = express.Router();

async function ensureUserColumns() {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_status VARCHAR(20) DEFAULT 'approved'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_url TEXT DEFAULT ''");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_review_note TEXT DEFAULT ''");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_reviewed_at TIMESTAMP");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_card_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
    await pool.query("UPDATE users SET role = 'admin' WHERE account = 'admin'");
    await pool.query("UPDATE users SET verify_status = 'approved' WHERE verify_status IS NULL OR account = 'admin'");
}
//註冊 API
router.post("/register", async (req, res) => {
    try {
        await ensureUserColumns();
        const { account, password, name, studentCardUrl } = req.body;

        if (!account || !password || !name) {
            return res.status(400).json({
                message: "請輸入帳號、密碼與姓名",
            });
        }

        if (!studentCardUrl) {
            return res.status(400).json({
                message: "請上傳學生證照片，等待管理員審核後才能登入",
            });
        }

        if (password.length < 4) {
            return res.status(400).json({
                message: "密碼至少需要 4 個字元",
            });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE account = $1",
            [account]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                message: "此帳號已被註冊",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
      INSERT INTO users (account, password, name, student_id, student_card_url, verify_status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, account, name, student_id, department, avatar, bio, role, verify_status, student_card_url, created_at
      `,
            [account, hashedPassword, name, account, studentCardUrl]
        );

        res.status(201).json({
            message: "註冊申請已送出，請等待管理員審核學生證",
            user: result.rows[0],
        });
    } catch (error) {
        console.error("註冊失敗：", error);

        res.status(500).json({
            message: "註冊失敗",
            error: error.message,
        });
    }
});

//登入 API
router.post("/login", async (req, res) => {
    try {
        await ensureUserColumns();
        const { account, password } = req.body;

        if (!account || !password) {
            return res.status(400).json({
                message: "請輸入帳號與密碼",
            });
        }

        const result = await pool.query(
            `
      SELECT id, account, password, name, student_id, department, avatar, bio, role, verify_status, student_card_url, student_card_review_note, created_at
      FROM users
      WHERE account = $1
      `,
            [account]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "帳號或密碼錯誤",
            });
        }

        const user = result.rows[0];

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "帳號或密碼錯誤",
            });
        }

        if (user.role !== "admin" && user.verify_status !== "approved") {
            const message = user.verify_status === "rejected"
                ? `學生證審核未通過${user.student_card_review_note ? `：${user.student_card_review_note}` : ""}`
                : "學生證仍在審核中，通過後才能登入";
            return res.status(403).json({ message });
        }

        delete user.password;

        res.json({
            message: "登入成功",
            user,
        });
    } catch (error) {
        console.error("登入失敗：", error);

        res.status(500).json({
            message: "登入失敗",
            error: error.message,
        });
    }
});

router.get("/auth-test", (req, res) => {
    res.json({ message: "auth routes 正常" });
});

module.exports = router;