import { getAllMarkets } from "@/lib/db";
import HomeClient from "@/app/components/HomeClient";

// Force static recovery/regeneration every 15 seconds for speed
export const revalidate = 15;

async function getStats() {
  const markets = await getAllMarkets();
  const totalVolume = markets.reduce((acc, m) => acc + (m.volume || 0), 0);
  const totalLiquidity = markets.reduce((acc, m) => acc + (m.liquidity || 0), 0);
  const activeMarkets = markets.filter(m => !m.resolved).length;
  
  return {
    totalMarkets: markets.length,
    activeMarkets,
    totalVolume,
    totalLiquidity
  };
}

export default async function HomePage() {
  const markets = await getAllMarkets();
  const stats = await getStats();

  return (
    <HomeClient initialMarkets={markets} initialStats={stats} />
  );
}
