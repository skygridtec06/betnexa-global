/**
 * SMS Service — TextSMS Kenya (sms.textsms.co.ke)
 *
 * Required environment variables:
 *   TEXTSMS_API_KEY    — API key from your TextSMS dashboard
 *   TEXTSMS_PARTNER_ID — Partner ID from your TextSMS dashboard
 *   TEXTSMS_SHORTCODE  — Sender name / shortcode (e.g. "BETNEXA")
 */

const https = require('https');

const TEXTSMS_ENDPOINT_HOSTNAME = 'sms.textsms.co.ke';
const TEXTSMS_ENDPOINT_PATH = '/api/services/sendsms/';

/**
 * Normalize a Kenyan phone number to 254XXXXXXXXX format.
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits;
  // Return as-is if it doesn't match expected patterns (let API decide)
  return digits;
}

/**
 * Low-level HTTPS request to the TextSMS API.
 * Returns the parsed response object, or null on network error.
 */
function postToTextSmsApi(payload) {
  return new Promise((resolve) => {
    const bodyData = JSON.stringify(payload);
    const options = {
      hostname: TEXTSMS_ENDPOINT_HOSTNAME,
      path: TEXTSMS_ENDPOINT_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({ raw });
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ [SMS] HTTPS request error:', err.message);
      resolve(null);
    });

    req.write(bodyData);
    req.end();
  });
}

/**
 * Send an SMS message.
 * This is fire-and-forget — it never throws; it only logs on failure.
 *
 * @param {string} phone   Recipient phone (any common Kenyan format)
 * @param {string} message Text to send
 * @returns {Promise<boolean>} true if sent successfully
 */
async function sendSms(phone, message) {
  const apiKey = (process.env.TEXTSMS_API_KEY || '').trim();
  const partnerId = (process.env.TEXTSMS_PARTNER_ID || '').trim();
  const shortcode = (process.env.TEXTSMS_SHORTCODE || '').trim() || 'TextSMS';

  if (!apiKey || !partnerId) {
    console.warn('⚠️  [SMS] TEXTSMS_API_KEY / TEXTSMS_PARTNER_ID not set — skipping SMS.');
    return false;
  }

  const mobile = normalizePhone(phone);
  if (!mobile || mobile.length < 10) {
    console.warn('⚠️  [SMS] Invalid phone number skipped:', phone);
    return false;
  }

  const payload = {
    apikey: apiKey,
    partnerID: String(partnerId),
    message,
    shortcode,
    mobile,
  };

  const result = await postToTextSmsApi(payload);

  if (!result) {
    console.warn('⚠️  [SMS] No response from TextSMS API for mobile:', mobile);
    return false;
  }

  // TextSMS responds with { responses: [{ "response-code": 200, ... }] }
  const responseCode = result?.responses?.[0]?.['response-code'];
  if (responseCode === 200 || responseCode === '200') {
    console.log(`✅ [SMS] Message sent → ${mobile}`);
    return true;
  }

  console.warn(`⚠️  [SMS] TextSMS response for ${mobile}:`, JSON.stringify(result));
  return false;
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

/**
 * Sent when a new user registers.
 */
async function sendWelcomeSms(phone, username) {
  const msg =
    `Welcome to BETNEXA, Cheers${username} ! ` +
    `You have successfully signed up. Deposit via M-Pesa to start betting. Good luck and welcome to the site of winners!`;
  return sendSms(phone, msg);
}

/**
 * Sent when a bet is placed successfully.
 */
async function sendBetPlacedSms(phone, betId, stake, potentialWin, newBalance) {
  const msg =
    `Confirmed Bet ${betId} successfully placed. ` +
    `Stake: KSH ${Number(stake).toFixed(0)}. ` +
    `Potential win: KSH ${Number(potentialWin).toFixed(0)}. ` +
    `Your BETNEXA balance: KSH ${Number(newBalance).toFixed(0)}.`;
  return sendSms(phone, msg);
}

/**
 * Sent when a bet is settled as Won.
 */
async function sendBetWonSms(phone, betId, amountWon) {
  const msg =
    `Congratulations! Your BETNEXA Bet ${betId} has WON! ` +
    `KSH ${Number(amountWon).toFixed(0)} added to your winnings balance. ` +
    `Withdraw anytime from your account.`;
  return sendSms(phone, msg);
}

/**
 * Sent after a deposit is confirmed (M-Pesa callback success).
 */
async function sendDepositSms(phone, amount, newBalance) {
  const msg =
    `Received a deposit of KSH ${Number(amount).toFixed(0)} on your Betnexa wallet. ` +
    `New balance: KSH ${Number(newBalance).toFixed(0)}. ` +
    `Place your bets now! on https://Betnexa.vercel.app`;
  return sendSms(phone, msg);
}

/**
 * Sent when a withdrawal is initiated.
 */
async function sendWithdrawalSms(phone, amount) {
  const msg =
    `Hooray!!! Your Withdrawal of KSH ${Number(amount).toFixed(0)} is being processed. ` +
    `Funds will arrive on your M-Pesa as soon as all .`;
  return sendSms(phone, msg);
}

/**
 * Sent when an admin activates the user's withdrawal account.
 */
async function sendActivationSms(phone, username) {
  const msg =
    `BETNEXA: Hi ${username}, your withdrawal account has been activated! ` +
    `You can now withdraw your winnings directly to M-Pesa.  Login your account now on https://Betnexa.vercel.app`;
  return sendSms(phone, msg);
}

/**
 * Sent to users who have been inactive for a while (inactivity reminder cron).
 */
async function sendInactivityReminderSms(phone, username) {
  const msg =
    `Hi ${username}, we miss you at BETNEXA! ` +
    `Log in now to check today's matches and amazing odds. Big wins await! https://Betnexa.vercel.app`;
  return sendSms(phone, msg);
}

module.exports = {
  sendSms,
  sendWelcomeSms,
  sendBetPlacedSms,
  sendBetWonSms,
  sendDepositSms,
  sendWithdrawalSms,
  sendActivationSms,
  sendInactivityReminderSms,
};
