
const { Redis } = await import('@upstash/redis');
const { config } = await import('dotenv');
const { resolve } = await import('path');
const { readFileSync } = await import('fs');
const { fileURLToPath } = await import('url');

// Load env
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
}

const redis = new Redis({
  url: env.STORAGE_REST_API_URL || env.KV_REST_API_URL,
  token: env.STORAGE_REST_API_TOKEN || env.KV_REST_API_TOKEN,
});

const NEW_CONTRACT = 'CDLEEXCKX2O2X3CYBWDAPO5BJWNWP5H45AL3AXJFKR46D6WGDEPBNUZO';

// Load markets.json
const markets = JSON.parse(readFileSync(resolve(process.cwd(), './data/markets.json'), 'utf8'));
markets.forEach(m => m.contractAddress = NEW_CONTRACT);

// Seed 32 users
const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const seedUsers = Array.from({ length: 32 }, () => {
  let r = '';
  for (let j = 0; j < 55; j++) r += alpha[Math.floor(Math.random() * 32)];
  return r.substring(0,55);
});

try {
  await redis.set('markets', markets);
  console.log('✅ Markets saved to Redis with contract:', NEW_CONTRACT);
  
  await redis.set('users', seedUsers);
  console.log('✅ 32 users seeded');
  
  console.log('\n🚀 DONE! Refresh your browser now.');
} catch(e) {
  console.error('❌ Error:', e.message);
}
