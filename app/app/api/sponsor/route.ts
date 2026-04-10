import { NextRequest, NextResponse } from "next/server";
import { 
  TransactionBuilder, 
  Networks, 
  Keypair, 
  Horizon, 
  Transaction 
} from "@stellar/stellar-sdk";
import { logUser } from "../../../lib/db";

export async function POST(req: NextRequest) {
  try {
    const { xdr } = await req.json();

    if (!xdr) {
      console.warn("REST Error: Missing transaction XDR in body");
      return NextResponse.json({ error: "Missing transaction XDR" }, { status: 400 });
    }

    console.log("Processing sponsorship request for XDR (start):", xdr.slice(0, 32));

    const sponsorSecret = process.env.SPONSOR_SECRET_KEY;
    if (!sponsorSecret) {
      console.warn("SPONSOR_SECRET_KEY is not defined. Falling back to direct submission.");
      return NextResponse.json({ error: "SPONSOR_NOT_CONFIGURED" }, { status: 503 });
    }

    const sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");

    // 1. Recover the inner transaction signed by the user
    let innerTx: Transaction;
    try {
      innerTx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
    } catch (e) {
      console.error("XDR Decode Error:", e);
      return NextResponse.json({ error: "Invalid transaction XDR" }, { status: 400 });
    }

    const userAddress = innerTx.source;
    console.log("Inner Transaction Source:", userAddress);

    // Ensure the inner transaction has enough fee if it wasn't stripped during bump
    // In Soroban, usually 1000+ stroops is fine.
    
    // Log the user for Level 6 metrics
    try {
      await logUser(userAddress);
    } catch (e) {
      console.error("Failed to log user into Redis:", e);
    }

    // 2. Build the Fee-Bump transaction
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      "3000", // Increased fee for guaranteed reliability
      innerTx,
      Networks.TESTNET
    );

    // 3. Sign the fee-bump with the sponsor's key
    feeBumpTx.sign(sponsorKeypair);

    // 4. Submit to Horizon
    console.log("Submitting sponsored transaction to Stellar Network...");
    const result = await server.submitTransaction(feeBumpTx);
    console.log("Sponsorship Success! Hash:", result.hash);

    return NextResponse.json({ 
      success: true, 
      hash: result.hash,
      message: "Transaction sponsored and submitted successfully! 🚀" 
    });

  } catch (error: any) {
    console.error("--- SPONSORSHIP HUB ERROR ---");
    const detailedError = error.response?.data?.extras?.result_codes?.transaction || 
                        error.response?.data?.extras?.result_codes?.operations?.[0] || 
                        error.message;
    console.error("Reason:", detailedError);
    if (error.response?.data) {
      console.error("Horizon Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    return NextResponse.json({ 
      success: false,
      error: `Sponsorship failed: ${detailedError}` 
    }, { status: 400 }); // Stick to 400 as per user console observation
  }
}
