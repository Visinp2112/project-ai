const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Buat client WA
const client = new Client({ authStrategy: new LocalAuth() });

// QR code untuk login
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Scan QR pakai WhatsApp di HP kamu!');
});

// Siap
client.on('ready', () => {
    console.log('Bot WA siap jalan!');
});

// Auto-reply AI
client.on('message', async msg => {
    if (msg.body.startsWith('!ai ')) {
        const prompt = msg.body.slice(4); // hapus "!ai "
        try {
            const response = await axios.post('https://api.deepseek.com/v1/query', {
                prompt: prompt
            }, {
                headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
            });

            const answer = response.data.answer || 'AI tidak bisa menjawab';
            msg.reply(answer);

        } catch (error) {
            console.log(error);
            msg.reply('Terjadi error saat memanggil AI, Coba lagi nanti.');
        }
    }
});

// Initialize bot
client.initialize();
