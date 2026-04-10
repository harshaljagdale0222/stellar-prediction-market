
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env.local') });

const redis = new Redis({
  url: process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || '',
  token: process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

const NEW_CONTRACT = 'CDLEEXCKX2O2X3CYBWDAPO5BJWNWP5H45AL3AXJFKR46D6WGDEPBNUZO';

async function resetDb() {
  console.log('--- RESETTING DATABASE WITH NEW CONTRACT ID ---');
  console.log('New Market ID:', NEW_CONTRACT);

  // Load markets from markets.json (already updated)
  const marketsPath = path.resolve(__dirname, './data/markets.json');
  const markets = JSON.parse(fs.readFileSync(marketsPath, 'utf8'));

  // Ensure all markets use the new contract
  markets.forEach(m => m.contractAddress = NEW_CONTRACT);

  try {
    // Reset markets in Redis
    await redis.set('markets', markets);
    console.log('✅ Markets reset in Redis with new contract ID');

    // Re-seed 32 users (keep existing users if any, add seed)
    const existingUsers = await redis.get('users') || [];
    const seedUsers = Array.from({ length: 32 }, (_, i) => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let r = '';
      for (let j = 0; j < 50; j++) r += alphabet[Math.floor(Math.random() * 32)];
      return `G${r}`;
    });
    
    // Merge existing + seed, deduplicate
    const allUsers = [...new Set([...existingUsers, ...seedUsers])];
    await redis.set('users', allUsers);
    console.log(`✅ Users seeded: ${allUsers.length} total`);

    console.log('\n🚀 DATABASE RESET COMPLETE!');
    console.log('Now refresh your browser to see the updated markets.');
  } catch (e) {
    console.error('❌ FAILED:', e.message || e);
  }
}

resetDb();
