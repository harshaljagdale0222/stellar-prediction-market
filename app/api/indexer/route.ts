import { NextResponse } from "next/server";
import { syncAllMarkets } from "@/lib/indexer";

export async function GET() {
  try {
    console.log("Triggering market sync from indexer API...");
    
    // In a real production app, we would use a Cron job 
    // to call this every hour. For Level 6, we provide this 
    // endpoint for on-demand synchronization.
    await syncAllMarkets();

    return NextResponse.json({ 
      success: true, 
      message: "Indexer sync completed successfully! 🚀",
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Indexer API error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to trigger indexer" 
    }, { status: 500 });
  }
}
