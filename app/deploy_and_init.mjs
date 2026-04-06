
import { Keypair, Networks, Operation, TransactionBuilder, Horizon, rpc, Address, StrKey, xdr, nativeToScVal } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deployAndInit() {
    console.log('--- EMERGENCY RE-DEPLOYMENT & INIT ---');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
    
    // 1. Use Sponsor Key for funding if possible, or Friendbot
    const sponsorSecret = 'SDUU34LY5PEYZZW3DVFN55P3VJRVCU7IECDYGHXAPLOZCNOMIMOKS6OI';
    const deployer = Keypair.fromSecret(sponsorSecret);
    console.log('Deployer Payload:', deployer.publicKey());

    let account = await server.loadAccount(deployer.publicKey());

    // 2. Load latest WASM (just built)
    const wasmPath = path.resolve(__dirname, '../contracts/market/target/wasm32-unknown-unknown/release/soroban_prediction_market.wasm');
    const wasm = fs.readFileSync(wasmPath);
    console.log('WASM loaded, size:', wasm.length);

    // 3. Upload WASM
    console.log('Uploading WASM...');
    const uploadOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasm),
        auth: []
    });

    let tx = new TransactionBuilder(account, { fee: '500000', networkPassphrase: Networks.TESTNET })
        .addOperation(uploadOp)
        .setTimeout(120)
        .build();

    const sim1 = await rpcServer.simulateTransaction(tx);
    tx = rpc.assembleTransaction(tx, sim1).build();
    tx.sign(deployer);
    const resUpload = await server.submitTransaction(tx);
    const metaXdr = xdr.TransactionMeta.fromXDR(resUpload.result_meta_xdr, 'base64');
    const wasmHash = metaXdr.v3().sorobanMeta().returnValue().bytes();
    console.log('WASM Hash:', wasmHash.toString('hex'));

    // 4. Create Contract Instance
    console.log('Creating Instance...');
    account = await server.loadAccount(deployer.publicKey());
    const createOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeCreateContract(new xdr.CreateContractArgs({
            contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(new xdr.ContractIdPreimageFromAddress({
                address: Address.fromString(deployer.publicKey()).toScAddress(),
                salt: Buffer.alloc(32) // Fresh salt for this specific emergency
            })),
            executable: xdr.ContractExecutable.contractExecutableWasm(wasmHash)
        })),
        auth: []
    });

    tx = new TransactionBuilder(account, { fee: '500000', networkPassphrase: Networks.TESTNET })
        .addOperation(createOp)
        .setTimeout(120)
        .build();

    const sim2 = await rpcServer.simulateTransaction(tx);
    tx = rpc.assembleTransaction(tx, sim2).build();
    tx.sign(deployer);
    const resCreate = await server.submitTransaction(tx);
    const createMetaXdr = xdr.TransactionMeta.fromXDR(resCreate.result_meta_xdr, 'base64');
    const contractId = StrKey.encodeContract(createMetaXdr.v3().sorobanMeta().returnValue().address().contractId());
    console.log('NEW MARKET ID:', contractId);

    // 5. INITIALIZE THE MARKET (CRITICAL STEP)
    // We need YES/NO/LP token addresses. For speed, I'll use some already on-chain or deploy new ones.
    // Actually, I'll deploy NEW ones to be clean.
    console.log('Initializing Market with sub-tokens...');
    // We already have some token contracts from previous runs? 
    // No, I'll use the ones from the factory if possible, but let's just deploy bare tokens for now.
    
    // For this demo, let's just initialize with some dummy addresses first or deploy them.
    // Actually, I should use the factory to do it properly.
    
    // I will use 'app/create_market.mjs' but I will UPDATE the factory's WASM hash first.
    // Since I can't update the old factory, I'll DEPLOY A NEW FACTORY.
}

deployAndInit().catch(console.error);
