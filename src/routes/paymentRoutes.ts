import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { authenticate } from '../middleware/auth';
import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import { sendOrderConfirmationEmail, sendRefundEmail } from '../utils/orderEmails';

const logWithTime = (message: string) => {
    const formattedDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const yellowTimestamp = `\x1b[33m[${formattedDate}]\x1b[0m`;
    console.log(`${yellowTimestamp} ${message}`);
};

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// @route   POST /api/payment/create-order
// @desc    Create Razorpay order and save to DB
// @access  Private
router.post('/create-order', authenticate, async (req: any, res: any) => {
    try {
        const { orderItems, shippingAddress, itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body;

        if (orderItems && orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        // 1. Create Order in MongoDB first (Status: Pending)
        const order = new Order({
            user: req.user.userId,
            orderItems,
            shippingAddress,
            paymentMethod: 'Razorpay',
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            status: 'Pending',
        });
        const createdOrder = await order.save();
        logWithTime(`POST /api/payment/create-order - [Create Order] Status: ${createdOrder.status}`);

        // 2. Create Order in Razorpay
        // Amount is in paisa (multiply by 100)
        const amountInPaisa = Math.round(Number(totalPrice) * 100);

        const options = {
            amount: amountInPaisa,
            currency: 'INR',
            receipt: createdOrder._id.toString(),
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // 3. Save Razorpay Order ID to MongoDB
        createdOrder.razorpayOrderId = razorpayOrder.id;
        await createdOrder.save();

        res.status(201).json({
            order: createdOrder,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
        });
    } catch (error: any) {
        console.error('Create Order Error:', error);
        res.status(500).json({ message: error.message || 'Server Error' });
    }
});

// @route   POST /api/payment/verify
// @desc    Verify Razorpay signature after frontend payment success
// @access  Private
router.post('/verify', authenticate, async (req: any, res: any) => {
    try {
        const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify Signature
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ message: 'Invalid signature. Payment verification failed.' });
        }

        // Fetch payment details to get the exact method (upi, card, netbanking)
        let method = 'Razorpay';
        try {
            const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);
            if (paymentDetails && paymentDetails.method) {
                method = paymentDetails.method;
            }
        } catch (err) {
            console.error('Error fetching razorpay payment details:', err);
        }

        // Mark order as paid
        order.isPaid = true;
        order.paidAt = new Date();
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpaySignature = razorpaySignature;
        order.status = 'Captured';
        order.paymentMethod = method; // e.g. 'upi', 'card'
        order.paymentResult = {
            id: razorpayPaymentId,
            status: 'Captured',
            update_time: new Date().toISOString(),
            email_address: req.user?.email || '',
        };

        const updatedOrder = await order.save();

        // Increment product sales
        if (updatedOrder.orderItems && updatedOrder.orderItems.length > 0) {
            for (const item of updatedOrder.orderItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { salesCount: item.qty }
                });
            }
        }

        // Send Order Confirmation Email
        let userEmail = req.user?.email;
        if (!userEmail && updatedOrder.user) {
            const user = await User.findById(updatedOrder.user);
            if (user && user.email) {
                userEmail = user.email;
            }
        }
        if (userEmail) {
            sendOrderConfirmationEmail(userEmail, updatedOrder).catch((e: any) => console.error(e));
        }

        logWithTime(`POST /api/payment/verify - [Verify] Status Updated To: ${updatedOrder.status}`);

        res.json({ message: 'Payment verified successfully', order: updatedOrder });
    } catch (error: any) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({ message: error.message || 'Server Error' });
    }
});

// @route   POST /api/payment/refund
// @desc    Process a refund for an order
// @access  Private (Ideally should be Admin only, keeping authenticate for now)
router.post('/refund', authenticate, async (req: any, res: any) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const { orderId, amount } = req.body; // Amount is optional for partial refund

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.isPaid || !order.razorpayPaymentId) {
            return res.status(400).json({ message: 'Order is not paid yet' });
        }

        // Amount must be in paisa if specified
        const refundOptions: any = {};
        if (amount) {
            refundOptions.amount = Math.round(Number(amount) * 100);
        }

        let refund;
        try {
            refund = await razorpay.payments.refund(order.razorpayPaymentId, refundOptions);
        } catch (err: any) {
            if (err?.error?.description === 'The payment has been fully refunded already') {
                order.status = 'Refunded';
                order.refundStatus = 'processed';
                await order.save();
                return res.json({ message: 'Payment was already refunded on Razorpay. Status synced.', status: 'Refunded' });
            }
            throw err; // Rethrow other errors to the main catch block
        }

        let newStatus = 'Refund Initiated';
        let newRefundStatus = 'pending';

        if (refund && refund.status === 'processed') {
            newStatus = 'Refunded';
            newRefundStatus = 'processed';
        } else if (refund && refund.status === 'failed') {
            newStatus = 'Refund Failed';
            newRefundStatus = 'failed';
        }

        order.status = newStatus as any;
        order.refundStatus = newRefundStatus as any;
        const updatedOrder = await order.save();

        if (newStatus === 'Refunded' && updatedOrder.orderItems && updatedOrder.orderItems.length > 0) {
            for (const item of updatedOrder.orderItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { salesCount: -item.qty }
                });
            }
        }

        let userEmail = null;
        if (updatedOrder.user) {
            const user = await User.findById(updatedOrder.user);
            if (user && user.email) {
                userEmail = user.email;
            }
        }
        if (userEmail) {
            sendRefundEmail(userEmail, updatedOrder, newStatus).catch((e: any) => console.error(e));
        }

        res.json({ message: 'Refund processed successfully', refund, status: newStatus });
    } catch (error: any) {
        console.error('Refund Error:', error);
        res.status(500).json({ message: error.message || 'Server Error processing refund' });
    }
});

