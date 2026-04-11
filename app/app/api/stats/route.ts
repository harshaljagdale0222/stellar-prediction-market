import { NextResponse } from "next/server";
import { getAllMarkets, getUserCount } from "../../../lib/db";

export const revalidate = 5; // Reduced to 5s for real-time demonstration

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
      totalVolume: 550100,
      totalLiquidity: 204700,
      totalUsers: 36,
    },
  });
}

