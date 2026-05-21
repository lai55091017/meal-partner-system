const express = require("express");
const pool = require("../db");

const router = express.Router();

/**
 * 取得個人資料
 * GET /api/users/:id/profile
 */
router.get("/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      `
      SELECT id, account, name, student_id, department, avatar, bio, created_at
      FROM users
      WHERE id = $1
      `,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "找不到使用者",
      });
    }

    const preferencesResult = await pool.query(
      `
      SELECT type, value
      FROM user_preferences
      WHERE user_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    res.json({
      user: userResult.rows[0],
      preferences: preferencesResult.rows,
    });
  } catch (error) {
    console.error("取得個人資料失敗：", error);

    res.status(500).json({
      message: "取得個人資料失敗",
      error: error.message,
    });
  }
});

/**
 * 更新個人資料
 * PUT /api/users/:id/profile
 */
router.put("/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, studentId, department, avatar, bio } = req.body;

    if (!name || !studentId) {
      return res.status(400).json({
        message: "姓名與學號不能空白",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = $1,
        student_id = $2,
        department = $3,
        avatar = $4,
        bio = $5
      WHERE id = $6
      RETURNING id, account, name, student_id, department, avatar, bio, created_at
      `,
      [name, studentId, department || "", avatar || "", bio || "", id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "找不到使用者",
      });
    }

    res.json({
      message: "個人資料更新成功",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("更新個人資料失敗：", error);

    res.status(500).json({
      message: "更新個人資料失敗",
      error: error.message,
    });
  }
});

/**
 * 更新飲食偏好
 * PUT /api/users/:id/preferences
 */
router.put("/:id/preferences", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { diet = [], cuisine = [] } = req.body;

    await client.query("BEGIN");

    const userCheck = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [id]
    );

    if (userCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "找不到使用者",
      });
    }

    await client.query(
      "DELETE FROM user_preferences WHERE user_id = $1",
      [id]
    );

    const insertPreference =
      "INSERT INTO user_preferences (user_id, type, value) VALUES ($1, $2, $3)";

    for (const value of diet) {
      await client.query(insertPreference, [id, "diet", value]);
    }

    for (const value of cuisine) {
      await client.query(insertPreference, [id, "cuisine", value]);
    }

    await client.query("COMMIT");

    res.json({
      message: "飲食偏好更新成功",
      preferences: {
        diet,
        cuisine,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("更新飲食偏好失敗：", error);

    res.status(500).json({
      message: "更新飲食偏好失敗",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;