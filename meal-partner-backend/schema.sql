CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  account VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  student_id VARCHAR(50),
  department VARCHAR(100),
  avatar TEXT,
  bio TEXT,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  value VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS parties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store VARCHAR(100) NOT NULL,
  meal_type VARCHAR(20) NOT NULL,
  party_time VARCHAR(100) NOT NULL,
  max_people INTEGER NOT NULL,
  description TEXT,
  image_url TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_members (
  id SERIAL PRIMARY KEY,
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(party_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'system',
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- status 實際儲存：open=招募中、ended=已結束、cancelled=已取消。
-- full / owner / joined 屬於前端顯示狀態，不寫入 parties.status，避免人數變動時狀態不同步。
-- 飯局時間到後，後端讀取、加入、取消、評價、刪除檢查時會自動視為 / 更新為 ended。
-- 既有資料庫若已建立 parties，此 ALTER 只補上預設狀態，不會影響既有資料。
ALTER TABLE parties ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(party_id, from_user_id, to_user_id)
);


-- 後台管理角色：user=一般使用者、admin=管理員。
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE account = 'admin';

-- 校園周邊餐廳清單：建立飯局時可從此清單挑選餐廳。
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  price_level VARCHAR(10) NOT NULL DEFAULT '$',
  opening_hours VARCHAR(100) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  feature TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO restaurants (name, category, price_level, opening_hours, address, feature) VALUES
('校門口便當', '便當', '$', '10:30-20:00', '校門口周邊商圈', '出餐快、適合午餐、價格親民'),
('學餐二樓簡餐', '簡餐', '$', '11:00-19:30', '校內學餐二樓', '距離近、座位多、適合下課聚餐'),
('吳興街牛肉麵', '麵食', '$$', '11:00-21:00', '吳興街周邊', '份量足、熱食、適合晚餐'),
('信義咖哩屋', '咖哩', '$$', '11:30-20:30', '信義區校園周邊', '咖哩口味濃、適合小團體'),
('和平東路水餃館', '麵食', '$', '10:30-20:30', '和平東路周邊', '水餃與湯品、價格穩定'),
('校園早午餐', '早午餐', '$$', '07:00-14:00', '校園周邊巷弄', '早餐、蛋餅、吐司，適合早八前'),
('學生滷味店', '滷味', '$', '16:00-23:00', '夜市/商圈周邊', '可客製、適合宵夜'),
('日式丼飯小屋', '日式', '$$', '11:00-21:00', '校園附近商店街', '丼飯、炸物、適合晚餐'),
('韓式飯捲店', '韓式', '$$', '11:00-20:00', '校園周邊巷口', '飯捲、泡菜鍋，適合少人聚餐'),
('健康沙拉餐盒', '健康餐', '$$', '10:30-19:30', '校園周邊商圈', '低油、蔬菜多、適合健身族'),
('義大利麵小館', '義式', '$$$', '11:30-21:00', '校園附近主要道路', '氣氛較好，適合慢慢聊天'),
('平價火鍋店', '火鍋', '$$$', '11:00-22:00', '校園周邊商圈', '適合多人、晚餐聚會'),
('炸雞漢堡店', '速食', '$$', '10:00-22:00', '校門口附近', '快速、好分食、適合臨時約飯'),
('巷弄咖啡館', '咖啡廳', '$$', '09:00-18:00', '校園周邊巷弄', '安靜、可討論作業、適合下午'),
('自助餐小站', '自助餐', '$', '10:30-20:00', '校園周邊便當街', '菜色多、價格彈性、適合日常用餐')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE parties ADD COLUMN IF NOT EXISTS restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL;

-- 檢舉與審核：target_type 可為 party / user / chat。
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
);

-- 若 reports 是舊版本建立的，補上後續新增欄位，避免自動初始化時找不到 party_id。
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason VARCHAR(100);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS handled_at TIMESTAMP;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_once_per_target
ON reports (reporter_id, target_type, target_id, COALESCE(party_id, 0));
