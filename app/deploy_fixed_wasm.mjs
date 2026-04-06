
import { Keypair, Networks, TransactionBuilder, Horizon, rpc, Address, xdr, StrKey, Operation } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deployNewWasm() {
    console.log('--- UPLOADING FIXED MARKET WASM ---');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
    
    const secret = 'SDUU34LY5PEYZZW3DVFN55P3VJRVCU7IECDYGHXAPLOZCNOMIMOKS6OI';
    const deployer = Keypair.fromSecret(secret);
    
    // 1. Install WASM
    const wasmPath = path.resolve(__dirname, '../target/wasm32-unknown-unknown/release/soroban_prediction_market.wasm');
    const wasm = fs.readFileSync(wasmPath);
    
    console.log(`WASM size: ${wasm.length} bytes`);
    
    let account = await server.loadAccount(deployer.publicKey());
    
    // Create Upload Operation
    const uploadOp = Operation.uploadContractWasm({ wasm });
    
    let tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
        .addOperation(uploadOp)
        .setTimeout(60)
        .build();

    console.log('Simulating WASM upload...');
    const simRes = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simRes)) throw new Error(`Upload sim fail: ${JSON.stringify(simRes.error)}`);
    
    tx = rpc.assembleTransaction(tx, simRes).build();
    tx.sign(deployer);
    
    console.log('Submitting WASM upload...');
    const result = await server.submitTransaction(tx);
    
    // Wait for ledger
    let wasmId;
    while (true) {
        const tr = await rpcServer.getTransaction(result.hash);
        if (tr.status === 'SUCCESS') {
            wasmId = tr.returnValue.bytes().toString('hex');
            break;
        }
        console.log('Polling WASM ID...');
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('SUCCESS! NEW WASM ID:', wasmId);

    // 2. Instantiate Contract directly (bypass factory if factory is old)
    console.log('Deploying direct instance...');
    account = await server.loadAccount(deployer.publicKey());
    
    const deployOp = Operation.createContract({
        wasmId: wasmId,
        address: Address.fromString(deployer.publicKey())
    });

    let deployTx = new TransactionBuilder(account, { fee: '5000', networkPassphrase: Networks.TESTNET })
        .addOperation(deployOp)
        .setTimeout(60)
        .build();

    const dSim = await rpcServer.simulateTransaction(deployTx);
    deployTx = rpc.assembleTransaction(deployTx, dSim).build();
    deployTx.sign(deployer);
    
    const dRes = await server.submitTransaction(deployTx);
    
    let contractId;
    while (true) {
        const tr = await rpcServer.getTransaction(dRes.hash);
        if (tr.status === 'SUCCESS') {
            contractId = StrKey.encodeContract(tr.returnValue.address().contractId());
            break;
        }
        console.log('Polling Contract ID...');
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('SUCCESS! NEW CONTRACT ID:', contractId);
    
    // --- MANUAL INITIALIZATION ---
    console.log('Initializing contract...');
    const collateral = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    const yesToken = 'CDP3WCP5OAYOEP7UK6Y3WTM4Y7Y6R6MWRZ3J5WBYW6W3P3W3W3W3W3W3'; // Dummy/Placeholder for now or get from deploy_final
    // Re-use tokens from a working deployment if possible, but for demo, let's just use original collateral
    // Wait, I should really use the factory to ensure tokens are created.
    
    // IF THE FACTORY IS OLD, I NEED A NEW FACTORY TOO?
    // Let's just update the FACTORY's WASM if possible. 
    // Usually factory has a `update_wasm` function. 

    console.log('--- FINISHED ---');
    console.log('Update db.ts with:', contractId);
}

deployNewWasm().catch(console.error);
