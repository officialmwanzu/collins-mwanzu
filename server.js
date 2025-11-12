// server.js
require('dotenv').config(); // Use .env file for sensitive data
const express = require('express');
const axios = require('axios');
const moment = require('moment');
const bodyParser = require('body-parser');
const cors = require('cors'); // To allow the frontend (on a different port) to connect

const app = express();
const port = 5000; // Choose a port for your backend

// --- Middleware ---
// Using cors to allow your frontend HTML to make requests
app.use(cors({ origin: 'http://127.0.0.1:5500' })); // Replace with your actual frontend URL/port
app.use(bodyParser.json());

// --- M-Pesa Configuration (Use Environment Variables in production!) ---
const AUTH_DETAILS = {
    CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY || 'YOUR_CONSUMER_KEY', // from Daraja App
    CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET', // from Daraja App
    BUSINESS_SHORT_CODE: process.env.MPESA_SHORT_CODE || '600990', // M-Pesa Paybill/Till number (Sandbox: 600990 or 174379)
    LIPA_NA_MPESA_PASSKEY: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ad77b5d922f', // STK Passkey (Sandbox: bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ad77b5d922f)
    CALLBACK_URL: process.env.MPESA_CALLBACK_URL || 'YOUR_PUBLIC_URL/mpesa/callback', // A publicly accessible URL for Safaricom to send the result (e.g., ngrok URL)
    // Sandbox URLs
    AUTH_URL: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    STK_PUSH_URL: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
};

// ====================================================================
// 1. Get Access Token
// ====================================================================

/**
 * Gets the M-Pesa Access Token using Basic Authentication.
 */
const getAccessToken = async () => {
    try {
        const auth = Buffer.from(`${AUTH_DETAILS.CONSUMER_KEY}:${AUTH_DETAILS.CONSUMER_SECRET}`).toString('base64');
        const response = await axios.get(AUTH_DETAILS.AUTH_URL, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error getting M-Pesa access token:", error.message);
        throw new Error("Failed to get M-Pesa Access Token");
    }
};

// ====================================================================
// 2. STK Push Checkout Endpoint
// ====================================================================

app.post('/mpesa/stkpush', async (req, res) => {
    const { amount, phone, accountRef, transactionDesc } = req.body;
    
    if (!amount || !phone || !accountRef || !transactionDesc) {
        return res.status(400).json({ success: false, message: "Missing required parameters: amount, phone, accountRef, transactionDesc" });
    }

    // Format phone to 254... (M-Pesa requirement)
    const formattedPhone = phone.startsWith('0') ? `254${phone.substring(1)}` : phone;

    try {
        const token = await getAccessToken();
        const timestamp = moment().format('YYYYMMDDHHmmss');
        
        // Generate the Password (Base64 encoded string)
        const password = Buffer.from(
            AUTH_DETAILS.BUSINESS_SHORT_CODE + AUTH_DETAILS.LIPA_NA_MPESA_PASSKEY + timestamp
        ).toString('base64');

        const stkPushData = {
            BusinessShortCode: AUTH_DETAILS.BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline', // For PayBill
            Amount: amount,
            PartyA: formattedPhone, // Customer's phone number
            PartyB: AUTH_DETAILS.BUSINESS_SHORT_CODE,
            PhoneNumber: formattedPhone,
            CallBackURL: AUTH_DETAILS.CALLBACK_URL,
            AccountReference: accountRef, // Your unique identifier for the transaction
            TransactionDesc: transactionDesc
        };

        const response = await axios.post(AUTH_DETAILS.STK_PUSH_URL, stkPushData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // The response from M-Pesa is a Request ID
        res.json({ 
            success: true, 
            message: 'STK Push initiated successfully. A prompt will appear on the customer\'s phone.',
            merchantRequestId: response.data.MerchantRequestID,
            checkoutRequestId: response.data.CheckoutRequestID
        });

    } catch (error) {
        // Log the error for debugging
        console.error("STK Push error:", error.message);
        // Safely send a generic error to the frontend
        res.status(500).json({ 
            success: false, 
            message: "Failed to initiate M-Pesa STK Push.",
            detail: error.response ? error.response.data : error.message // Expose more detail for development
        });
    }
});

// ====================================================================
// 3. M-Pesa Callback Endpoint (For Safaricom to send payment status)
// ====================================================================

app.post('/mpesa/callback', (req, res) => {
    console.log("--- M-Pesa Callback Received ---");
    const callbackData = req.body;
    
    // NOTE: In a real application, you would:
    // 1. Validate the callback data (e.g., compare security credentials)
    // 2. Parse the result (Success/Failure)
    // 3. Update your database with the transaction status
    // 4. Send a receipt/confirmation email to the customer
    
    // For simplicity, we just log the data and send a 200 OK back to Safaricom
    console.log(JSON.stringify(callbackData, null, 2));

    // Safaricom expects a 200 OK response
    res.status(200).send('Callback Received'); 
});


// ====================================================================
// Start Server
// ====================================================================

app.listen(port, () => {
    console.log(`M-Pesa Backend Server running at http://localhost:${port}`);
    console.log(`STK Push Endpoint: http://localhost:${port}/mpesa/stkpush`);
    console.log(`Callback Endpoint: http://localhost:${port}/mpesa/callback (Requires public URL like Ngrok)`);
});