// @route   POST /api/payment/webhook
// @desc    Razorpay Webhook Endpoint
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
        logWithTime('POST /api/payment/webhook - [Webhook] Received webhook request');
        // Verify Webhook Signature
        const signature = req.headers['x-razorpay-signature'];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(req.rawBody)
            .digest('hex');

        const event = req.body.event;
        const payload = req.body.payload;

        if (expectedSignature !== signature) {
            // Return 200 to stop Razorpay from endlessly retrying old events
            return res.status(200).send('Invalid signature but returning 200 to clear retry queue');
        }

        logWithTime(`POST /api/payment/webhook - [Webhook] Signature verified. Event: ${event}`);

        if (event === 'payment.captured') {
            const payment = payload.payment.entity;
            const orderId = payment.order_id;

            const order = await Order.findOne({ razorpayOrderId: orderId });
            if (order && !order.isPaid) {
                order.isPaid = true;
                order.status = 'Captured';
                order.paymentMethod = payment.method || 'Razorpay';
                await order.save();

                // Increment product sales
                if (order.orderItems && order.orderItems.length > 0) {
                    for (const item of order.orderItems) {
                        await Product.findByIdAndUpdate(item.product, {
                            $inc: { salesCount: item.qty }
                        });
                    }
                }
                logWithTime('POST /api/payment/webhook - [Webhook] Order Status Updated To: Captured & Sales Incremented');
            } else if (order && payment.method) {
                // Just update method if already paid
                order.paymentMethod = payment.method;
                await order.save();
                logWithTime('POST /api/payment/webhook - [Webhook] Order Payment Method Updated');
            }
        }

        if (event === 'payment.failed') {
            const payment = payload.payment.entity;
            const orderId = payment.order_id;
            await Order.findOneAndUpdate(
                { razorpayOrderId: orderId },
                { status: 'Cancelled', paymentMethod: payment.method || 'Razorpay' }
            );
            logWithTime('POST /api/payment/webhook - [Webhook] Order Status Updated To: Cancelled');
        }

        if (event === 'refund.created') {
            logWithTime('POST /api/payment/webhook - [Webhook] Refund Initiated (Created)');
        }

        if (event === 'refund.processed') {
            try {
                const refund = payload.refund.entity;
                const paymentId = refund.payment_id;

                const order = await Order.findOne({ razorpayPaymentId: paymentId });
                if (order && order.status !== 'Refunded') {
                    order.status = 'Refunded';
                    order.refundStatus = 'processed';
                    await order.save();

                    // Decrement product sales since the sale was reversed
                    if (order.orderItems && order.orderItems.length > 0) {
                        for (const item of order.orderItems) {
                            await Product.findByIdAndUpdate(item.product, {
                                $inc: { salesCount: -item.qty }
                            });
                        }
                    }
                    logWithTime('POST /api/payment/webhook - [Webhook] Order Status Updated To: Refunded & Sales Decremented');
                }
            } catch (e) {
                console.error('Webhook refund.processed Error:', e);
            }
        }

        if (event === 'refund.failed') {
            const refund = payload.refund.entity;
            const paymentId = refund.payment_id;

            const order = await Order.findOne({ razorpayPaymentId: paymentId });
            if (order && order.status !== 'Refund Failed') {
                order.status = 'Refund Failed';
                order.refundStatus = 'failed';
                await order.save();
                logWithTime('POST /api/payment/webhook - [Webhook] Order Status Updated To: Refund Failed');
            }
        }

        logWithTime(`POST /api/payment/webhook - [Webhook] Successfully processed event: ${event}`);
        res.status(200).json({ status: 'ok' });
    } catch (error: any) {
        console.error('Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});

export default router;
