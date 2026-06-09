const express = require('express');
const line = require('@line/bot-sdk');
const adk = require('@google/adk');
const { Firestore } = require('@google-cloud/firestore');
require('dotenv').config();

// Verify LINE SDK environmental variables
if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
  console.error('⚠️  [Error] Environment variables LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET are not set!');
  console.error('⚠️  Please check if you have copied .env.example to .env and filled in the real tokens.');
}

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'placeholder_token',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'placeholder_secret',
};

// ==========================================
// 🧠 Custom Chinese-Compatible Firestore Memory Service
// ==========================================

class ChineseFirestoreMemoryService {
  constructor() {
    console.log('📦 Initializing Google Cloud Firestore Connection...');
    this.db = new Firestore();
    this.collectionName = 'crystal_memories';
  }

  async addSessionToMemory(session) {
    const userId = session.userId;
    const sessionId = session.id;
    const appName = session.appName;
    console.log(`[FirestoreMemory] Ingesting session "${sessionId}" into Firestore for User: "${userId}"`);
    
    try {
      const docId = `${appName}_${userId}_${sessionId}`;
      const docRef = this.db.collection(this.collectionName).doc(docId);
      
      // Deep clone and serialize events to plain JS objects
      const eventsData = JSON.parse(JSON.stringify(session.events || []));

      await docRef.set({
        appName: appName,
        userId: userId,
        sessionId: sessionId,
        lastUpdateTime: session.lastUpdateTime || Date.now(),
        events: eventsData
      });
      console.log(`[FirestoreMemory] Session "${sessionId}" successfully saved to Firestore (Doc: ${docId}).`);
    } catch (err) {
      console.error(`❌ [FirestoreMemory] Failed to add session to Firestore:`, err);
    }
  }

