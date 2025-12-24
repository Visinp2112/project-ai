import makeWASocket, { 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  DisconnectReason 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// ======================
// 1. SETUP OPENAI GPT-4o
// ======================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';  // ⭐ GPT-4o! (Bukan gpt-4)
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 300;

if (!OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY tidak ditemukan');
  console.error('👉 Dapatkan di: https://platform.openai.com/api-keys');
  process.exit(1);
}

console.log(`🚀 MODEL YANG DIGUNAKAN: ${OPENAI_MODEL}`);
console.log(`💰 INFO: GPT-4o lebih murah dari GPT-4!`);
console.log(`📊 Token limit: ${MAX_TOKENS} per response`);

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const botMessageHistory = new Map();

// Track usage untuk monitoring cost
let usageStats = {
  totalRequests: 0,
  estimatedCost: 0,
  lastReset: Date.now()
};

async function callGPT4o(prompt) {  // ⭐ Ganti nama fungsi
  const startTime = Date.now();
  
  try {
    console.log(`🤖 [${OPENAI_MODEL}] Mengirim: "${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}"`);
    
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `Kamu adalah asisten AI di WhatsApp. 
          Gunakan Bahasa Indonesia yang natural dan ramah.
          Jawab dengan singkat (maksimal ${MAX_TOKENS/5} kata).
          Format: langsung ke inti, tanpa salam berlebihan.` 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
    });
    
    const response = completion.choices[0].message.content;
    const tokensUsed = completion.usage?.total_tokens || 100;
    
    // Hitung estimated cost (GPT-4o lebih murah)
    const costPerToken = OPENAI_MODEL.includes('gpt-4o') ? 0.000015 :  // GPT-4o
                         OPENAI_MODEL.includes('gpt-4') ? 0.00006 :   // GPT-4
                         0.000002;                                    // GPT-3.5
    const requestCost = tokensUsed * costPerToken;
    
    usageStats.totalRequests++;
    usageStats.estimatedCost += requestCost;
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ ${OPENAI_MODEL} merespon (${responseTime}ms)`);  // ⭐ Generic
    console.log(`💰 Token: ${tokensUsed} | Estimasi cost: $${requestCost.toFixed(6)}`);
    console.log(`📊 Total: ${usageStats.totalRequests} requests | $${usageStats.estimatedCost.toFixed(4)}`);
    
    return response;
    
  } catch (error) {
    console.error(`❌ Error dari ${OPENAI_MODEL}:`, error.message);
    
    // Fallback ke GPT-3.5 jika error
    if (error.status === 404 || error.status === 429) {
      console.log('🔄 Coba fallback ke GPT-3.5-turbo...');
      try {
        const fallback = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: MAX_TOKENS,
        });
        return fallback.choices[0].message.content;
      } catch (fallbackError) {
        return 'Maaf, quota AI sedang habis. Coba lagi besok ya!';
      }
    }
    
    return 'Maaf, terjadi kesalahan. Silakan coba lagi!';
  }
}

// ======================
// 2. WHATSAPP BOT DENGAN MONITORING
// ======================
async function startBot() {
  console.log('🚀 WhatsApp Bot dengan GPT-4o Active!');  // ⭐ UPDATE
  console.log('💰 INFO: GPT-4o = $0.015/1K tokens (lebih murah!)');  // ⭐ UPDATE
  console.log('📌 Mode: Wajib tag/reply di grup');
  
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['GPT-4o WhatsApp Bot', 'Chrome', '1.0.0']  // ⭐ UPDATE
  });
  
  // FUNGSI: Cek apakah perlu response
  function shouldRespondToMessage(msg) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || '';
    
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isMentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botNumber);
    
    let isReplyToBot = false;
    const quotedMsgId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
    if (quotedMsgId && botMessageHistory.has(quotedMsgId)) {
      isReplyToBot = true;
    }
    
    if (!isGroup) {
      console.log('💬 Private chat: Auto-response');
      return { shouldRespond: true, cleanText: text, isGroup: false };
    }
    
    if (isMentioned || isReplyToBot) {
      let cleanText = text;
      if (isMentioned) {
        cleanText = text.replace(`@${botNumber.split('@')[0]}`, '').trim();
        console.log('🏷️  Deteksi MENTION di grup');
      }
      return { shouldRespond: true, cleanText: cleanText || text, isGroup: true };
    }
    
    return { shouldRespond: false };
  }
  
  // EVENT: Connection Update
  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;
    
    if (qr) {
      console.log('📡 Scan QR Code:');
      qrcode.generate(qr, { small: true });
      
      // ⭐ TAMBAHKAN LINK QR
      console.log('\n🔗 ATAU BUKA LINK INI untuk QR Code gambar:');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      console.log(qrUrl);
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('🔄 Reconnecting...');
        setTimeout(() => startBot(), 3000);
      }
    }
    
    if (connection === 'open') {
      console.log('✅ WhatsApp Connected!');
      showUsageStats();
    }
  });
  
  sock.ev.on('creds.update', saveCreds);
  
  // EVENT: Messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    
    const responseCheck = shouldRespondToMessage(msg);
    if (!responseCheck.shouldRespond) return;
    
    const { cleanText, isGroup } = responseCheck;
    const sender = msg.key.remoteJid;
    
    console.log(`${isGroup ? '👥' : '💬'} User: "${cleanText.substring(0, 30)}..."`);
    
    // Cek credit sebelum kirim (jika < $0.01 left)
    if (usageStats.estimatedCost > 4.90) {
      console.log('⛔ CREDIT HAMPIR HABIS! ($5 limit)');
      await sock.sendMessage(sender, { 
        text: '⚠️ Maaf, credit AI hampir habis. Bot berhenti sementara.' 
      });
      return;
    }
    
    await sock.sendPresenceUpdate('composing', sender);
    
    try {
      const aiResponse = await callGPT4o(cleanText);  // ⭐ Ganti panggilan fungsi
      const finalResponse = isGroup ? `🤖 ${aiResponse}` : aiResponse;
      
      await sock.sendPresenceUpdate('paused', sender);
      const sentMsg = await sock.sendMessage(sender, { text: finalResponse });
      
      if (sentMsg.key?.id) {
        botMessageHistory.set(sentMsg.key.id, Date.now());
        // Clean old entries
        const oneHourAgo = Date.now() - 3600000;
        for (const [msgId, timestamp] of botMessageHistory.entries()) {
          if (timestamp < oneHourAgo) botMessageHistory.delete(msgId);
        }
      }
      
      console.log(`📤 Response sent!`);
      
    } catch (error) {
      console.error('❌ Error:', error);
      await sock.sendMessage(sender, { 
        text: 'Maaf, error. Coba lagi nanti!' 
      });
    }
  });
  
  // FUNGSI: Tampilkan stats
  function showUsageStats() {
    const remaining = 5 - usageStats.estimatedCost;
    console.log('📊 ========== USAGE STATS ==========');
    console.log(`💰 Credit used: $${usageStats.estimatedCost.toFixed(4)} / $5.00`);
    console.log(`💎 Remaining: $${remaining.toFixed(2)}`);
    console.log(`📈 Requests: ${usageStats.totalRequests}`);
    console.log(`📌 Model: ${OPENAI_MODEL}`);
    console.log('====================================');
    
    // Warning jika credit < $1
    if (remaining < 1.00) {
      console.log('🚨 PERINGATAN: Credit kurang dari $1!');
    }
  }
  
  // Tampilkan stats setiap 10 pesan
  setInterval(showUsageStats, 600000); // 10 menit
}

// ======================
// 3. START BOT
// ======================
startBot().catch(console.error);
