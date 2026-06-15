import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../Config/prisma';

const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    const { amount = 1500 } = req.body; // Default 1500 INR for Pro Plan

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay keys are not configured' });
    }

    const instance = getRazorpayInstance();

    const options = {
      amount: amount * 100, // Razorpay works in paise (multiply by 100)
      currency: 'INR',
      receipt: `rct_${Date.now()}`.substring(0, 40),
      notes: {
        userId: userId,
        plan: 'pro'
      }
    };

    const order = await instance.orders.create(options);
    
    if (!order) {
      return res.status(500).json({ error: 'Failed to create Razorpay order' });
    }

    res.json(order);
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error?.error || error);
    res.status(500).json({ error: 'Server error during order creation', details: error?.error || error?.message });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || '';

    // Verify signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({ error: 'Transaction not legitimate!' });
    }

    // Update User Plan in Database
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'pro'
      }
    });

    res.json({
      success: true,
      message: 'Payment verified and plan upgraded successfully!',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id
    });
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error?.message || error);
    res.status(500).json({ error: 'Server error during payment verification', details: error?.message || error });
  }
};
