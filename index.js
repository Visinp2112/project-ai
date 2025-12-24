import makeWASocket, { 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  DisconnectReason 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

// ======================
// 1. SETUP GROQ AI (100% GRATIS)
// ======================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 300;

if (!GROQ_API_KEY) {
  console.error('❌ ERROR: GROQ_API_KEY tidak ditemukan di file .env');
  console.error('👉 Dapatkan API key GRATIS di: https://console.groq.com');
  console.error('💡 No credit card required! Langsung dapat key');
  process.exit(1);
}

console.log('🚀 WhatsApp Bot dengan Groq AI');
console.log(`📌 Model: ${GROQ_MODEL}`);
console.log('💰 STATUS: 100% GRATIS (no credit card needed)');
console.log('📊 Rate limit: 30 requests/minute (cukup untuk bot)');

// Inisialisasi Groq client
const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

// Simpan history pesan bot (untuk deteksi reply)
const botMessageHistory = new Map();

// Available Groq models (semua gratis)
const GROQ_MODELS = [
  'llama3-8b-8192',      // Cepat & efisien
  'mixtral-8x7b-32768',  // Lebih pintar
  'llama3-70b-8192',     // Sangat pintar
  'gemma2-9b-it'         // Alternatif Google
];

async function callGroq(prompt) {
  const startTime = Date.now();
  
  try {
    console.log(`🤖 [${GROQ_MODEL}] Mengirim: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `Kamu adalah asisten AI di WhatsApp. 
          • Gunakan Bahasa Indonesia yang natural
          • Jawab dengan singkat dan ramah
          • Format: langsung ke inti
          • Jangan terlalu formal`
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      stream: false,
    });
    
    const response = completion.choices[0].message.content;
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Groq merespon (${responseTime}ms)`);
    console.log(`📏 Response length: ${response.length} karakter`);
    
    return response;
    
  } catch (error) {
    console.error('❌ Error dari Groq:', error.message);
    
    // Auto fallback ke model lain jika error
    if (error.status === 429 || error.type === 'rate_limit_exceeded') {
      console.log('⏳ Rate limit exceeded, coba model lain...');
      
      for (const model of GROQ_MODELS) {
        if (model !== GROQ_MODEL) {
          console.log(`🔄 Coba fallback ke: ${model}`);
          try {
            const fallback = await groq.chat.completions.create({
              model: model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: MAX_TOKENS,
            });
            return fallback.choices[0].message.content;
          } catch (fallbackError) {
            console.log(`❌ ${model} juga error, coba lagi...`);
          }
        }
      }
    }
    
    return 'Maaf, AI sedang sibuk. Coba lagi beberapa saat ya!';
  }
}

// ======================
// 2. WHATSAPP BOT (WAJIB TAG/REPLY di GRUP)
// ======================
async function startBot() {
  console.log('='.repeat(60));
  console.log('🤖 WHATSAPP BOT DENGAN GROQ AI');
  console.log('='.repeat(60));
  console.log(`📌 Model: ${GROQ_MODEL}`);
  console.log('💰 GRATIS: No credit card, no billing');
  console.log('📱 Mode: Private auto-response, Grup wajib tag/reply');
  console.log('='.repeat(60));
  
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['Groq WhatsApp Bot', 'Chrome', '1.0.0'],
    emitOwnEvents: true,
    connectTimeoutMs: 60000,
  });
  
  // ============================================
  // A. FUNGSI UTAMA: CEK TAG & REPLY
  // ============================================
  function shouldRespondToMessage(msg) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text ||
                 msg.message.imageMessage?.caption || '';
    
    // 1. GET BOT NUMBER
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // 2. CEK MENTION (@TAG)
    const isMentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botNumber);
    
    // 3. CEK REPLY KE PESAN BOT
    let isReplyToBot = false;
    const quotedMsgId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
    
    if (quotedMsgId && botMessageHistory.has(quotedMsgId)) {
      isReplyToBot = true;
    }
    
    // 4. LOGIKA RESPON
    if (!isGroup) {
      // PRIVATE CHAT: Selalu response
      return { shouldRespond: true, cleanText: text, isGroup: false };
    }
    
    // GRUP: Hanya response jika ditag ATAU reply ke bot
    if (isMentioned || isReplyToBot) {
      let cleanText = text;
      
      // Hapus tag dari teks jika ada
      if (isMentioned) {
        cleanText = text.replace(`@${botNumber.split('@')[0]}`, '').trim();
      }
      
      return { 
        shouldRespond: true, 
        cleanText: cleanText || text, 
        isGroup: true
      };
    }
    
    // Abaikan pesan grup lain
    return { shouldRespond: false };
  }
  
  // ============================================
  // B. EVENT HANDLERS
  // ============================================
  
  // Event: Connection Update
  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;
    
    if (qr) {
      console.log('\n' + '='.repeat(60));
      console.log('📱 SCAN QR CODE UNTUK WHATSAPP');
      console.log('='.repeat(60));
      
      // Tampilkan QR di terminal
      qrcode.generate(qr, { small: true });
      
      // Tampilkan link untuk scan via browser
      console.log('\n🔗 ATAU BUKA LINK INI untuk QR Code gambar:');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      console.log(qrUrl);
      
      console.log('\n💡 CARA SCAN:');
      console.log('1. Screenshot QR di atas → zoom in → scan');
      console.log('2. ATAU buka link di browser → scan gambar');
      console.log('3. WhatsApp → Settings → Linked Devices → Link a Device');
      console.log('='.repeat(60));
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      console.log(`⚠️ Koneksi terputus. Reconnect? ${shouldReconnect}`);
      
      if (shouldReconnect) {
        console.log('🔄 Menghubungkan ulang dalam 3 detik...');
        setTimeout(() => startBot(), 3000);
      } else {
        console.log('❌ Sudah logout. Hapus folder auth_info lalu scan ulang.');
      }
    }
    
    if (connection === 'open') {
      console.log('✅ WhatsApp Connected! Bot ready.');
      console.log(`🤖 Model aktif: ${GROQ_MODEL}`);
      console.log('📩 Kirim pesan untuk test...');
    }
  });
  
  // Event: Save Credentials
  sock.ev.on('creds.update', saveCreds);
  
  // Event: New Messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    
    // Skip jika bukan pesan teks atau dari kita sendiri
    if (!msg.message || msg.key.fromMe) return;
    
    // Cek apakah pesan perlu direspon
    const responseCheck = shouldRespondToMessage(msg);
    
    if (!responseCheck.shouldRespond) {
      return; // Abaikan pesan (khusus grup yang bukan tag/reply)
    }
    
    const { cleanText, isGroup } = responseCheck;
    const sender = msg.key.remoteJid;
    
    console.log(`\n${isGroup ? '👥 [GRUP]' : '💬 [PRIVATE]'} Pesan: "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`);
    
    // Kirim "typing" indicator
    await sock.sendPresenceUpdate('composing', sender);
    
    try {
      // Dapatkan response dari Groq AI
      const aiResponse = await callGroq(cleanText);
      
      // Format response untuk grup
      const finalResponse = isGroup ? `🤖 ${aiResponse}` : aiResponse;
      
      // Hentikan "typing" dan kirim balasan
      await sock.sendPresenceUpdate('paused', sender);
      const sentMsg = await sock.sendMessage(sender, { text: finalResponse });
      
      // SIMPAN ID pesan bot ke history (untuk deteksi reply)
      if (sentMsg.key?.id) {
        botMessageHistory.set(sentMsg.key.id, Date.now());
        
        // Bersihkan history lama (lebih dari 2 jam)
        const twoHoursAgo = Date.now() - 7200000;
        for (const [msgId, timestamp] of botMessageHistory.entries()) {
          if (timestamp < twoHoursAgo) {
            botMessageHistory.delete(msgId);
          }
        }
      }
      
      console.log(`📤 Response terkirim (${finalResponse.length} chars)`);
      
    } catch (error) {
      console.error('❌ Error mengirim pesan:', error.message);
      await sock.sendMessage(sender, { 
        text: 'Maaf, terjadi kesalahan. Coba lagi nanti ya!' 
      });
    }
  });
  
  // ============================================
  // C. HELPER FUNCTIONS
  // ============================================
  
  // Fungsi untuk ganti model runtime
  function switchModel(newModel) {
    if (GROQ_MODELS.includes(newModel)) {
      console.log(`🔄 Switching model: ${GROQ_MODEL} → ${newModel}`);
      GROQ_MODEL = newModel;
      return true;
    }
    return false;
  }
  
  // Tampilkan bot info
  function showBotInfo() {
    console.log('\n' + '='.repeat(50));
    console.log('🤖 BOT INFORMATION');
    console.log('='.repeat(50));
    console.log(`Model: ${GROQ_MODEL}`);
    console.log(`Message History: ${botMessageHistory.size} pesan`);
    console.log(`Available Models: ${GROQ_MODELS.join(', ')}`);
    console.log('='.repeat(50));
  }
  
  // Auto show info setiap 15 menit
  setInterval(showBotInfo, 900000);
}

// ======================
// 3. ERROR HANDLING
// ======================
process.on('uncaughtException', (error) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// ======================
// 4. START BOT
// ======================
startBot().catch(console.error);