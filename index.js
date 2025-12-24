require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const axios = require('axios');
const Pino = require('pino');

// pastikan env ada
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY belum diset');
  process.exit(1);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: 'silent' })
  });

  // simpan session
  sock.ev.on('creds.update', saveCreds);

  // koneksi & QR
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('================ QR CODE ================');
      console.log(qr);
      console.log('=========================================');
      console.log('Scan QR ini di WhatsApp HP kamu');
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log('Reconnect...');
        startBot();
      } else {
        console.log('Logged out, scan ulang QR');
      }
    }

    if (connection === 'open') {
      console.log('Bot WhatsApp siap (Baileys)');
    }
  });

  // listener pesan
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text || !text.startsWith('!ai ')) return;

    const prompt = text.slice(4).trim();
    if (!prompt) return;

    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/query',
        { prompt },
        {
          headers: {
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const answer =
        response.data?.answer || 'AI tidak bisa menjawab';

      await sock.sendMessage(msg.key.remoteJid, { text: answer });

    } catch (error) {
      console.error(
        'AI Error:',
        error.response?.data || error.message
      );
      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Terjadi error saat memanggil AI'
      });
    }
  });
}

startBot();
