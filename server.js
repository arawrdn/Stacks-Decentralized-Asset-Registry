// server.js
require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const crypto = require('crypto');
const axios = require('axios');
const { StacksMainnet } = require('micro-stacks/network');
const { 
    ContractCallPayloadBuilder, 
    bufferCV,
    stringAsciiCV,
    createStacksPrivateKey,
    signTransaction
} = require('micro-stacks/transactions');
const { getPublicKey } = require('micro-stacks/cryptography');

const app = express();
app.use(express.json());
const PORT = 3000;

// --- Stacks Configuration ---
const network = new StacksMainnet({ url: process.env.STACKS_NETWORK_URL });
const privateKey = process.env.PRIVATE_KEY; 
const assetTrackerContract = `${process.env.ASSET_TRACKER_ADDRESS}.asset-tracker`;
const senderAddress = process.env.DEPLOYER_ADDRESS;

// --- Google Sheets Configuration ---
async function authenticateGoogleSheets() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Calculates the SHA-256 hash of the asset data payload.
 * The data must be converted to a canonical string representation before hashing.
 * @param {Array<Array<string>>} data - The rows of data from Google Sheet.
 * @returns {Buffer} The SHA-256 hash buffer (32 bytes).
 */
function calculateDataHash(data) {
    // Create a deterministic string representation by flattening and stringifying the data array
    const dataString = JSON.stringify(data.flat()); 
    const hash = crypto.createHash('sha256').update(dataString).digest();
    return hash;
}

/**
 * Submits the calculated hash to the Stacks Blockchain via the asset-tracker contract.
 */
async function submitHashToStacks(assetId, hashBuffer) {
    const privKey = createStacksPrivateKey(privateKey);
    
    // 1. Build the transaction payload
    const payload = ContractCallPayloadBuilder.create({
        contractAddress: assetTrackerContract.split('.')[0],
        contractName: 'asset-tracker',
        functionName: 'record-asset-hash',
        functionArgs: [
            stringAsciiCV(assetId), 
            bufferCV(hashBuffer)
        ],
    });

    // 2. Create and Sign the transaction (Nonce and fee must be handled for production use)
    const transaction = await signTransaction({
        privateKey: privKey,
        publicKey: getPublicKey(privKey),
        payload,
        network,
        nonce: 0, 
        fee: 300, 
    });
    
    // 3. Broadcast the transaction
    const response = await axios.post(`${process.env.STACKS_NETWORK_URL}/v2/transactions`, transaction.btoa());

    return response.data.txid;
}

// --- Main Route ---

/**
 * POST /api/audit-asset
 * Triggers the audit process: reads data from Sheet, computes hash, and records it on Stacks.
 */
app.post('/api/audit-asset', async (req, res) => {
    const { assetId, sheetName, rangeOverride } = req.body; 
    
    if (!assetId || !sheetName) {
        return res.status(400).json({ error: 'Missing required parameters: assetId or sheetName.' });
    }

    try {
        const sheets = await authenticateGoogleSheets();
        
        // Define range: Use sheetName with a broad range, or use an optional rangeOverride
        const range = rangeOverride || `${sheetName}!A:Z`; 

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.ASSET_SHEET_ID,
            range: range, 
        });

        const dataRows = response.data.values;
        if (!dataRows || dataRows.length < 2) {
            return res.status(404).json({ error: 'No sufficient data found in the specified Sheet. Headers plus data required.' });
        }
        
        // 1. Calculate the hash of the data (excluding headers/first row)
        const assetData = dataRows.slice(1);
        const dataHashBuffer = calculateDataHash(assetData);

        // 2. Submit the hash to the Stacks contract
        const txId = await submitHashToStacks(assetId, dataHashBuffer);

        res.json({ 
            message: `Asset hash successfully recorded on Stacks. Awaiting confirmation.`,
            assetId: assetId,
            hash: dataHashBuffer.toString('hex'),
            transactionId: txId
        });

    } catch (error) {
        console.error('Audit failed:', error.message);
        res.status(500).json({ 
            error: `Audit process failed: ${error.message}`,
            details: error.response ? error.response.data : 'See server logs for details.'
        });
    }
});


app.listen(PORT, () => {
    console.log(`Asset Registry Middleware listening on port ${PORT}`);
    console.log(`Audit endpoint: POST http://localhost:${PORT}/api/audit-asset`);
});
