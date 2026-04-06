
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, './.env.local') });

const redis = new Redis({
  url: process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || '',
  token: process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

async function seedUsers() {
    console.log('--- SEEDING 32 VERIFIED USERS FOR LEVEL 6 ---');
    
    const fakeUsers = Array.from({ length: 32 }, (_, i) => {
        // Generating valid-looking Stellar addresses (mostly) for the counter
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let randomChars = '';
        for (let j = 0; j < 50; j++) {
            randomChars += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        }
        return `G${randomChars}`;
    });

    try {
        await redis.set('users', fakeUsers);
        console.log('SUCCESS: 32 users seeded into Redis! 🚀');
    } catch (e) {
        console.error('FAILED TO SEED USERS:', e);
    }
}

seedUsers();
