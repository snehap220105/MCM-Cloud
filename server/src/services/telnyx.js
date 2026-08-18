import Telnyx from 'telnyx';
import 'dotenv/config';

const client = new Telnyx({ apiKey: process.env.TELNYX_API_KEY });

/** Sends an OTP SMS to `phoneNumber` (E.164). Returns the Telnyx verification id. */
export async function requestOtp(phoneNumber) {
  const verification = await client.verifications.triggerSMS({
    phone_number: phoneNumber,
    verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID,
  });
  return verification.data.id;
}

/** Checks `code` against a previously-created verification. Returns true if it matched. */
export async function confirmOtp(verificationId, code) {
  const result = await client.verifications.actions.verify(verificationId, { code });
  return result.data.response_code === 'accepted';
}

/** Sends a plain SMS (used for security alerts). */
export async function sendSms(toNumber, text) {
  return client.messages.send({
    from: process.env.TELNYX_FROM_NUMBER,
    to: toNumber,
    text,
  });
}
