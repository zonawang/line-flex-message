# 🔮 LINE Bot 視覺與智慧雙重升級：打造動態隨機「水晶推薦」Flex Message 卡片與 AI 大腦融合實錄

在上幾次的開發中，我們成功地幫我們的 LINE 占星與水晶助理接上了 Firestore 永久記憶、客製化 Rich Menu 與動態 Quick Reply。機器人雖然已經能聰明地與使用者對談，但在「視覺呈現」上，總覺得還少了一點讓人驚艷的「高級感」。

這一次，我決定為它進行一次大規模的軟硬體升級：
1. **高規格 Flex Message 水晶卡片**：當使用者輸入 `#水晶` 時，機器人會從水晶資料庫中，隨機挑選 3 種不同的水晶，並以精美的 **Micro-Carousel（微型輪播圖卡）** 格式呈現。每張卡片包含高畫質水晶圖片、客製化星級評分、核心功效，以及精美的 HSL 漸層配色。
2. **多功能程式庫大融合**：將先前 `line-ai-bot` 的所有優秀功能（包括基於 Google ADK 框架的星座水晶專家、多模態圖片分析辨識、Firestore 對話紀錄記憶等）完整移植並融入全新的 `line-flex-message` 專案中。
3. **雲端精準部署與版本控制**：克服本地端環境權限與 GCP 部署區域的衝突，成功將服務部署至離台灣最近的 `asia-east1` 節點，並完整推送到 GitHub 儲存庫。

雖然聽起來只是功能整併，但在實作過程中，我們依然遇到了不少關於 API 規範、本地環境與 GCP 跨區部署的精彩挑戰。以下就來記錄我和我的 AI 神隊友 **Google Antigravity** 是如何攜手在半天內完成這次升級的。

---

## 🧩 第一關：Micro-Carousel Flex Message 的繁瑣設計與隨機演算法

LINE 的 Flex Message 雖然非常強大，但它的 JSON 結構極度繁瑣且嚴格。稍有不慎（例如括號沒對齊、屬性值類型錯誤或欄位超限），整張卡片就會直接消失。

我的目標是打造一個「點擊 `#水晶`，就隨機推薦 3 種水晶」的機制。目前資料庫裡有 7 種頂級水晶：
* 紫水晶（Amethyst）：開發智慧、平穩情緒
* 粉晶（Rose Quartz）：增進人緣、守護愛情
* 黃水晶（Citrine）：招財聚財、建立自信
* 綠幽靈（Green Phantom）：助益事業、招貴人
* 白水晶（Clear Quartz）：淨化磁場、辟邪擋煞
* 黑曜石（Obsidian）：吸收負能量、強大避邪
* 鈦晶（Rutilated Quartz）：水晶之王、招正偏財

### 💡 解決方案：動態隨機洗牌與 LINE Bubble 範本產生器

為了確保每次出現的推薦都是隨機且不重複的，我們在 JavaScript 中實作了 **Fisher-Yates 洗牌演算法**：

```javascript
function getRandomCrystals(count = 3) {
  const shuffled = [...CRYSTAL_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
```

接著，我們利用程式碼動態生成 LINE `carousel` 格式的 Flex Message。
每張卡片都被限制在 `micro` 尺寸，並套用精緻的視覺結構：
* **Hero 區塊**：高畫質的水晶意境圖片，比例設定為完美的 `320:213`。
* **Body 區塊**：動態生成的 HSL 配色、水晶名稱、用金色星星代表的推薦指數、以及條列式功效說明。
* **Footer 區塊**：一個「詳細諮詢」的互動按鈕，讓使用者可以直接與 AI 助理深入聊聊該水晶。

```javascript
const carouselMessage = {
  type: 'flex',
  altText: '🔮 本日水晶推薦指南',
  contents: {
    type: 'carousel',
    contents: selectedCrystals.map(crystal => ({
      type: 'bubble',
      size: 'micro',
      hero: {
        type: 'image',
        url: crystal.imageUrl,
        size: 'full',
        aspectMode: 'cover',
        aspectRatio: '320:213'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: crystal.name,
            weight: 'bold',
            size: 'sm',
            wrap: true
          },
          // ... 略過其餘繁瑣的 Flex JSON 欄位
        ]
      }
    }))
  }
};
```

---

## 🧩 第二關：AI 核心與 Firestore 記憶搬家，避免無限對答迴圈

在把 `line-ai-bot` 的程式碼搬過來時，我們遇到了一個邏輯設計上的考量：
當用戶輸入「水晶」這兩個字時，我們到底該觸發「Flex Message 推薦圖卡」，還是觸發「AI 占星專家對話」？

如果只是簡單的關鍵字模糊比對，只要使用者在跟 AI 聊天時提到「我覺得白水晶很有用」，系統就會立刻又彈出 3 張隨機推薦卡片，這會嚴重打斷對話體驗。

