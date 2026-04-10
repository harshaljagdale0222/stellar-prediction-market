
import { Keypair, Networks, Operation, TransactionBuilder, Horizon, rpc, Address, StrKey, xdr, nativeToScVal } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function finalFix() {
    console.log('--- FINAL FIX: RE-BUILDING & RE-DEPLOYING ---');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
    
    const sponsorSecret = 'SDUU34LY5PEYZZW3DVFN55P3VJRVCU7IECDYGHXAPLOZCNOMIMOKS6OI';
    const deployer = Keypair.fromSecret(sponsorSecret);
    console.log('Using Account:', deployer.publicKey());

    // 1. Upload Token WASM
    console.log('Uploading Token WASM...');
    const tokenWasm = fs.readFileSync(path.resolve(__dirname, '../target/wasm32-unknown-unknown/release/soroban_prediction_token.wasm'));
    const uploadTokenOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(tokenWasm),
        auth: []
    });
    let tx = new TransactionBuilder(await server.loadAccount(deployer.publicKey()), { fee: '1000000', networkPassphrase: Networks.TESTNET })
        .addOperation(uploadTokenOp).setTimeout(60).build();
    const simToken = await rpcServer.simulateTransaction(tx);
    tx = rpc.assembleTransaction(tx, simToken).build();
    tx.sign(deployer);
    const resToken = await server.submitTransaction(tx);
    const tokenHash = xdr.TransactionMeta.fromXDR(resToken.result_meta_xdr, 'base64').v3().sorobanMeta().returnValue().bytes();
    console.log('Token WASM Hash:', tokenHash.toString('hex'));

    // 2. Upload Market WASM
    console.log('Uploading Market WASM...');
    const marketWasm = fs.readFileSync(path.resolve(__dirname, '../target/wasm32-unknown-unknown/release/soroban_prediction_market.wasm'));
    const uploadMarketOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(marketWasm),
        auth: []
    });
    tx = new TransactionBuilder(await server.loadAccount(deployer.publicKey()), { fee: '1000000', networkPassphrase: Networks.TESTNET })
        .addOperation(uploadMarketOp).setTimeout(60).build();
    const simMarket = await rpcServer.simulateTransaction(tx);
    tx = rpc.assembleTransaction(tx, simMarket).build();
    tx.sign(deployer);
    const resMarket = await server.submitTransaction(tx);
    const marketHash = xdr.TransactionMeta.fromXDR(resMarket.result_meta_xdr, 'base64').v3().sorobanMeta().returnValue().bytes();
    console.log('Market WASM Hash:', marketHash.toString('hex'));

    // 3. Create Token Instances (YES, NO, LP)
    const createToken = async (salt) => {
        const createOp = Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeCreateContract(new xdr.CreateContractArgs({
                contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(new xdr.ContractIdPreimageFromAddress({
                    address: Address.fromString(deployer.publicKey()).toScAddress(),
                    salt: Buffer.from(salt, 'hex')
                })),
                executable: xdr.ContractExecutable.contractExecutableWasm(tokenHash)
            })),
            auth: []
        });
        tx = new TransactionBuilder(await server.loadAccount(deployer.publicKey()), { fee: '1000000', networkPassphrase: Networks.TESTNET })
            .addOperation(createOp).setTimeout(60).build();
        const simC = await rpcServer.simulateTransaction(tx);
        tx = rpc.assembleTransaction(tx, simC).build();
        tx.sign(deployer);
        const resC = await server.submitTransaction(tx);
        return StrKey.encodeContract(xdr.TransactionMeta.fromXDR(resC.result_meta_xdr, 'base64').v3().sorobanMeta().returnValue().address().contractId());
    };

    const saltBase = Date.now().toString(16).padStart(64, '0');
    const yesId = await createToken(saltBase.slice(0, 64));
    console.log('YES Token:', yesId);
    const noId = await createToken(saltBase.slice(0, 63) + '1');
    console.log('NO Token:', noId);
    const lpId = await createToken(saltBase.slice(0, 63) + '2');
    console.log('LP Token:', lpId);

    // 4. Create Market Instance
    console.log('Creating Market Instance...');
    const createMarketOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeCreateContract(new xdr.CreateContractArgs({
            contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(new xdr.ContractIdPreimageFromAddress({
                address: Address.fromString(deployer.publicKey()).toScAddress(),
                salt: Buffer.from(saltBase.slice(0, 63) + 'f', 'hex')
            })),
            executable: xdr.ContractExecutable.contractExecutableWasm(marketHash)
        })),
        auth: []
    });
    tx = new TransactionBuilder(await server.loadAccount(deployer.publicKey()), { fee: '1000000', networkPassphrase: Networks.TESTNET })
        .addOperation(createMarketOp).setTimeout(60).build();
    const simM = await rpcServer.simulateTransaction(tx);
    tx = rpc.assembleTransaction(tx, simM).build();
    tx.sign(deployer);
    const resM = await server.submitTransaction(tx);
    const marketId = StrKey.encodeContract(xdr.TransactionMeta.fromXDR(resM.result_meta_xdr, 'base64').v3().sorobanMeta().returnValue().address().contractId());
    console.log('--- NEW MARKET ID ---', marketId);

    // 5. Initialize tokens and market
    console.log('Initializing Token Admins to Market...');
    const initToken = async (id, name, sym) => {
        const op = Operation.invokeContractFunction({
            contract: id, function: 'initialize',
            args: [new Address(marketId).toScVal(), nativeToScVal(7, {type:'u32'}), nativeToScVal(name), nativeToScVal(sym)]
        });
        tx = new TransactionBuilder(await server.loadAccount(deployer.publicKey()), { fee: '1000000', networkPassphrase: Networks.TESTNET }).addOperation(op).setTimeout(60).build();
        const simI = await rpcServer.simulateTransaction(tx);
        tx = rpc.assembleTransaction(tx, simI).build();
        tx.sign(deployer);
        await server.submitTransaction(tx);
    };
    await initToken(yesId, "YES", "YES");
    await initToken(noId, "NO", "NO");
    await initToken(lpId, "LP", "LP");

    console.log('Initializing Market with tokens...');
    const initMarketOp = Operation.invokeContractFunction({
        contract: marketId, function: 'init',
        args: [
            new Address(deployer.publicKey()).toScVal(), // Admin
            new Address(deployer.publicKey()).toScVal(), // Oracle
            new Address('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC').toScVal(), // Native XLM
            new Address(yesId).toScVal(),
            new Address(noId).toScVal(),
            new Address(lpId).toScVal()
        ]
    });
    tx = new TransactionBuilder(await server.loadAccount(deployer.publicKey()), { fee: '1000000', networkPassphrase: Networks.TESTNET }).addOperation(initMarketOp).setTimeout(60).build();
    const simMI = await rpcServer.simulateTransaction(tx);
    tx = rpc.assembleTransaction(tx, simMI).build();
    tx.sign(deployer);
    await server.submitTransaction(tx);

    console.log('Market READY. Updating DB...');
    const dbPath = path.resolve(__dirname, './data/markets.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    db.forEach(m => m.contractAddress = marketId);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('Final Fix Complete. New Market ID:', marketId);
}
finalFix().catch(console.error);
