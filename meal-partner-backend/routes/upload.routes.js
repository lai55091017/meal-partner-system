const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function ensureUploadDir(folder) {
  const targetDir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const extension = ALLOWED_IMAGE_TYPES[mimeType];
  if (!extension) return null;

  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2], "base64"),
  };
}

/**
 * 展示用圖片上傳
 * POST /api/uploads/image
 * body: { dataUrl, usage: "avatar" | "party", fileName }
 */
router.post("/image", async (req, res) => {
  try {
    const { dataUrl, usage = "common" } = req.body || {};
    const parsed = parseDataUrl(dataUrl);

    if (!parsed) {
      return res.status(400).json({ message: "請上傳 jpg、png、webp 或 gif 圖片" });
    }

    if (parsed.buffer.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ message: "圖片大小不能超過 4MB" });
    }

    const folder = usage === "avatar" ? "avatars" : usage === "party" ? "parties" : "common";
    const targetDir = ensureUploadDir(folder);
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${parsed.extension}`;
    const filePath = path.join(targetDir, safeName);

    fs.writeFileSync(filePath, parsed.buffer);

    const relativePath = `/uploads/${folder}/${safeName}`;
    const origin = `${req.protocol}://${req.get("host")}`;

    res.status(201).json({
      message: "圖片上傳成功",
      path: relativePath,
      url: `${origin}${relativePath}`,
    });
  } catch (error) {
    console.error("圖片上傳失敗：", error);
    res.status(500).json({ message: "圖片上傳失敗", error: error.message });
  }
});

module.exports = router;
