import { rpc, StrKey, Address, nativeToScVal, TransactionBuilder, Networks, Operation, Account } from '@stellar/stellar-sdk';

const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
const contractId = 'CDLEEXCKX2O2X3CYBWDAPO5BJWNWP5H45AL3AXJFKR46D6WGDEPBNUZO';

(async () => {
    try {
        const source = 'GAF4SUBPSJL6QATQILXS6JK7X4A6J6FA3UXOR2A2FQM6U2QMQNJ5TYPH';
        const account = new Account(source, '0');
        
        let tx = new TransactionBuilder(account, { fee: '1000', networkPassphrase: Networks.TESTNET })
            .addOperation(Operation.invokeContractFunction({
                contract: contractId,
                function: 'buy_no',
                args: [
                    nativeToScVal(source, { type: 'address' }),
                    nativeToScVal(1000000n, { type: 'i128' }),
                    nativeToScVal(0n, { type: 'i128' })
                ]
            }))
            .setTimeout(60)
            .build();

        console.log('Simulating on:', contractId);
        const res = await rpcServer.simulateTransaction(tx);
        console.log('Simulation Results:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Test Failed:', e);
    }
})();
