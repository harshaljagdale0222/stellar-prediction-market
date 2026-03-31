import { NextResponse } from "next/server";
import { getAllUsers, logUser } from "@/lib/db";

export async function GET() {
  try {
    const users = getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ error: "No address provided" }, { status: 400 });
    
    logUser(address);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to log user" }, { status: 500 });
  }
}
