# 飯搭子系統 Meal Partner System

飯搭子系統是一個以大學生聚餐媒合為主題的全端專題。使用者可以註冊、登入、建立飯局、加入飯局、聊天室溝通、接收通知、修改個人資料，並在飯局結束後互相評價。

## 一、系統功能

| 功能 | 說明 | 資料庫狀態 |
|---|---|---|
| 註冊 / 登入 | 使用者建立帳號並登入系統 | 已連接 PostgreSQL |
| 個人資料 | 修改姓名、學號、系所、頭像、個人介紹 | 已連接 PostgreSQL |
| 飲食偏好 | 儲存飲食習慣與喜歡餐點類型 | 已連接 PostgreSQL |
| 建立飯局 | 主辦人建立飯局資料 | 已連接 PostgreSQL |
| 飯局列表 | 顯示我的飯局與其他飯局 | 已連接 PostgreSQL |
| 加入飯局 | 使用者加入其他人建立的飯局 | 已連接 PostgreSQL |
| 退出飯局 | 非主辦人可退出已加入的飯局 | 已連接 PostgreSQL |
| 取消飯局 | 主辦人可取消飯局 | 已連接 PostgreSQL |
| 刪除飯局 | 已取消飯局可真正從資料庫刪除 | 已連接 PostgreSQL |
| 聊天室 | 每個飯局有獨立聊天室 | 已連接 PostgreSQL |
| 通知 | 建立、加入、退出、取消、聊天會產生通知 | 已連接 PostgreSQL |
| 評價 | 飯局結束後可評價成員 | 已連接 PostgreSQL |

## 二、使用技術

### 前端

- HTML
- CSS
- JavaScript
- RWD 響應式網頁設計
- localStorage：僅保留登入狀態與必要暫存

### 後端

- Node.js
- Express
- PostgreSQL
- bcryptjs：密碼加密
- cors：允許前端呼叫 API
- dotenv：讀取環境變數

## 三、專案結構

```text
meal-partner-system/
├─ index.html
├─ styles.css
├─ js/
│  ├─ config.js
│  ├─ api.js
│  └─ app.js
├─ meal-partner-backend/
│  ├─ server.js
│  ├─ db.js
│  ├─ schema.sql
│  ├─ package.json
│  ├─ .env.example
│  └─ routes/
│     ├─ auth.routes.js
│     ├─ user.routes.js
│     ├─ party.routes.js
│     ├─ chat.routes.js
│     ├─ notification.routes.js
│     └─ rating.routes.js
└─ README.md
```

## 四、安裝與啟動方式

### 1. 下載專案

```powershell
git clone https://github.com/你的帳號/meal-partner-system.git
cd meal-partner-system/meal-partner-backend
```

### 2. 安裝後端套件

```powershell
npm install
```

### 3. 建立 PostgreSQL 資料庫

在 pgAdmin 建立資料庫，例如：

```text
meal_partner
```

### 4. 建立 `.env`

複製 `.env.example`：

```powershell
copy .env.example .env
```

然後修改 `.env`：

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meal_partner
DB_USER=postgres
DB_PASSWORD=你的資料庫密碼
```

### 5. 建立資料表

啟動後端後，瀏覽器開啟：

```text
http://localhost:3000/api/init-db
```

看到以下訊息代表資料表建立成功：

```json
{
  "message": "資料表建立成功"
}
```

### 6. 啟動後端

```powershell
npm run dev
```

成功後會看到：

```text
Server running on http://localhost:3000
```

### 7. 啟動前端

使用 VS Code Live Server 開啟 `index.html`，前端網址通常是：

```text
http://127.0.0.1:5500/index.html
```

請確認 `js/config.js`：

```js
const API_BASE_URL = "http://localhost:3000/api";
```

## 五、API 路由摘要

### Auth

| Method | API | 功能 |
|---|---|---|
| POST | `/api/register` | 註冊 |
| POST | `/api/login` | 登入 |

### Users

| Method | API | 功能 |
|---|---|---|
| GET | `/api/users/:id/profile` | 取得個人資料 |
| PUT | `/api/users/:id/profile` | 更新個人資料 |
| PUT | `/api/users/:id/preferences` | 更新飲食偏好 |

### Parties

| Method | API | 功能 |
|---|---|---|
| GET | `/api/parties` | 取得飯局列表 |
| POST | `/api/parties` | 建立飯局 |
| POST | `/api/parties/:id/join` | 加入飯局 |
| DELETE | `/api/parties/:id/leave` | 退出飯局 |
| PATCH | `/api/parties/:id/cancel` | 取消飯局 |
| DELETE | `/api/parties/:id` | 刪除飯局 |

### Chats

| Method | API | 功能 |
|---|---|---|
| GET | `/api/chats/:partyId/messages` | 取得聊天室訊息 |
| POST | `/api/chats/:partyId/messages` | 傳送聊天室訊息 |

### Notifications

| Method | API | 功能 |
|---|---|---|
| GET | `/api/notifications/:userId` | 取得通知 |
| POST | `/api/notifications` | 新增通知 |
| DELETE | `/api/notifications/:id` | 刪除通知 |

### Ratings

| Method | API | 功能 |
|---|---|---|
| POST | `/api/ratings` | 送出評價 |
| GET | `/api/ratings/received/:userId` | 取得收到的評價 |
| GET | `/api/ratings/summary/:userId` | 取得平均評分 |
| GET | `/api/ratings/check` | 檢查是否已評價 |

## 六、測試帳號建立方式

可以使用前端註冊頁建立帳號，也可以用 PowerShell：

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/register" `
  -Method POST `
  -ContentType "application/json; charset=utf-8" `
  -Body '{"account":"test001","password":"1234","name":"王小明"}'
```

## 七、注意事項

不要上傳以下檔案到 GitHub：

```text
node_modules/
.env
*.log
```

建議 `.gitignore` 包含：

```gitignore
node_modules/
**/node_modules/
.env
.env.local
*.log
```

## 八、後續可擴充功能

- 主辦人手動結束飯局，將狀態改為 `completed`
- 通知已讀 / 未讀
- 圖片上傳改為雲端儲存
- 部署後端到 Render / Railway
- 使用 Supabase / Neon 作為雲端 PostgreSQL
