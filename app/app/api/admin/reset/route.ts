import { NextResponse } from "next/server";
import { resetMarketsToSeed } from "@/lib/db";

// POST /api/admin/reset  — re-seeds Redis with all 12 markets
export async function POST() {
  try {
    await resetMarketsToSeed();
    return NextResponse.json({ success: true, message: "Markets reset to seed (12 markets)" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
