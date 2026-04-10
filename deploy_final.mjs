
import { Keypair, Networks, Operation, TransactionBuilder, Horizon, rpc, Address, StrKey, xdr } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deployFinal() {
    console.log('--- STARTING FINAL LEVEL 6 DEPLOYMENT (XLM) ---');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
    
    // 1. Use Existing Sponsor Key
    const sponsorSecret = 'SDUU34LY5PEYZZW3DVFN55P3VJRVCU7IECDYGHXAPLOZCNOMIMOKS6OI';
    const deployer = Keypair.fromSecret(sponsorSecret);
    console.log('Using Sponsor Account (Admin/Oracle):', deployer.publicKey());

    // 2. Load and Configure IDs
    const factoryId = 'CB5ZKRVTZCSERHLYMLXZ6EWSVJ3DY7J6JVRMUKPNYDS2VGODLCLE4V37';
    // Native XLM Contract ID for Soroban Testnet
    const collateralToken = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    const oracle = deployer.publicKey();

    let account = await server.loadAccount(deployer.publicKey());

    // 3. Prepare 'create_market' Operation
    const createOp = Operation.invokeContractFunction({
        contract: factoryId,
        function: 'create_market',
        args: [
            new Address(deployer.publicKey()).toScVal(), // caller/admin
            new Address(oracle).toScVal(),             // oracle
            new Address(collateralToken).toScVal()     // collateral
        ]
    });

    // 4. Build Initial Transaction
    let tx = new TransactionBuilder(account, { 
        fee: '1000', // Base fee, will be overridden by simulation if needed
        networkPassphrase: Networks.TESTNET 
    })
        .addOperation(createOp)
        .setTimeout(60)
        .build();

    // 5. --- CRITICAL SOROBAN SIMULATION ---
    console.log('Simulating transaction via Soroban RPC...');
    const simRes = await rpcServer.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationError(simRes)) {
        console.error('Simulation Failed:', JSON.stringify(simRes.error, null, 2));
        throw new Error(`Simulation failed: ${simRes.error}`);
    }

    console.log('Simulation successful. Assembling and signing...');
    tx = rpc.assembleTransaction(tx, simRes).build();
    tx.sign(deployer);

    // 6. Submit to Testnet
    console.log('Submitting finalized transaction...');
    const result = await server.submitTransaction(tx);
    const txHash = result.hash;
    console.log('Transaction Hash:', txHash);

    // 7. Wait and Fetch Result from Soroban RPC (Extremely Reliable)
    console.log('Fetching result from Soroban RPC...');
    let txResponse;
    let attempts = 0;
    while (attempts < 10) {
        txResponse = await rpcServer.getTransaction(txHash);
        if (txResponse.status !== 'NOT_FOUND' && txResponse.status !== 'PENDING') {
            break;
        }
        console.log(`Waiting for ledger... (Attempt ${attempts + 1})`);
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
    }

    if (txResponse.status !== 'SUCCESS') {
        console.error('Transaction Failed on-chain:', JSON.stringify(txResponse, null, 2));
        throw new Error('Transaction failed');
    }

    // 8. Extract Market ID from returnValue
    const marketIdSc = txResponse.returnValue;
    const marketId = StrKey.encodeContract(marketIdSc.address().contractId());
    console.log('SUCCESS! NEW MARKET ID:', marketId);

    // 9. Update markets.json
    const marketsPath = path.resolve(__dirname, './data/markets.json');
    const db = JSON.parse(fs.readFileSync(marketsPath, 'utf8'));
    db.forEach(m => m.contractAddress = marketId);
    fs.writeFileSync(marketsPath, JSON.stringify(db, null, 2));
    
    console.log('Local DB (markets.json) updated.');
    
    console.log('Local DB (markets.json) updated.');
    console.log('\n--- NEXT STEPS ---');
    console.log('1. Update README.md with Market ID:', marketId);
    console.log('2. Update ARCHITECTURE.md (USDC -> XLM)');
    console.log('3. Restart the Indexer with new address.');
}

deployFinal().catch(err => {
    console.error('DEPLOYMENT FAILED:', err);
    process.exit(1);
});
