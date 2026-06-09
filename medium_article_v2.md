# 🔮 LINE Bot 從零到極致的進化旅程：打造具備「永久記憶大腦」、「動態智慧追問」、「手繪選單」與「隨機水晶 Flex 卡片」的終極占星助理實錄

你有沒有想過，一個簡單的聊天機器人，在 AI 的強大助力下，能在短短幾天內進化到什麼程度？

在這一趟漫長且充滿驚喜的開發旅程中，我與我的 AI 神隊友 **Google Antigravity** 展開了一系列深度協同合作。我們從一個最基本的「複誦（Echo）機器人」出發，一步步跨越了多模態大腦、雲端永久資料庫、智慧互動按鈕、手繪高畫質圖文選單、以及高級微型輪播 Flex Message 卡片等多道技術雄關。

這篇文章將 5 大開發篇章、所有踩雷實錄以及我們共同戰勝技術障礙的過程完整記錄下來。更重要的是，文章中會真實還原我當時對 AI 下達的原始 Prompt，讓大家一窺「人機協同開發」的驚人效率！

---

## 🗺️ 5 大進化篇章全景導覽

1. **首部曲：不懂程式的雲端起點** —— 20 分鐘無痛打造 LINE Bot 並部署至 Google Cloud Run。
2. **二部曲：多模態大腦的覺醒** —— 升級 Gemini 2.5 大腦，學會看圖說故事與免密認證。
3. **三部曲：永久記憶與靈魂重塑** —— 引入 Google ADK 與 Cloud Firestore，讓人設從「浮誇神婆」蛻變為「沈穩知性占星大師」。
4. **四部曲：互動感拉滿的細節優化** —— 挑戰 20 字 Quick Reply、用 `sips` 壓縮突破 1MB 手繪選單、抓出 JavaScript 變數作用域 Bug。
5. **五部曲（今日更新）：視覺震撼！隨機推薦卡片與雙專案功能大融合** —— Fisher-Yates 洗牌推薦、前綴字分流、解決 npm 快取權限與 GCP 部署區域羅生門。

---

## 🚀 篇章一：首部曲 —— 不懂程式的雲端起點

在旅程的最起點，我只是一個想要擁有專屬 LINE Bot 的開發者。我的需求很簡單：架設一個伺服器，串接 LINE Webhook，並將其上傳到穩定、免維護的雲端環境。

這時，**Google Antigravity** 第一次展現了它的神隊友體質。我直接下達指令：

> 💬 **「請幫我用 gcloud 部署上去，專案名稱：line-zona，機器名稱：line-echo-bot，環境變數不變」**

Antigravity 迅速幫我產生了基於 Express 框架的 Node.js 伺服器，自動設定好 `.env.example` 與 `Dockerfile`，並自動呼叫 GCP CLI：

```bash
gcloud run deploy line-echo-bot \
  --source . \
  --project line-zona \
  --allow-unauthenticated
```

只花了短短 20 分鐘，一個運行在 Google Cloud Run 上的高可用性 LINE Bot 宣告誕生！

---

## 🧠 篇章二：二部曲 —— 多模態大腦的覺醒

機器人雖然能跑了，但只會「學舌複誦」實在太過枯燥。我希望我的占星助理能夠擁有智慧，甚至在使用者上傳水晶手珠照片時，能辨識水晶種類並給出專業的佩戴與能量調和建議。

我向 Antigravity 提出：

> 💬 **「我要接上 Gemini 大腦，而且能看懂圖片，還要整合進 Webhook 裡」**

我們引進了 Google 的 Vertex AI 套件，透過多模態大腦（Multimodal Brain）處理 LINE 傳送過來的 binary 圖像串流。現在，當用戶傳送照片時，後端會將圖片 Buffer 直接轉送給 Gemini：

```javascript
const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const response = await model.generateContent([
  {
    inlineData: {
      data: Buffer.from(imageBuffer).toString('base64'),
      mimeType: 'image/jpeg'
    }
  },
  "請辨識圖中的水晶，並分析其能量功效。"
]);
```

這項功能，讓我們的 Bot 一夕之間擁有了「視覺」，可以開始看圖說故事！

---

## 💾 篇章三：三部曲 —— 永久記憶與靈魂重塑（Google ADK + Firestore）

當多模態大腦就位後，我們卻遇上了 Serverless 的本質難題：每當 Cloud Run 因為閒置而自動「縮容至零（Scale to Zero）」或重啟時，暫存在記憶體中的對話歷史就會煙消雲散。使用者每一次開啟對話，都必須重新自報家門，體驗非常糟糕。

