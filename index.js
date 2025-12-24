const venom = require('venom-bot');
const axios = require('axios');

// Buat bot
venom
  .create({
    session: 'ai-bot',       // nama session, bisa bebas
    multidevice: true,        // pakai mode multi-device
    disableSpins: true,       // matikan spinner Venom, lebih clean di logs
    headless: true            // jalankan headless, cocok untuk server
  })
  .then(client => start(client))
  .catch(err => console.error('Venom create error:', err));

function start(client) {
  console.log('Bot WA siap jalan!');

  // Auto-reconnect jika disconnect
  client.onStateChange(state => {
    console.log('State changed:', state);
    if (state === 'CONFLICT' || state === 'UNPAIRED') {
      console.log('Reconnecting...');
      client.forceRefocus();
    }
  });

  // Auto-reply AI
  client.onMessage(async message => {
    if (message.body && message.body.startsWith('!ai ')) {
      const prompt = message.body.slice(4).trim();

      try {
        if (!process.env.DEEPSEEK_API_KEY) {
          throw new Error('DEEPSEEK_API_KEY belum diset di environment variables!');
        }

        const response = await axios.post(
          'https://api.deepseek.com/v1/query',
          { prompt },
          { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
        );

        const answer = response.data.answer || 'AI tidak bisa menjawab';
        await client.sendText(message.from, answer);

      } catch (error) {
        console.error('Axios/AI Error:', error.response?.data || error.message);
        await client.sendText(message.from, 'Terjadi error saat memanggil AI, coba lagi nanti.');
      }
    }
  });
}
