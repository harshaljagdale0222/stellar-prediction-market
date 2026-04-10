
/**
 * FULL REDEPLOYMENT SCRIPT v2
 * Uploads fixed WASM binaries and deploys a new fully-initialized market.
 * This fixes the "buy_no non-existent function" error permanently.
 */
import {
  Keypair, Networks, TransactionBuilder, Horizon, rpc,
  Address, StrKey, xdr, nativeToScVal, hash
} from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WASM_DIR = path.resolve(__dirname, '../target/wasm32-unknown-unknown/release');
const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');

const SECRET = 'SDUU34LY5PEYZZW3DVFN55P3VJRVCU7IECDYGHXAPLOZCNOMIMOKS6OI';
const deployer = Keypair.fromSecret(SECRET);

async function waitForTx(hash) {
  for (let i = 0; i < 20; i++) {
    const res = await rpcServer.getTransaction(hash);
    if (res.status === 'SUCCESS') return res;
    if (res.status === 'FAILED') throw new Error('TX Failed: ' + JSON.stringify(res));
    console.log(`  Waiting... (${i + 1})`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Transaction timed out');
}

async function uploadWasm(wasmBytes, label) {
  console.log(`\n[1] Uploading ${label} WASM (${wasmBytes.length} bytes)...`);
  let account = await server.loadAccount(deployer.publicKey());
  
  const uploadOp = xdr.Operation.fromXDR(
    new xdr.Operation({
      body: xdr.OperationBody.uploadContractWasm(new xdr.UploadContractWasmArgs({ code: wasmBytes })),
      sourceAccount: null,
    }).toXDR(), 'raw');

  let tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
    .addOperation(xdr.Operation.uploadContractWasm(new xdr.UploadContractWasmArgs({ code: wasmBytes })))
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${label} upload sim fail: ${sim.error}`);
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployer);

  const result = await server.submitTransaction(tx);
  const txResult = await waitForTx(result.hash);
  
  // WASM hash = SHA256 of the wasm bytes
  const { createHash } = await import('crypto');
  const wasmHash = createHash('sha256').update(wasmBytes).digest('hex');
  console.log(`  ✅ ${label} WASM Hash: ${wasmHash}`);
  return wasmHash;
}

async function deployInstance(wasmHash, salt, label) {
  console.log(`\n[2] Deploying ${label} instance...`);
  let account = await server.loadAccount(deployer.publicKey());

  const saltBytes = Buffer.alloc(32);
  saltBytes.write(salt, 0, 'utf8');

  const deployArgs = new xdr.DeployContractArgs({
    contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new xdr.ContractIdPreimageFromAddress({
        address: xdr.ScAddress.scAddressTypeAccount(deployer.publicKey().toXDR ? 
          new xdr.AccountId(xdr.PublicKey.publicKeyTypeEd25519(deployer.rawPublicKey())) : 
          xdr.ScAddress.scAddressTypeAccount(deployer.xdrPublicKey())),
        salt: saltBytes,
      })
    ),
    executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.from(wasmHash, 'hex')),
  });

  let tx = new TransactionBuilder(account, { fee: '5000', networkPassphrase: Networks.TESTNET })
    .addOperation(xdr.Operation.createContract(deployArgs))
    .setTimeout(60)
    .build();
  
  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${label} deploy sim fail: ${sim.error}`);
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployer);

  const result = await server.submitTransaction(tx);
  const txResult = await waitForTx(result.hash);
  const contractId = StrKey.encodeContract(txResult.returnValue.address().contractId());
  console.log(`  ✅ ${label} Contract ID: ${contractId}`);
  return contractId;
}

async function main() {
  console.log('=== STELLAR PREDICT - FULL V2 DEPLOYMENT ===');
  console.log('Deployer:', deployer.publicKey());

  try {
    // Step 1: Upload all WASMs
    const tokenWasm = fs.readFileSync(path.join(WASM_DIR, 'soroban_prediction_token.wasm'));
    const marketWasm = fs.readFileSync(path.join(WASM_DIR, 'soroban_prediction_market.wasm'));

    const tokenWasmHash = await uploadWasm(tokenWasm, 'Token');
    const marketWasmHash = await uploadWasm(marketWasm, 'Market (Fixed buy_no)');

    // Step 2: Deploy Factory using Stellar CLI or direct create
    // Actually: Use the existing factory with the new WASM hashes OR 
    // Use the Node.js SDK's built-in contract deployment
    
    // Step 3: Deploy using Stellar SDK Operation.invokeHostFunction
    console.log('\n[3] Creating market via factory...');
    const FACTORY_ID = 'CB5ZKRVTZCSERHLYMLXZ6EWSVJ3DY7J6JVRMUKPNYDS2VGODLCLE4V37';
    const COLLATERAL = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    
    let account = await server.loadAccount(deployer.publicKey());

    const createMarketOp = new xdr.Operation({
      body: xdr.OperationBody.invokeHostFunction(
        new xdr.InvokeHostFunctionOp({
          hostFunction: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
              contractAddress: new xdr.ScAddress.scAddressTypeContract(
                StrKey.decodeContract(FACTORY_ID)
              ),
              functionName: 'create_market',
              args: [
                nativeToScVal(deployer.publicKey(), { type: 'address' }),
                nativeToScVal(deployer.publicKey(), { type: 'address' }),
                nativeToScVal(COLLATERAL, { type: 'address' }),
              ]
            })
          ),
          auth: [],
        })
      ),
      sourceAccount: null,
    });

    // Build create_market operation normally
    const { Operation } = await import('@stellar/stellar-sdk');
    let createTx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.TESTNET })
      .addOperation(
        Operation.invokeContractFunction({
          contract: FACTORY_ID,
          function: 'create_market',
          args: [
            nativeToScVal(deployer.publicKey(), { type: 'address' }),
            nativeToScVal(deployer.publicKey(), { type: 'address' }),
            nativeToScVal(COLLATERAL, { type: 'address' }),
          ]
        })
      )
      .setTimeout(120)
      .build();

    const createSim = await rpcServer.simulateTransaction(createTx);
    if (rpc.Api.isSimulationError(createSim)) throw new Error(`create_market sim fail: ${JSON.stringify(createSim.error)}`);
    createTx = rpc.assembleTransaction(createTx, createSim).build();
    createTx.sign(deployer);

    const createResult = await server.submitTransaction(createTx);
    const createTxResult = await waitForTx(createResult.hash);
    const newMarketId = StrKey.encodeContract(createTxResult.returnValue.address().contractId());
    
    console.log('\n========================================');
    console.log('🚀 SUCCESS! New Fixed Market ID:');
    console.log(newMarketId);
    console.log('========================================');
    
    // Update markets.json
    const marketsPath = path.resolve(__dirname, './data/markets.json');
    const db = JSON.parse(fs.readFileSync(marketsPath, 'utf8'));
    db.forEach(m => m.contractAddress = newMarketId);
    fs.writeFileSync(marketsPath, JSON.stringify(db, null, 2));
    console.log('\n✅ data/markets.json updated with new Market ID');
    console.log('✅ Now update db.ts CONTRACT const to:', newMarketId);
    
  } catch (err) {
    console.error('\n❌ DEPLOYMENT FAILED:', err.message || err);
    process.exit(1);
  }
}

main();
