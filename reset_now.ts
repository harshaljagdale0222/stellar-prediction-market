import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env.local manually
const envPath = path.resolve(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !key.startsWith("#")) env[key] = val;
  }
}

const redis = new Redis({
  url: env.STORAGE_REST_API_URL || env.KV_REST_API_URL || "",
  token: env.STORAGE_REST_API_TOKEN || env.KV_REST_API_TOKEN || "",
});

const CONTRACT = "CDLEEXCKX2O2X3CYBWDAPO5BJWNWP5H45AL3AXJFKR46D6WGDEPBNUZO";

async function main() {
  console.log("--- RESETTING DATABASE ---");

  // Load and update markets
  const marketsPath = path.resolve(__dirname, "data/markets.json");
  const markets = JSON.parse(fs.readFileSync(marketsPath, "utf8"));
  markets.forEach((m: any) => (m.contractAddress = CONTRACT));

  await redis.set("markets", markets);
  console.log("✅ Markets updated. Contract:", CONTRACT);

  // Seed 32 users
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const users: string[] = Array.from({ length: 32 }, () => {
    let r = "G";
    for (let j = 0; j < 55; j++) r += alpha[Math.floor(Math.random() * 32)];
    return r;
  });

  await redis.set("users", users);
  console.log("✅ 32 users seeded");
  console.log("\n🚀 Done! Refresh browser to see updated data.");
}

main().catch(console.error);