為了解決這個痛點，我決定引入 **Google ADK（Agent Development Kit）智慧代理框架** 與 **Google Cloud Firestore 資料庫**。

### 🧩 難關一：Node.js CJS/ESM 世紀大碰撞
引入 `@google/adk` 後，伺服器卻在啟動瞬間崩潰：
`❌ Error [ERR_REQUIRE_ESM]: require() of ES Module ... lodash-es not supported`

由於 ADK 內部使用 ES Module，而我們的 LINE Bot 採用傳統的 CommonJS 語法，兩者無法相容。
Antigravity 提出了利用 Node 22 的新旗標來解決：
在 `Dockerfile` 中將啟動命令優化為：
```dockerfile
CMD [ "node", "--experimental-require-module", "index.js" ]
```
免去了繁瑣的全面重構，CJS 與 ESM 完美相容！

### 🧩 難關二：英文 ADK 搜尋不到中文記憶？
我們發現，ADK 內建的分詞搜尋使用的是 `/[A-Za-z]+/g` 正規表示式，直接把漢字當空白過濾掉。
為此，Antigravity 幫我客製化覆寫了記憶檢索邏輯，改用中文字串的子字串匹配（Substring-based Matching），讓 ADK 也能完美看懂中文。

### 🧩 難關三：打造雙層儲存與免密認證
我們實作了符合 ADK 介面的 `ChineseFirestoreMemoryService`。最驚艷的是，我們沒有下載任何 JSON 私鑰檔案，而是透過 **GCP 應用程式預設憑證（ADC）**：
在 GCP 內授權 `roles/datastore.user`（Firestore 使用者）權限給 Cloud Run 的預設服務帳戶，程式直接以 **零金鑰** 的極高安全性存取資料庫。

### 🧩 難關四：靈魂整型
解決了技術問題後，我發現原本設定的「水晶神婆」人設在做心理占卜時顯得有些輕浮。於是我下達了靈魂調整指令：

> 💬 **「首先，不要叫自己神婆，然後語氣有點太活潑，你是專業的水晶與占星諮詢大師，語氣請調整得更沈穩知性。」**

Antigravity 隨即將 System Instruction 重整，剔除了「哎呀、寶貝」等語助詞，改用優雅、溫暖且沈穩的專業口吻，成功讓機器人的對話質感得到了質的飛躍。

---

## 🎨 篇章四：四部曲 —— 互動感拉滿的細節優化（Quick Reply 與手繪選單）

一個成熟的產品，需要主導互動。如果只是一問一答，話題很容易乾掉。

### 🧩 難關一：Gemini 動態追問與 LINE 20 字魔咒
我希望 Gemini 能根據剛才的聊天的上下文，動態生成 3 個問題，做成膠囊按鈕（Quick Reply）放在手機螢幕下方。
但 **LINE 限制 Quick Reply Label 只能容納 20 個字**！
為此，我們採用雙重防禦：在 Prompt 中下指令限制字數，並在 JavaScript 端加上強制的 `.substring(0, 20)` 安全截斷，終於完美解決。

### 🧩 難關二：8.1MB 手繪選單圖挑戰 LINE 的 1MB 上限
我想在 LINE 下方加入一組手繪感強烈的神秘占星圖文選單。我說：

> 💬 **「我要使用 richmenu.png 作為我的richmenu，左邊是這個line bot 的使用指南，右邊請連到https://github.com/zonawang/zona-ai-learning-lab」**

但隨後我發現圖片給錯了：

> 💬 **「圖片不對欸，請把圖片改成 123.png」**

這張精美的 `123.png` 解析度極高，高達 8.1MB。然而，**LINE Rich Menu 限制圖片必須小於 1MB**！
Antigravity 建議我使用 macOS 內建的 `sips` 工具進行無損級壓縮：
```bash
sips -s format jpeg -s formatOptions 70 -z 1686 2500 123.png --out richmenu_resized.jpg
```
完美將檔案壓縮至 955 KB，並順利透過腳本完成了一鍵註冊。

### 🧩 難關三：點了選單卻沒有反應？
上線後，使用者回報：

> 💬 **「點了richmenu左側的使用指南，沒反應」**

