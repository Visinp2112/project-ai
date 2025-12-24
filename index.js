require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const axios = require('axios');
const Pino = require('pino');

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY belum diset');
  process.exit(1);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        startBot();
      }
    }
    if (connection === 'open') {
      console.log('Bot WA siap (Baileys)');
    }
  });

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

    } catch (err) {
      console.error('AI Error:', err.response?.data || err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Terjadi error saat memanggil AI'
      });
    }
  });
}

startBot();
