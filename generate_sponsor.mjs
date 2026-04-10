import { Keypair } from "@stellar/stellar-sdk";

async function setupSponsor() {
  const pair = Keypair.random();
  console.log("SPONSOR_PUBLIC_KEY=" + pair.publicKey());
  console.log("SPONSOR_SECRET_KEY=" + pair.secret());

  console.log("Funding account via Friendbot...");
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);
    if (response.ok) {
      console.log("SUCCESS: Sponsor account funded and ready on Testnet.");
    } else {
      console.log("ERROR: Friendbot funding failed.");
    }
  } catch (e) {
    console.log("ERROR: Could not fetch Friendbot. " + e.message);
  }
}

setupSponsor();