### 💡 解決方案：精準的前綴字元觸發

與 Antigravity 討論後，我們決定採用帶有特殊前綴的 `#水晶` 作為 Flex Message 卡片的專屬觸發語：
1. **輸入 `#水晶`**：直接由後端邏輯攔截，0 毫秒極速回傳 3 張隨機水晶推薦圖卡。
2. **輸入一般水晶名稱（如白水晶）或聊到水晶**：這時不觸發圖卡，而是將對話交給 Google ADK 驅動的 Gemini 占星專家代理（`crystal-expert`），結合 Firestore 中的 Session Memory，提供有上下文邏輯的暖心解答。

我們同時將 Firestore 的序列化邏輯完美搬遷，確保多模態（上傳水晶照片讓 AI 辨識）的功能也能在新的程式碼中完美執行：

```javascript
// handleEvent 內部的邏輯分流
if (userMessage.startsWith('#水晶') || userMessage === '水晶') {
  const selected = getRandomCrystals(3);
  const flexMessage = generateCrystalFlex(selected);
  await replyToLine(replyToken, flexMessage);
} else {
  // 交給 Google ADK + Firestore 記憶處理
  const session = await getOrCreateSession(userId);
  const response = await aiAgent.chat(userMessage, session);
  await replyToLine(replyToken, { type: 'text', text: response });
}
```

---

## 🧩 第三關：本地 npm 快取 EACCES 權限卡關

在本地端進行整合測試、準備安裝新套件時，我的終端機在執行 `npm install` 時突然跳出了一大片紅色的 `EACCES: permission denied` 報錯。

這是因為 macOS 系統中，全域的 npm 快取目錄（`~/.npm`）權限可能在之前的某些操作中被鎖定為 root 帳號所有，導致一般使用者權限無法寫入。

### 💡 解決方案：本地端快取隔離法

面對權限問題，通常最直接的想法是用 `sudo`。但這是不安全的，且容易讓權限問題雪上加霜。
Antigravity 給出了一個非常優雅的解決方案：**命令 npm 使用專案目錄下的本地快取**。

我們只需要在安裝時加入 `--cache` 參數，即可完全繞過系統全域快取的權限封鎖：

```bash
npm install --cache ./.npm-cache
```

這個小技巧不僅成功避開了權限問題，還確保了專案在封閉、乾淨的環境下完成相依性安裝。

---

## 🧩 第四關：GCP 跨區部署與 Webhook 網址對齊

程式碼整合完畢、本地測試通過後，接著就是要部署到 Google Cloud Run。
我直接請 Antigravity 幫我進行更新部署。

然而，當部署成功後，我興奮地在 LINE 視窗裡輸入 `#水晶`，卻發現毫無反應。
我們趕緊調閱 Cloud Run 的服務列表，這才發現了一個隱藏的設定衝突：

> 🔍 **預設的 `gcloud run deploy` 會將服務部署到美國的 `us-central1` 節點。但我原本在 LINE Developer Console 上設定的 Webhook 網址，其實是指向台灣（亞洲）的 `asia-east1` 節點！**

這導致我們雖然在 `us-central1` 部署了最新版的程式碼，但 LINE Webhook 呼叫的依然是舊版在 `asia-east1` 的服務。

### 💡 解決方案：精準指定目標 Region 部署

我們立刻修正部署指令，顯式指定部署區域為 `asia-east1`：

```bash
gcloud run deploy line-echo-bot \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated
```

部署完成後，綠色的成功標誌亮起。我們再次在手機上輸入 `#水晶`——精美的水晶推薦卡片瞬間秒出！上傳一張粉晶照片，AI 占星大腦也立刻辨識出水晶種類並給出溫暖的占星建議。

---

## 💬 結語：將設計與技術發揮至極致

這一次的升級，讓專案從單純的「對話機器人」，蛻變成兼具「高質感視覺 Flex 卡片」與「強大 AI 大腦」的成熟產品。

在這次的合作中：
* **我負責產品互動邏輯與視覺把關**：決定使用特殊的前綴字防止對話干擾、挑選卡片的風格以及決定部署的目標。
* **Google Antigravity 負責底層架構整合與障礙排除**：設計 Fisher-Yates 隨機洗牌演算法、用隔離快取解決本地 npm 權限衝突、並精準定位 Cloud Run 的跨區部署問題。

現在，這套完美的「水晶推薦與 AI 占星」系統已全數備份、提交並 Push 至最新的 GitHub 倉庫：
🔗 **專案 GitHub 倉庫**：https://github.com/zonawang/line-flex-message.git

如果你也想為你的 LINE Bot 打造如此精緻的 Flex Message 圖卡與記憶型 AI 大腦，歡迎參考我的 Repo，讓我們一起用 AI 協同開發，把創意變成現實！
