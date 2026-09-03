import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TXY51X8Iwi53nE';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'jtTBn5tqGFZ5YWTZc5kBTuZT';

export const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});
