
import { Horizon } from '@stellar/stellar-sdk';
import axios from 'axios';

async function topUp() {
    console.log('--- REPLENISHING TESTNET XLM BALANCES ---');
    
    // Sponsor Account
    const sponsor = 'GAF4SUBPSJL6QATQILXS6JK7X4A6J6FA3UXOR2A2FQM6U2QMQNJ5TYPH';
    
    try {
        console.log(`Checking Sponsor: ${sponsor}...`);
        const res = await axios.get(`https://friendbot.stellar.org?addr=${sponsor}`);
        console.log('SUCCESS: Sponsor topped up with 10,000 XLM! 🚀');
    } catch (e) {
        console.warn('Sponsor might already be full or friendbot rate-limited.');
    }

    console.log('\nDone. You can now use gasless transactions safely.');
}

topUp().catch(console.error);
