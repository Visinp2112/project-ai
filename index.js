require('dotenv').config(); // WAJIB PALING ATAS

const venom = require('venom-bot');
const axios = require('axios');

// validasi env saat start
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY belum diset');
  process.exit(1);
}

// Buat bot
venom
  .create({
    session: 'ai-bot',
    multidevice: true,
    disableSpins: true,
    headless: true
  })
  .then(client => start(client))
  .catch(err => console.error('Venom create error:', err));

function start(client) {
  console.log('Bot WA siap jalan');

  client.onStateChange(state => {
    console.log('State changed:', state);
    if (state === 'CONFLICT' || state === 'UNPAIRED') {
      client.forceRefocus();
    }
  });

  client.onMessage(async message => {
    if (!message.body || !message.body.startsWith('!ai ')) return;

    const prompt = message.body.slice(4).trim();
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

      const answer = response.data?.answer || 'AI tidak bisa menjawab';
      await client.sendText(message.from, answer);

    } catch (error) {
      console.error('AI Error:', error.response?.data || error.message);
      await client.sendText(
        message.from,
        'Terjadi error saat memanggil AI'
      );
    }
  });
}
