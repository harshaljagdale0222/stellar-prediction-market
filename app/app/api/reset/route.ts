import { NextResponse } from "next/server";
import { SEED_MARKETS } from "@/lib/db";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || "",
  token: process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || "",
});

export async function GET() {
  try {
    await redis.set("markets", SEED_MARKETS);
    return NextResponse.json({ success: true, message: "Markets reset to real Seed ID: CAMF..." });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
