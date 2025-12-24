const venom = require('venom-bot');
const axios = require('axios');

// Buat client WA pakai Venom
venom
  .create({
    session: 'ai-bot',      // nama session, bisa bebas
    multidevice: true        // gunakan mode multi-device WA
  })
  .then(client => start(client))
  .catch(err => console.error(err));

function start(client) {
  console.log('Bot WA siap jalan!');

  // Auto-reply AI
  client.onMessage(async message => {
    if (message.body.startsWith('!ai ')) {
      const prompt = message.body.slice(4); // hapus "!ai "
      try {
        const response = await axios.post(
          'https://api.deepseek.com/v1/query',
          { prompt },
          {
            headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
          }
        );

        const answer = response.data.answer || 'AI tidak bisa menjawab';
        await client.sendText(message.from, answer);

      } catch (error) {
        console.log(error);
        await client.sendText(message.from, 'Terjadi error saat memanggil AI, coba lagi nanti.');
      }
    }
  });
}
