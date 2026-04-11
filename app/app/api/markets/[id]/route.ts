import { NextResponse } from "next/server";
import { getMarketById, updateMarket, logUser } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarketById(id);
  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ market });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  
  // Log the user if address is provided
  if (body.address) {
    try {
      await logUser(body.address);
    } catch (e) {}
  }

  const updated = await updateMarket(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ market: updated });
}

