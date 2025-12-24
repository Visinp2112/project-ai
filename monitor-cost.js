import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

async function monitorCost() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-4';
  
  console.log('💰 GPT-4 Cost Monitoring');
  console.log('=======================');
  
  // Prices per 1K tokens (USD)
  const prices = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  };
  
  const price = prices[model] || prices['gpt-4'];
  
  console.log(`📌 Model: ${model}`);
  console.log(`💵 Input: $${price.input}/1K tokens`);
  console.log(`💵 Output: $${price.output}/1K tokens`);
  console.log('');
  
  // Contoh perhitungan
  console.log('📊 CONTOH PERHITUNGAN:');
  console.log('1. Chat singkat (100 token):');
  console.log(`   • Input (50t): $${(50/1000 * price.input).toFixed(6)}`);
  console.log(`   • Output (50t): $${(50/1000 * price.output).toFixed(6)}`);
  console.log(`   • Total: $${((50/1000 * price.input) + (50/1000 * price.output)).toFixed(6)}`);
  console.log('');
  console.log('2. $5 credit bisa dapat:');
  const avgTokens = 300; // Rata-rata per chat
  const avgCost = (avgTokens/1000 * price.input) + (avgTokens/1000 * price.output);
  const requestsPossible = Math.floor(5 / avgCost);
  console.log(`   • ~${requestsPossible} requests (asumsi ${avgTokens} tokens/request)`);
  console.log('');
  console.log('💡 TIPS:');
  console.log('1. Gunakan MAX_TOKENS kecil di .env');
  console.log('2. Jangan pakai di grup besar');
  console.log('3. Monitor di: https://platform.openai.com/usage');
}

monitorCost();