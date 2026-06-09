# ✨ LINE Flex Message Showcase Bot

這是一個專門用來設計、開發與測試 LINE **Flex Message** 的極致質感 Showcase 機器人專案。

本專案使用 Node.js、Express 與最新的 `@line/bot-sdk (v9+)` 技術打造，提供數個符合現代奢華感、文青風格及互動性極佳的 Flex Message 範本，可作為您的 LINE 專案完美開發基礎。

---

## 🎨 亮點 Flex Message 範本展示

專案中預先內建了三款經過精心設計、比例調和、排版細緻的高端範本：

1. **📇 極簡莫蘭迪數位名片 (Glassmorphism Digital Card)**
   - **特色**：深色背景、微發光霓虹綠主題色、精緻圓形頭像與完美的欄位對齊，適合個人品牌、官方帳號數位客服或業務名片展示。
   
2. **✈️ 星宇極致登機證 (Luxury Flight Boarding Pass)**
   - **特色**：亮色奢華金底色、飛機航線水平流線排版、精準的時間/航班號/座位欄位排列，並附有 Apple Wallet 兌換按鈕，體驗尊榮感。

3. **☕️ 日系文青風下午茶菜單 (Cafe Specialty Menu)**
   - **特色**：柔和奶油白底色、暖棕主題色、星級評等（Stars）與劃底線的原價/特價雙重對比，附帶加入購物車與立即預約的互動按鈕。

4. **✨ 輪播展示大廳 (Flex Message Hub Carousel)**
   - **特色**：將上述三款名片、登機證與菜單，融合成一組高度流暢、左右滑動的 **Carousel** 輪播格式，達到最極致的視覺震撼。

---

## 🛠️ 開發與啟動步驟

### 1. 安裝相依套件
在專案根目錄執行以下指令：
```bash
npm install
```

### 2. 配置環境變數
我們已經為您從舊專案複製了環境變數設定。若需要手動調整，請在根目錄的 `.env` 檔案中填入您的 LINE Channel 認證資訊：
```env
LINE_CHANNEL_ACCESS_TOKEN="您的 LINE Channel Access Token"
LINE_CHANNEL_SECRET="您的 LINE Channel Secret"
PORT=8080
```

### 3. 本地端開發啟動 (Hot Reloading)
```bash
npm run dev
```

### 4. 正式環境啟動
```bash
npm start
```

---

## 💬 測試對話觸發關鍵字

機器人啟動後，只要在 LINE 中發送以下關鍵字，即可立即獲得對應的 Flex Message：

| 關鍵字 (輸入) | 回覆 Flex Message 主題 |
| :--- | :--- |
| **`水晶`** 或 `crystal` | 🔮 **本日隨機推薦三款能量水晶** (每次觸發皆不重複，共有七款水晶輪替) |
| **`名片`** 或 `card` | 📇 艾莉絲的極簡數位名片 |
| **`登機證`** 或 `ticket` | ✈️ 星宇極致登機證確認 |
| **`菜單`** 或 `menu` | ☕️ 法式香草舒芙蕾與耶加雪菲組合 |
| **`全部`** 或 `carousel` | ✨ 輪播展示大廳 (一次看三個) |
| *任意其他文字* | 🎯 顯示互動式引導選單與快速按鈕 (Quick Replies) |

---

## 🐳 Docker 與 Cloud Run 部署

專案中已內建 `Dockerfile` 與 `.dockerignore`。若您需要將此 Bot 部署至 Google Cloud Run，可以直接執行：

```bash
gcloud run deploy line-flex-message --source .
```

祝您開發愉快！如果有任何設計或排版上的想法，請隨時告訴我！✨
