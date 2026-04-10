import { getMarketById } from "@/lib/db";
import MarketClient from "./MarketClient";
import { notFound } from "next/navigation";

export const revalidate = 10;

export default async function MarketPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const market = await getMarketById(id);

  if (!market) {
    notFound();
  }

  return <MarketClient initialMarket={market} />;
}
