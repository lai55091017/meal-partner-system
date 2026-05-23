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