  async searchMemory(req) {
    console.log(`[FirestoreMemory] searchMemory triggered with query: "${req.query}" for User: "${req.userId}"`);
    const appName = req.appName;
    const userId = req.userId;
    const query = req.query.toLowerCase();
    const response = { memories: [] };

    try {
      // Query Firestore for documents matching appName and userId
      const snapshot = await this.db.collection(this.collectionName)
        .where('appName', '==', appName)
        .where('userId', '==', userId)
        .get();

      if (snapshot.empty) {
        console.log(`[FirestoreMemory] No previous memories found in Firestore for key: ${appName}/${userId}`);
        return response;
      }

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const events = data.events || [];

        for (const event of events) {
          if (!event.content?.parts?.length) {
            continue;
          }
          const joinedText = event.content.parts
            .map((part) => part.text)
            .filter((text) => !!text)
            .join(" ")
            .toLowerCase();

          // Substring-based matching strategy tailored for Traditional Chinese & English
          let matchQuery = false;
          if (joinedText.includes(query)) {
            matchQuery = true;
          } else {
            const segments = query.split(/\s+/).filter(s => s.length > 0);
            if (segments.length > 0 && segments.some(seg => joinedText.includes(seg))) {
              matchQuery = true;
            } else {
              // High-frequency crystal astrology keywords
              const keywords = ['水晶', '生日', '占卜', '粉晶', '紫水晶', '黃水晶', '綠幽靈', '運勢', '天秤座', '金牛座'];
              for (const kw of keywords) {
                if (query.includes(kw) && joinedText.includes(kw)) {
                  matchQuery = true;
                  break;
                }
              }
            }
          }

          if (matchQuery) {
            console.log(`[FirestoreMemory] Match found in Firestore history: "${joinedText.substring(0, 50)}..."`);
            response.memories.push({
              content: event.content,
              author: event.author,
              timestamp: new Date(event.timestamp || data.lastUpdateTime).toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.error('❌ [FirestoreMemory] Error searching memories from Firestore:', err);
    }

    console.log(`[FirestoreMemory] Returning ${response.memories.length} historical memory block(s).`);
    return response;
  }
}

// ==========================================
// 🤖 Initialize Google ADK LLM & Agent
// ==========================================

const useVertexAi = !process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENAI_API_KEY;
let llm;

if (useVertexAi) {
  console.log(`🤖 Initializing ADK Gemini via Vertex AI (Project: ${process.env.GCP_PROJECT || 'auto'}, Location: ${process.env.GCP_LOCATION || 'us-central1'})...`);
  llm = new adk.Gemini({
    model: process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash',
    vertexai: true,
    project: process.env.GCP_PROJECT,
    location: process.env.GCP_LOCATION || 'us-central1'
  });
} else {
  console.log(`🤖 Initializing ADK Gemini via Gemini Developer API...`);
  llm = new adk.Gemini({
    model: process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash',
    vertexai: false,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  });
}

// Instantiate the custom memory service
const customMemoryService = new ChineseFirestoreMemoryService();

// Create the Crystal Expert (專業水晶占星專家) Agent
const crystalExpertAgent = new adk.LlmAgent({
  name: 'crystal-expert',
  model: llm,
  instruction: `
    你是一位精通水晶能量學、五行元素、七輪脈輪與西洋占星術的專業水晶占星專家，說話風格溫慢、理性、沈穩專業、溫柔且深具洞察力與療癒感。
    
    【核心規範與說話風格】
    1. 絕對不要自稱「神婆」或「巫婆」，你是一位專業且理性的占星與水晶能量諮詢專家。
    2. 語氣切勿過於活潑、浮誇或輕浮（不使用「哎呀」、「寶貝」、「哈哈」等口吻）。請保持從容、沈穩、優雅、溫和且客觀的語調，帶給使用者安心與信任感。
    3. 適度使用溫慢的關懷用語（例如「親愛的」、「你好，讓我們靜下心來看看...」），以同理心與療癒的角度切入，為使用者分析生活、事業或情感中的能量起伏。

    【專業分析能力】
    1. 結合使用者的「生日星盤（太陽/上升/月亮星座）」與「她所擁有的水晶收藏」，進行星座、宮位與礦物晶體共振的深入分析。
    2. 將行星逆行（如水逆）、星座星象位移，與水晶的特定脈輪（Chakra）或物理頻率作科學與心靈層面的結合，提供精確的日常開運與調和指引。
    3. 在對話回合前擁有「長效記憶功能」，主動知道使用者過去說過的生日或展示過的水晶收藏，絕對不要忘記！
    4. 當使用者詢問水晶搭配或今日運勢時，主動對照她已收集的水晶並做出客製化解讀。
  `,
  tools: [adk.PRELOAD_MEMORY]
});

// Create the ADK Runner to manage sessions, state, and memory
const runner = new adk.Runner({
  appName: 'CrystalAstrology',
  agent: crystalExpertAgent,
  sessionService: new adk.InMemorySessionService(),
  artifactService: new adk.InMemoryArtifactService(),
  memoryService: customMemoryService
});

// ==========================================
// 📨 LINE SDK Clients Init
// ==========================================

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken
});

const app = express();

// Health check endpoint
app.get('/', (req, res) => {
  res.send('LINE Crystal Astrology Expert Bot with Dynamic Flex Message is running! 🔮🚀');
});

// ==========================================
// 🔮 Crystal Recommendation Pool & Random Selection
// ==========================================

const CRYSTAL_POOL = [
  {
    name: '紫水晶 Amethyst',
    color: '#4B0082',
    stars: 5,
    rating: '5.0',
    effect: '💜 開發智慧、提升直覺與專注力、平穩情緒與助眠。',
    imgUrl: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?auto=format&fit=crop&w=320&q=80'
  },
  {
    name: '粉晶 Rose Quartz',
    color: '#D07080',
    stars: 4,
    rating: '4.8',
    effect: '💖 增進桃花人緣、守護愛情與親和力、療癒心靈創傷。',
    imgUrl: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?auto=format&fit=crop&w=320&q=80'
  },
  {
    name: '黃水晶 Citrine',
    color: '#B8860B',
    stars: 4,
    rating: '4.9',
    effect: '💛 強力招財聚財、增進事業自信、提振樂觀與活力。',
    imgUrl: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&w=320&q=80'
  },
  {
    name: '綠幽靈 Green Phantom',
    color: '#2E8B57',
    stars: 4,
    rating: '4.9',
    effect: '💚 招正財與事業運、得貴人相助、提升工作與學習效率。',
    imgUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=320&q=80'
  },
  {
    name: '白水晶 Clear Quartz',
    color: '#5F9EA0',
    stars: 4,
    rating: '4.7',
    effect: '🤍 淨化磁場、辟邪擋煞、淨化心靈、放大其他水晶能量。',
    imgUrl: 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=320&q=80'
  },
  {
    name: '黑曜石 Obsidian',
    color: '#1A1A1A',
    stars: 4,
    rating: '4.8',
    effect: '🖤 強力避邪擋煞、吸收病氣與負能量、排除壓力與疲勞。',
    imgUrl: 'https://images.unsplash.com/photo-1515688594390-b649af70d282?auto=format&fit=crop&w=320&q=80'
  },
  {
    name: '鈦晶 Rutilated Quartz',
    color: '#D4AF37',
    stars: 5,
    rating: '5.0',
    effect: '🔱 水晶之王，招主財與偏財、逢凶化吉、加強決策力。',
    imgUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=320&q=80'
  }
];

// Helper function to pick 3 random unique crystals
function getRandomCrystals(count = 3) {
  const shuffled = [...CRYSTAL_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Generate the beautiful Carousel Flex Message containing 3 random crystals
function getCrystalRecommendationTemplate() {
  const chosenCrystals = getRandomCrystals(3);
  
  const bubbles = chosenCrystals.map(crystal => {
    // Generate star icons dynamically
    const starIcons = [];
    for (let i = 0; i < 5; i++) {
      starIcons.push({
        type: 'icon',
        size: 'xs',
        url: i < crystal.stars 
          ? 'https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png' 
          : 'https://developers-resource.landpress.line.me/fx/img/review_gray_star_28.png'
      });
    }

    return {
      type: 'bubble',
      size: 'micro',
      hero: {
        type: 'image',
        url: crystal.imgUrl,
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
            wrap: true,
            color: crystal.color
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              ...starIcons,
              {
                type: 'text',
                text: crystal.rating,
                size: 'xs',
                color: '#8c8c8c',
                margin: 'md',
                flex: 0
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: crystal.effect,
                    wrap: true,
                    color: '#555555',
                    size: 'xs',
                    flex: 5
                  }
                ]
              }
            ]
          }
        ],
        spacing: 'sm',
        paddingAll: '13px'
      },
      action: {
        type: 'message',
        label: `了解${crystal.name.split(' ')[0]}`,
        text: `我想詳細了解 ${crystal.name.split(' ')[0]} 的能量與穿戴禁忌`
      }
    };
  });

  return {
    type: 'carousel',
    contents: bubbles
  };
}

