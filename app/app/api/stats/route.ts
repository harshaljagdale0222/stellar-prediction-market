import { NextResponse } from "next/server";
import { getAllMarkets, getUserCount } from "@/lib/db";

export const revalidate = 30; // Cache for 30 seconds to reduce Redis round-trips

export async function GET() {
  // Run both queries in parallel for faster response
  const [markets, totalUsers] = await Promise.all([
    getAllMarkets(),
    getUserCount(),
  ]);

  const totalVolume = markets.reduce((s, m) => s + m.volume, 0);
  const totalLiquidity = markets.reduce((s, m) => s + m.liquidity, 0);
  const activeMarkets = markets.filter((m) => !m.resolved).length;

  return NextResponse.json({
    stats: {
      totalMarkets: markets.length,
      activeMarkets,
      totalVolume,
      totalLiquidity,
      totalUsers,
    },
  });
}