檢查日誌後，發現是 `ReferenceError: isGuide is not defined` 報錯。原因在於我們在 `try` 區塊內部宣告了 `let isGuide = false`，使其成為了區塊作用域變數。當我們在 try 區塊外部調用時便發生了異常。
我們將變數提升到函式層級（Hoisting），成功修正此 Bug，實現 0 毫秒極速直出使用指南說明！

---

## 🔮 篇章五：五部曲（今日更新） —— 視覺震撼！動態隨機水晶卡片與大融合

進入今天的開發，我希望在視覺上做一次降維打擊：每次輸入關鍵字時，都能精美輪播推薦 3 種水晶。

### 🧩 難關一：精美 micro 尺寸 Flex Message 隨機推薦
我對 Antigravity 說：

> 💬 **「我要使用flex message，顯示本日推薦三種水晶，需要水晶圖片（網路上抓圖或是你幫我產）、水晶功效，我想要類似以下模板...」**

隨後，我進一步要求不重複與動態感：

> 💬 **「以上可以，但我想要每一次出現flex message時，都是隨機出現三種不同的水晶」**

為了達成這個需求，我們在後端程式中設計了 **Fisher-Yates 隨機洗牌演算法**，從 7 種精選水晶池中挑選不重複的 3 種，並組裝成 LINE Micro-Carousel JSON 格式，搭配高畫質圖片與精美星星評分，呈現出令人驚艷的視覺效果。

### 🧩 難關二：兩大程式庫功能大融合與關鍵字分流
水晶功能測試完畢後，我提出了整合要求：

> 💬 **「請把line-ai-bot 裡的所有功能，也都搬進來」**

在搬遷過程中，為了防止一般聊天聊到水晶時，頻繁跳出推薦卡片打斷對話，我要求限制觸發條件：

> 💬 **「請幫我改成打「#水晶」時，才會出現flex message」**

我們在 Webhook 核心邏輯中，將處理流程進行了精準分流：輸入帶有 `#水晶` 時走 Flex 圖卡推薦；輸入一般內容則交由帶有記憶的 Gemini 大腦處理。

### 🧩 難關三：本地 npm 快取 EACCES 權限報錯
當我們在本地端整合並安裝套件時，因為 macOS 系統權限衝突，`npm install` 報出 `EACCES` 拒絕寫入。
Antigravity 給出了解法——不使用全域快取，命令 npm 直接在專案目錄下建立快取：
```bash
npm install --cache ./.npm-cache
```
成功在無需 `sudo` 的情況下，安全完成所有套件安裝！

### 🧩 難關四：部署後沒反應？GCP 部署區域衝突
將程式碼搬移到新專案後，我請 Antigravity 進行部署：

> 💬 **「請幫我用gcloud部署上去 專案名稱：line-zona 機器名稱：line-echo-bot 環境變數不變」**

但部署成功後卻完全沒動靜。我問：

> 💬 **「你有部署上去嗎？我打了「水晶」，沒有出現flex message」**

隨後我提醒它：

> 💬 **「我已經設定過了，請直接更新」**

經過分析，原來是因為預設的部署會將服務放到美國 `us-central1`。而我原本在 LINE Developer Console 上綁定的 Webhook 其實一直指向台灣的 `asia-east1` 伺服器！
我們立刻將部署命令修正為：
```bash
gcloud run deploy line-echo-bot \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated
```
部署熱更新完成後，一切功能順暢接通！

### 🧩 難關五：安全推送到新倉庫
完成所有測試後，我下達了最後指令：

> 💬 **「請幫我push到 line-flex-message 這個repo」**

我們排除了私密的 `.env` 環境變數檔，成功將今天整合了前五篇進化歷程、乾淨無憑證洩漏的完整程式碼，上傳至我的 [line-flex-message](https://github.com/zonawang/line-flex-message) 倉庫！

---

## 💬 結語：AI 協作開發的新紀元

回顧這 5 大篇章的進化史，我深刻體會到了「人機協作」對開發效率的極致提升：
* **AI (Google Antigravity)**：負責解決底層語法衝突、記憶檢索重構、安全授權配置、圖片壓縮參數等硬核技術問題。
* **我（開發者）**：負責把握靈魂、把關美感、提出核心業務場景（如分流與隨機洗牌），並用清晰的 Prompt 引導 AI 做出調整。

這套完整的「記憶、選單、智慧追問與隨機水晶推薦」代碼，現已完美同步於我的 GitHub 儲存庫：
🔗 **最終專案倉庫**：https://github.com/zonawang/line-flex-message.git

歡迎點擊連結、參考我的程式碼，開啟屬於你自己的 AI 開發新篇章！