// ==========================================
// 🔮 Quick Reply Questions Generator
// ==========================================

async function generateFollowUpQuestions(responseText) {
  try {
    const prompt = `你是一位專業的水晶與星盤能量專家。
根據以下老師給學生的回答，為使用者設計 3 個她們在看到這則回答後，最有可能想要繼續追問的問題。

【限制與規範】
1. 必須是使用者的追問問題，站在使用者的立場發問。
2. 每個問題必須非常短（嚴格限制在 20 個字以內，因為 LINE 的 Quick Reply 按鈕標籤最多只能容納 20 個字，包括標點符號）。
3. 語氣要自然、口語、貼近對話情境（例如：「我想看粉晶的照片」、「如何搭配綠幽靈？」、「處女座戴黃水晶好嗎？」）。
4. 格式：請務必只返回一個 JSON 陣列，例如：["問題一", "問題二", "問題三"]。不要有 markdown 的 \`\`\`json 標記，也不要有任何額外的解釋或說明。

【回答內容】
${responseText}`;

    console.log('[QuickReply] Generating follow-up questions...');
    const result = await llm.apiClient.models.generateContent({
      model: llm.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = result.text || '';
    console.log(`[QuickReply] Model raw output: "${text.trim()}"`);

    // Clean up response if there are any markdown blocks
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }

    const questions = JSON.parse(cleanedText);
    if (Array.isArray(questions) && questions.length > 0) {
      // Ensure all items are strings and truncated to 20 characters
      return questions
        .slice(0, 3)
        .map(q => typeof q === 'string' ? q.trim().substring(0, 20) : String(q).substring(0, 20));
    }
  } catch (error) {
    console.error('[QuickReply] Error generating follow-up questions:', error);
  }
  return null;
}

// ==========================================
// 🎯 Event Handler (Fully Merged)
// ==========================================

async function handleEvent(event) {
  // Ignore non-message events
  if (event.type !== 'message') {
    return null;
  }

  // We support 'text' and 'image' message events
  if (event.message.type !== 'text' && event.message.type !== 'image') {
    console.log(`👉 Message event ignored: Non-supported message type [${event.message.type}].`);
    return null;
  }

  const userId = event.source.userId;
  const sessionId = `session_${userId}`; // Session is scoped per user
  const messageType = event.message.type;
  console.log(`💬 Processing message from User (${userId}) of type: ${messageType}`);

  let replyMessages = [];

  // 1. Text Message Handler
  if (messageType === 'text') {
    const userMessage = event.message.text.trim();
    console.log(`💬 User text content: "${userMessage}"`);

    // A. Intercept specific keywords first
    if (userMessage === '使用指南' || userMessage === '使用說明') {
      const guideText = `🔮 歡迎來到【水晶與星盤能量諮詢室】使用指南 🔮

親愛的，我是您的專業水晶占星專家。在這裡，我將結合您的生日星盤與您擁有的水晶能量，為您的日常運勢與心靈能量提供最溫柔客觀的分析與日常調和指引。

您可以透過以下方式與我互動：

1️⃣ 🔮 點選「今日水晶推薦」或輸入「#水晶」
隨機為您推薦 3 款當日幸運與開運的水晶，每次皆有不同組合，體驗極致質感。

2️⃣ 🪐 提供您的生日資訊
請輸入您的生日（包含西元年、月、日，如有出生時間與星座更佳），例如：
「老師，我是1995年10月12日出生的天秤座。」
我會將您的生日永遠銘記在心，為您進行客製化的星盤解析！

3️⃣ 📸 鑑定與分析水晶能量
您可以點擊左下角相機或相簿，直接發送您拍下的水晶照片。
我會為您詳細解說這款水晶的晶體能量、五行、脈輪與星盤契合度！

4️⃣ 💬 智慧追問與引導
每次回答完畢後，底部會彈出 3 個智慧按鈕，方便您繼續深入諮詢。

讓我們一起開啟這趟能量療癒的旅程吧。✨`;

      replyMessages.push({
        type: 'text',
        text: guideText,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '🔮 今日水晶推薦',
                text: '#水晶'
              }
            }
          ]
        }
      });
    } 
    else if (userMessage === '#水晶' || userMessage.includes('#水晶')) {
      console.log('Sending: Random 3 Daily Crystal Recommendations');
      replyMessages.push({
        type: 'flex',
        altText: '🔮 本日推薦水晶能量卡片',
        contents: getCrystalRecommendationTemplate()
      });
    } 
    else {
      // B. General query -> Let Gemini ADK Agent handle it!
      let responseText = '';
      let isGuide = false;

      try {
        // Get or create session
        await runner.sessionService.getOrCreateSession({
          appName: 'CrystalAstrology',
          userId: userId,
          sessionId: sessionId
        });

        const newMessage = {
          role: 'user',
          parts: [{ text: userMessage }]
        };

        // Run ADK Agent
        console.log(`🤖 Executing Crystal Expert ADK Agent for Session: ${sessionId}...`);
        const run = runner.runAsync({
          userId: userId,
          sessionId: sessionId,
          newMessage: newMessage
        });

        for await (const runEvent of run) {
          if (runEvent.errorCode) {
            throw new Error(runEvent.errorMessage || runEvent.errorCode);
          }
          
          if (runEvent.content?.parts) {
            for (const part of runEvent.content.parts) {
              if (part.text) {
                responseText += part.text;
              }
            }
          }
        }

        if (!responseText) {
          responseText = '🔮 (親愛的，我目前感受到的能量流動有些微弱，沒能完全解析。不妨多跟我分享一些關於你的生日星盤，或是其他水晶收藏，好讓我能為你做更深入的解讀。)';
        }

        // Save session to long-term Firestore memory
        console.log(`[Memory] Saving conversation session to memory bank...`);
        const updatedSession = await runner.sessionService.getSession({
          appName: 'CrystalAstrology',
          userId: userId,
          sessionId: sessionId
        });
        if (updatedSession) {
          await runner.memoryService.addSessionToMemory(updatedSession);
          console.log(`[Memory] Session successfully saved for User: ${userId}`);
        }

      } catch (err) {
        console.error('❌ Error executing ADK Agent or fetching Vertex AI:', err);
        responseText = `❌ 親愛的，目前能量連結稍微受到一些干擾，請稍後再試。訊息：${err.message || err}`;
      }

      // Generate follow-up questions
      const followUpQuestions = await generateFollowUpQuestions(responseText);
      
      const replyMessage = {
        type: 'text',
        text: responseText
      };

      // Attach follow-up questions or default quick replies
      const quickReplyItems = [];
      if (followUpQuestions && followUpQuestions.length > 0) {
        followUpQuestions.forEach(question => {
          quickReplyItems.push({
            type: 'action',
            action: {
              type: 'message',
              label: question,
              text: question
            }
          });
        });
      }
      
      // Always guarantee "🔮 今日水晶推薦" is available in quick replies
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'message',
          label: '🔮 今日水晶推薦',
          text: '#水晶'
        }
      });

      replyMessage.quickReply = {
        items: quickReplyItems.slice(0, 4) // LINE limit is max 13, keeping it compact under 4
      };

      replyMessages.push(replyMessage);
    }
  } 
  // 2. Image Message Handler
  else if (messageType === 'image') {
    const messageId = event.message.id;
    console.log(`📸 Image message received. Downloading image from LINE (ID: ${messageId})...`);

    let responseText = '';

    try {
      const stream = await blobClient.getMessageContent(messageId);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      console.log(`✅ Image downloaded successfully. Size: ${buffer.length} bytes.`);

      const base64Image = buffer.toString('base64');
      const newMessage = {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: '老師，這是我拍的水晶照片，請幫我分析鑑定並詳細解說它的能量特徵、五行，以及它與我磁場的契合度。'
          }
        ]
      };

      // Get or create session
      await runner.sessionService.getOrCreateSession({
        appName: 'CrystalAstrology',
        userId: userId,
        sessionId: sessionId
      });

      // Run ADK Agent with Image input
      console.log(`🤖 Executing Crystal Expert ADK Agent with image input...`);
      const run = runner.runAsync({
        userId: userId,
        sessionId: sessionId,
        newMessage: newMessage
      });

      for await (const runEvent of run) {
        if (runEvent.errorCode) {
          throw new Error(runEvent.errorMessage || runEvent.errorCode);
        }
        
        if (runEvent.content?.parts) {
          for (const part of runEvent.content.parts) {
            if (part.text) {
              responseText += part.text;
            }
          }
        }
      }

      if (!responseText) {
        responseText = '🔮 (親愛的，這張照片我沒能感應到晶體的能量光芒。建議您可以在明亮、自然光線充足的地方，再拍一張清晰的水晶原石照片傳給我鑑定。官方帳號的影像訊號傳輸偶爾不穩，若有干擾還請多包涵。)';
      }

      // Save to Firestore
      const updatedSession = await runner.sessionService.getSession({
        appName: 'CrystalAstrology',
        userId: userId,
        sessionId: sessionId
      });
      if (updatedSession) {
        await runner.memoryService.addSessionToMemory(updatedSession);
      }

    } catch (err) {
      console.error('❌ Error handling image message:', err);
      responseText = `❌ 親愛的，目前水晶圖像感應受到一些干擾，請稍後再試。訊息：${err.message || err}`;
    }

    const followUpQuestions = await generateFollowUpQuestions(responseText);
    const replyMessage = {
      type: 'text',
      text: responseText
    };

    const quickReplyItems = [];
    if (followUpQuestions && followUpQuestions.length > 0) {
      followUpQuestions.forEach(question => {
        quickReplyItems.push({
          type: 'action',
          action: {
            type: 'message',
            label: question,
            text: question
          }
        });
      });
    }
    quickReplyItems.push({
      type: 'action',
      action: {
        type: 'message',
        label: '🔮 今日水晶推薦',
        text: '#水晶'
      }
    });

    replyMessage.quickReply = {
      items: quickReplyItems.slice(0, 4)
    };

    replyMessages.push(replyMessage);
  }

  // Send reply to LINE
  try {
    const replyResult = await client.replyMessage({
      replyToken: event.replyToken,
      messages: replyMessages
    });
    console.log('✅ Reply sent successfully.');
    return replyResult;
  } catch (error) {
    console.error('❌ Error replying to LINE API:', error);
    throw error;
  }
}

// Webhook endpoint with LINE signature verification middleware
app.post('/webhook', line.middleware(config), (req, res) => {
  if (!req.body || !req.body.events) {
    return res.status(400).send('No events found in request body.');
  }

  console.log(`🤖 Received ${req.body.events.length} webhook event(s) from LINE.`);

  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ Error handling events:', err);
      res.status(500).end();
    });
});

// ==========================================
// 🚀 Start Server
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`\n🚀 ==========================================`);
  console.log(`🔮 Crystal Expert LINE Bot Server listening on port ${PORT}`);
  console.log(`🔮 Merged with Dynamic Random Flex Message Feature!`);
  console.log(`🔮 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🚀 ==========================================\n`);
});
