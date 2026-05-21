const express = require("express");
const pool = require("../db");
//密碼加密套件
const bcrypt = require("bcryptjs");

const router = express.Router();
//註冊 API
router.post("/register", async (req, res) => {
    try {
        const { account, password, name } = req.body;

        if (!account || !password || !name) {
            return res.status(400).json({
                message: "請輸入帳號、密碼與姓名",
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
      INSERT INTO users (account, password, name, student_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, account, name, student_id, department, avatar, bio, created_at
      `,
            [account, hashedPassword, name, account]
        );

        res.status(201).json({
            message: "註冊成功",
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
        const { account, password } = req.body;

        if (!account || !password) {
            return res.status(400).json({
                message: "請輸入帳號與密碼",
            });
        }

        const result = await pool.query(
            `
      SELECT id, account, password, name, student_id, department, avatar, bio, created_at
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