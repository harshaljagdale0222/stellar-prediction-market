import { Redis } from "@upstash/redis";

// Initialize Redis client using Vercel environment variables
// Vercel usually provides KV_REST_API_URL or STORAGE_REST_API_URL based on the prefix
const redis = new Redis({
  url: process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || "",
  token: process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "",
});

export interface MarketMeta {
  id: string;
  contractAddress: string;
  title: string;
  description: string;
  category: string;
  emoji: string;
  endDate: string;
  yesPrice: number;
  noPrice: number;
  yesVolume: number;
  noVolume: number;
  volume: number;
  liquidity: number;
  resolved: boolean;
  outcome?: "YES" | "NO" | "INVALID";
  createdAt: string;
}

// Initial Seed Data (for first-time setup or if Redis is empty)
const SEED_MARKETS: MarketMeta[] = [
    {
      id: "1",
      contractAddress: "CAMFDESMH77PSPTJQ5DAEFTFTCTH6SG2VR3C4WD4FSGRIXFLLE5E3QLG",
      title: "Bitcoin surpasses $150,000 before July 2026?",
      description: "Will Bitcoin's price exceed $150,000 USD on any major exchange before July 1st, 2026?",
      category: "Crypto",
      emoji: "₿",
      endDate: "2026-07-01",
      yesPrice: 0.62,
      noPrice: 0.38,
      yesVolume: 79600,
      noVolume: 48800,
      volume: 128400,
      liquidity: 45200,
      resolved: false,
      createdAt: new Date().toISOString(),
    },
    {
        id: "2",
        contractAddress: "CAMFDESMH77PSPTJQ5DAEFTFTCTH6SG2VR3C4WD4FSGRIXFLLE5E3QLG",
        title: "Ethereum ETF approved by SEC in 2026?",
        description: "Will the U.S. Securities and Exchange Commission approve a spot Ethereum ETF in 2026?",
        category: "Crypto",
        emoji: "Ξ",
        endDate: "2026-12-31",
        yesPrice: 0.74,
        noPrice: 0.26,
        yesVolume: 66082,
        noVolume: 23218,
        volume: 89300,
        liquidity: 31000,
        resolved: false,
        createdAt: new Date().toISOString(),
    }
];

export async function getAllMarkets(): Promise<MarketMeta[]> {
  try {
    const markets = await redis.get<MarketMeta[]>("markets");
    if (!markets) {
      // If empty, initialize with seed
      await redis.set("markets", SEED_MARKETS);
      return SEED_MARKETS;
    }
    return markets;
  } catch (e) {
    console.error("Redis Error:", e);
    return SEED_MARKETS; // Fallback
  }
}

export async function getMarketById(id: string): Promise<MarketMeta | null> {
  const markets = await getAllMarkets();
  return markets.find((m) => m.id === id) ?? null;
}

export async function createMarket(data: Omit<MarketMeta, "id" | "createdAt">): Promise<MarketMeta> {
  const markets = await getAllMarkets();
  const newMarket: MarketMeta = {
    ...data,
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  markets.push(newMarket);
  await redis.set("markets", markets);
  return newMarket;
}

export async function updateMarket(id: string, patch: Partial<MarketMeta>): Promise<MarketMeta | null> {
  const markets = await getAllMarkets();
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  markets[idx] = { ...markets[idx], ...patch };
  await redis.set("markets", markets);
  return markets[idx];
}

// User Tracking for Level 6
export async function logUser(address: string) {
  try {
    const users = (await redis.get<string[]>("users")) || [];
    if (!users.includes(address)) {
      users.push(address);
      await redis.set("users", users);
    }
  } catch (e) {
    console.error("Redis User Error:", e);
  }
}

export async function getUserCount(): Promise<number> {
  try {
    const users = await redis.get<string[]>("users");
    return users ? users.length : 0;
  } catch (e) {
    return 0;
  }
}

export async function getAllUsers(): Promise<string[]> {
  try {
    return (await redis.get<string[]>("users")) || [];
  } catch (e) {
    return [];
  }
}
