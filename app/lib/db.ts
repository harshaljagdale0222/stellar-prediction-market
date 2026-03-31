import { Redis } from "@upstash/redis";

// Initialize Redis client using Vercel environment variables
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

const CONTRACT = "CAMFDESMH77PSPTJQ5DAEFTFTCTH6SG2VR3C4WD4FSGRIXFLLE5E3QLG";

// Expanded Seed Data — 12 diverse markets
export const SEED_MARKETS: MarketMeta[] = [
  {
    id: "1",
    contractAddress: CONTRACT,
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
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "2",
    contractAddress: CONTRACT,
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
    createdAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "3",
    contractAddress: CONTRACT,
    title: "India wins ICC Cricket World Cup 2026?",
    description: "Will the Indian national cricket team win the ICC Cricket World Cup tournament in 2026?",
    category: "Sports",
    emoji: "🏏",
    endDate: "2026-11-30",
    yesPrice: 0.55,
    noPrice: 0.45,
    yesVolume: 52000,
    noVolume: 42500,
    volume: 94500,
    liquidity: 33000,
    resolved: false,
    createdAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "4",
    contractAddress: CONTRACT,
    title: "Global average temperature sets new record in 2026?",
    description: "Will 2026 be officially recorded as the hottest year on record by major climate agencies?",
    category: "Climate",
    emoji: "🌡️",
    endDate: "2027-01-31",
    yesPrice: 0.81,
    noPrice: 0.19,
    yesVolume: 41200,
    noVolume: 9600,
    volume: 50800,
    liquidity: 18000,
    resolved: false,
    createdAt: "2026-01-18T00:00:00.000Z",
  },
  {
    id: "5",
    contractAddress: CONTRACT,
    title: "Donald Trump signs new crypto regulation before Oct 2026?",
    description: "Will the Trump administration sign a comprehensive federal cryptocurrency regulation bill into law before October 2026?",
    category: "Politics",
    emoji: "🏛️",
    endDate: "2026-10-01",
    yesPrice: 0.47,
    noPrice: 0.53,
    yesVolume: 38900,
    noVolume: 44100,
    volume: 83000,
    liquidity: 28500,
    resolved: false,
    createdAt: "2026-01-20T00:00:00.000Z",
  },
  {
    id: "6",
    contractAddress: CONTRACT,
    title: "Solana flips Ethereum in market cap in 2026?",
    description: "Will Solana's total market capitalization exceed Ethereum's before December 31, 2026?",
    category: "Crypto",
    emoji: "◎",
    endDate: "2026-12-31",
    yesPrice: 0.29,
    noPrice: 0.71,
    yesVolume: 22100,
    noVolume: 54000,
    volume: 76100,
    liquidity: 26000,
    resolved: false,
    createdAt: "2026-01-22T00:00:00.000Z",
  },
  {
    id: "7",
    contractAddress: CONTRACT,
    title: "Lionel Messi retires from professional football in 2026?",
    description: "Will Lionel Messi officially announce retirement from professional football during 2026?",
    category: "Sports",
    emoji: "⚽",
    endDate: "2026-12-31",
    yesPrice: 0.38,
    noPrice: 0.62,
    yesVolume: 18500,
    noVolume: 30200,
    volume: 48700,
    liquidity: 17000,
    resolved: false,
    createdAt: "2026-01-25T00:00:00.000Z",
  },
  {
    id: "8",
    contractAddress: CONTRACT,
    title: "Stellar XLM reaches $1.00 before June 2026?",
    description: "Will the Stellar Lumens (XLM) token reach and sustain a price of $1.00 USD before June 1, 2026?",
    category: "Crypto",
    emoji: "⭐",
    endDate: "2026-06-01",
    yesPrice: 0.43,
    noPrice: 0.57,
    yesVolume: 33700,
    noVolume: 44500,
    volume: 78200,
    liquidity: 27000,
    resolved: false,
    createdAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "9",
    contractAddress: CONTRACT,
    title: "US Federal Reserve cuts rates 3+ times in 2026?",
    description: "Will the US Federal Reserve cut interest rates at least 3 times during the 2026 calendar year?",
    category: "Politics",
    emoji: "🏦",
    endDate: "2026-12-31",
    yesPrice: 0.52,
    noPrice: 0.48,
    yesVolume: 29300,
    noVolume: 27100,
    volume: 56400,
    liquidity: 20000,
    resolved: false,
    createdAt: "2026-02-05T00:00:00.000Z",
  },
  {
    id: "10",
    contractAddress: CONTRACT,
    title: "Arctic sea ice hits new all-time low in summer 2026?",
    description: "Will Arctic sea ice extent reach a new record low during the 2026 summer minimum season?",
    category: "Climate",
    emoji: "🧊",
    endDate: "2026-09-30",
    yesPrice: 0.67,
    noPrice: 0.33,
    yesVolume: 15400,
    noVolume: 7600,
    volume: 23000,
    liquidity: 8500,
    resolved: false,
    createdAt: "2026-02-10T00:00:00.000Z",
  },
  {
    id: "11",
    contractAddress: CONTRACT,
    title: "FIFA World Cup 2026 Final watched by 2B+ viewers?",
    description: "Will the FIFA World Cup 2026 Final attract over 2 billion live viewers globally?",
    category: "Sports",
    emoji: "🏆",
    endDate: "2026-07-20",
    yesPrice: 0.71,
    noPrice: 0.29,
    yesVolume: 44200,
    noVolume: 18100,
    volume: 62300,
    liquidity: 22000,
    resolved: false,
    createdAt: "2026-02-14T00:00:00.000Z",
  },
  {
    id: "12",
    contractAddress: CONTRACT,
    title: "Apple launches AR glasses to market in 2026?",
    description: "Will Apple ship consumer AR glasses (not just Vision Pro) to market before end of 2026?",
    category: "Other",
    emoji: "🥽",
    endDate: "2026-12-31",
    yesPrice: 0.34,
    noPrice: 0.66,
    yesVolume: 19800,
    noVolume: 38500,
    volume: 58300,
    liquidity: 20500,
    resolved: false,
    createdAt: "2026-02-18T00:00:00.000Z",
  },
];

export async function getAllMarkets(): Promise<MarketMeta[]> {
  try {
    const markets = await redis.get<MarketMeta[]>("markets");
    if (!markets || markets.length < 3) {
      // Seed if empty or outdated (fewer than 3 markets)
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

// Force reset markets to full seed (call via admin API)
export async function resetMarketsToSeed(): Promise<void> {
  await redis.set("markets", SEED_MARKETS);
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
