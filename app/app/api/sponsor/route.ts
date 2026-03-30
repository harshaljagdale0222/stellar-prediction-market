import { NextRequest, NextResponse } from "next/server";
import { 
  TransactionBuilder, 
  Networks, 
  Keypair, 
  Horizon, 
  Transaction 
} from "@stellar/stellar-sdk";
import { logUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { xdr } = await req.json();

    if (!xdr) {
      return NextResponse.json({ error: "Missing transaction XDR" }, { status: 400 });
    }

    const sponsorSecret = process.env.SPONSOR_SECRET_KEY;
    if (!sponsorSecret) {
      console.error("SPONSOR_SECRET_KEY is not defined in .env.local");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");

    // 1. Recover the inner transaction signed by the user
    const innerTx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
    const userAddress = innerTx.source;

    // Log the user for Level 6 metrics
    try {
      logUser(userAddress);
    } catch (e) {
      console.error("Failed to log user:", e);
    }

    // 2. Build the Fee-Bump transaction
    // The sponsor pays the fee for the inner transaction
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      "2000", // Fee for the bump (in stroops)
      innerTx,
      Networks.TESTNET
    );

    // 3. Sign the fee-bump with the sponsor's key
    feeBumpTx.sign(sponsorKeypair);

    // 4. Submit to Horizon
    console.log("Submitting sponsored transaction...");
    const result = await server.submitTransaction(feeBumpTx);

    return NextResponse.json({ 
      success: true, 
      hash: result.hash,
      message: "Transaction sponsored and submitted successfully! 🚀" 
    });

  } catch (error: any) {
    console.error("Sponsorship Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to sponsor transaction" 
    }, { status: 500 });
  }
}
