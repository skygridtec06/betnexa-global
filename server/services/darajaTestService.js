const https = require('https');

const DARAJA_HOST = 'api.safaricom.co.ke';

function getDarajaTestConfig() {
  const config = {
    consumerKey: process.env.DARAJA_TEST_CONSUMER_KEY,
    consumerSecret: process.env.DARAJA_TEST_CONSUMER_SECRET,
    passkey: process.env.DARAJA_TEST_PASSKEY,
    shortCode: process.env.DARAJA_TEST_SHORT_CODE,
    partyB: process.env.DARAJA_TEST_PARTY_B,
    transactionType: process.env.DARAJA_TEST_TRANSACTION_TYPE || 'CustomerPayBillOnline',
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => !value && key !== 'transactionType')
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Daraja test configuration: ${missing.join(', ')}`);
  }

  return config;
}

function normalizeDarajaPhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');

  if (/^254\d{9}$/.test(digits)) {
    return digits;
  }

  if (/^0\d{9}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }

  if (/^[17]\d{8}$/.test(digits)) {
    return `254${digits}`;
  }

  throw new Error('Phone number must be a valid Kenyan mobile number');
}

function getTimestamp() {
  const now = new Date();
  const pad = (value) => `${value}`.padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function performJsonRequest({ method, path, headers }, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;

    const req = https.request(
      {
        hostname: DARAJA_HOST,
        port: 443,
        path,
        method,
        headers: {
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              }
            : {}),
          ...headers,
        },
        timeout: 30000,
      },
      (res) => {
        let raw = '';

        res.on('data', (chunk) => {
          raw += chunk;
        });

        res.on('end', () => {
          let parsed = {};

          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (error) {
            reject(new Error(`Failed to parse Daraja response: ${error.message}`));
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
            return;
          }

          reject(new Error(parsed.errorMessage || parsed.ResponseDescription || `Daraja request failed with status ${res.statusCode}`));
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Daraja request timed out'));
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function getAccessToken() {
  const { consumerKey, consumerSecret } = getDarajaTestConfig();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const response = await performJsonRequest({
    method: 'GET',
    path: '/oauth/v1/generate?grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.access_token) {
    throw new Error('Daraja access token was not returned');
  }

  return response.access_token;
}

async function callDaraja(path, payload) {
  const accessToken = await getAccessToken();

  return performJsonRequest(
    {
      method: 'POST',
      path,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    payload
  );
}

async function initiateAdminTestStkPush({ phoneNumber, amount, accountReference, transactionDesc, callbackUrl }) {
  const config = getDarajaTestConfig();
  const normalizedPhone = normalizeDarajaPhoneNumber(phoneNumber);
  const timestamp = getTimestamp();
  const password = Buffer.from(`${config.shortCode}${config.passkey}${timestamp}`).toString('base64');
  const partyB = config.partyB || config.shortCode;

  const response = await callDaraja('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: config.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: config.transactionType,
    Amount: Math.round(parseFloat(amount)),
    PartyA: normalizedPhone,
    PartyB: partyB,
    PhoneNumber: normalizedPhone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  });

  if (`${response.ResponseCode || ''}` !== '0') {
    throw new Error(response.ResponseDescription || 'Daraja STK push initiation failed');
  }

  return {
    checkoutRequestId: response.CheckoutRequestID,
    merchantRequestId: response.MerchantRequestID,
    responseCode: response.ResponseCode,
    responseDescription: response.ResponseDescription,
    customerMessage: response.CustomerMessage,
    normalizedPhone,
  };
}

async function queryAdminTestStkPushStatus({ checkoutRequestId }) {
  const config = getDarajaTestConfig();
  const timestamp = getTimestamp();
  const password = Buffer.from(`${config.shortCode}${config.passkey}${timestamp}`).toString('base64');

  return callDaraja('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: config.shortCode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  });
}

module.exports = {
  initiateAdminTestStkPush,
  normalizeDarajaPhoneNumber,
  queryAdminTestStkPushStatus,
};