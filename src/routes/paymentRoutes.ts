import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
// import Razorpay from 'razorpay';
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

/*
// RAZORPAY CONFIGURATION (COMMENTED OUT)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});
*/

// CASHFREE CONFIGURATION
const getCashfreeBaseUrl = () => {
    const env = process.env.CASHFREE_ENV || 'sandbox';
    return env === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
};

const getCashfreeHeaders = () => {
    return {
        'x-client-id': process.env.CASHFREE_APP_ID || '',
        'x-client-secret': process.env.CASHFREE_SECRET_KEY || '',
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
    };
};

const sanitizePhone = (phoneInput: any): string => {
    if (!phoneInput) return '9999999999';
    const cleaned = String(phoneInput).replace(/\D/g, '');
    if (cleaned.length === 10) return cleaned;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.substring(2);
    if (cleaned.length > 10) return cleaned.slice(-10);
    if (cleaned.length > 0 && cleaned.length < 10) return cleaned.padStart(10, '9');
    return '9999999999';
};

const sanitizeCustomerId = (userId: any): string => {
    let idStr = String(userId || 'cust_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    if (idStr.length < 3) idStr = 'cust_' + idStr;
    return idStr.substring(0, 45);
};

const sanitizeCustomerName = (name: any): string => {
    const clean = String(name || 'Customer').trim().replace(/[^\w\s-]/g, '');
    return clean.length >= 3 ? clean.substring(0, 50) : 'Customer';
};

// @route   POST /api/payment/create-order
// @desc    Create Cashfree order (and save to DB)
// @access  Private
router.post('/create-order', authenticate, async (req: any, res: any) => {
    try {
        const { orderItems, shippingAddress, itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body;

        if (!orderItems || orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        // Sanitize order items to ensure valid image and fields
        const sanitizedOrderItems = orderItems.map((item: any) => ({
            product: item.product,
            name: item.name || 'Product',
            qty: Number(item.qty) || 1,
            image: item.image || item.product?.images?.[0] || item.product?.image || '/placeholder.png',
            price: Number(item.price) || 0,
        }));

        // 1. Create Order in MongoDB first (Status: Pending)
        const order = new Order({
            user: req.user.userId,
            orderItems: sanitizedOrderItems,
            shippingAddress,
            paymentMethod: 'Cashfree',
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            status: 'Pending',
        });
        const createdOrder = await order.save();
        logWithTime(`POST /api/payment/create-order - [Create Order] Status: ${createdOrder.status}`);

        /*
        // ORIGINAL RAZORPAY ORDER CREATION (COMMENTED OUT)
        const amountInPaisa = Math.round(Number(totalPrice) * 100);
        const options = {
            amount: amountInPaisa,
            currency: 'INR',
            receipt: createdOrder._id.toString(),
        };
        const razorpayOrder = await razorpay.orders.create(options);
        createdOrder.razorpayOrderId = razorpayOrder.id;
        await createdOrder.save();
        */

        // 2. Create Order in Cashfree
        const rawPhone = shippingAddress?.phone || req.user?.phone || req.user?.mobileNumber;
        const rawName = shippingAddress?.fullName || req.user?.name;

        const cashfreeOrderData = {
            order_id: createdOrder._id.toString(),
            order_amount: Math.round(Number(totalPrice) * 100) / 100,
            order_currency: 'INR',
            customer_details: {
                customer_id: sanitizeCustomerId(req.user.userId),
                customer_name: sanitizeCustomerName(rawName),
                customer_email: req.user?.email || 'customer@example.com',
                customer_phone: sanitizePhone(rawPhone),
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/orders?order_id={order_id}`,
            },
        };

        const cashfreeRes = await axios.post(
            `${getCashfreeBaseUrl()}/orders`,
            cashfreeOrderData,
            { headers: getCashfreeHeaders(), timeout: 15000 }
        );

        const { cf_order_id, payment_session_id, order_id } = cashfreeRes.data;

        // 3. Save Cashfree Details to MongoDB Order
        createdOrder.cashfreeOrderId = order_id || cf_order_id;
        createdOrder.paymentSessionId = payment_session_id;
        await createdOrder.save();

        logWithTime(`POST /api/payment/create-order - [Cashfree Order Created] Session: ${payment_session_id}`);

        res.status(201).json({
            order: createdOrder,
            cashfreeOrderId: order_id || cf_order_id,
            paymentSessionId: payment_session_id,
            amount: Math.round(Number(totalPrice) * 100),
            currency: 'INR',
        });
    } catch (error: any) {
        console.error('Create Order Error:', error?.response?.data || error.message || error);
        res.status(error?.response?.status || 500).json({
            message: error?.response?.data?.message || error.message || 'Server Error creating payment order'
        });
    }
});

// @route   POST /api/payment/verify
// @desc    Verify Cashfree payment status after checkout
// @access  Private
router.post('/verify', authenticate, async (req: any, res: any) => {
    try {
        const { orderId, cashfreeOrderId } = req.body;

        const targetOrderId = orderId || cashfreeOrderId;
        const order = await Order.findById(targetOrderId) || await Order.findOne({ cashfreeOrderId: targetOrderId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        /*
        // ORIGINAL RAZORPAY VERIFICATION LOGIC (COMMENTED OUT)
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(body.toString())
            .digest('hex');
        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ message: 'Invalid signature. Payment verification failed.' });
        }
        */

        // Verify Payment via Cashfree REST API
        const cfOrderId = order.cashfreeOrderId || order._id.toString();
        const cfOrderRes = await axios.get(
            `${getCashfreeBaseUrl()}/orders/${cfOrderId}`,
            { headers: getCashfreeHeaders(), timeout: 15000 }
        );

        const cfOrderStatus = cfOrderRes.data?.order_status;
        logWithTime(`POST /api/payment/verify - [Cashfree Status] Order ID: ${cfOrderId}, Status: ${cfOrderStatus}`);

        // Fetch payment list for specific payment ID & method
        let cfPaymentId = '';
        let paymentMethod = 'Cashfree';
        try {
            const cfPaymentsRes = await axios.get(
                `${getCashfreeBaseUrl()}/orders/${cfOrderId}/payments`,
                { headers: getCashfreeHeaders(), timeout: 15000 }
            );
            if (Array.isArray(cfPaymentsRes.data) && cfPaymentsRes.data.length > 0) {
                const successfulPayment = cfPaymentsRes.data.find((p: any) => p.payment_status === 'SUCCESS') || cfPaymentsRes.data[0];
                cfPaymentId = successfulPayment.cf_payment_id ? String(successfulPayment.cf_payment_id) : '';
                paymentMethod = successfulPayment.payment_group || 'Cashfree';
            }
        } catch (e) {
            console.error('Error fetching cashfree payment list:', e);
        }

        if (cfOrderStatus === 'PAID' || cfPaymentId) {
            order.isPaid = true;
            order.paidAt = new Date();
            order.cashfreePaymentId = cfPaymentId || `cf_pay_${Date.now()}`;
            order.status = 'Captured';
            order.paymentMethod = 'Cashfree';
            order.paymentResult = {
                id: order.cashfreePaymentId,
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

            return res.json({ message: 'Payment verified successfully', order: updatedOrder });
        } else {
            return res.status(400).json({
                message: `Payment status is ${cfOrderStatus}. Payment verification failed or pending.`,
                order
            });
        }
    } catch (error: any) {
        console.error('Verify Payment Error:', error?.response?.data || error.message || error);
        res.status(500).json({ message: error?.response?.data?.message || error.message || 'Server Error' });
    }
});

// @route   POST /api/payment/refund
// @desc    Process a refund for an order via Cashfree
// @access  Private (Admin)
router.post('/refund', authenticate, async (req: any, res: any) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const { orderId, amount } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!order.isPaid) {
            return res.status(400).json({ message: 'Order is not paid yet' });
        }

        /*
        // ORIGINAL RAZORPAY REFUND LOGIC (COMMENTED OUT)
        const refundOptions: any = {};
        if (amount) refundOptions.amount = Math.round(Number(amount) * 100);
        let refund = await razorpay.payments.refund(order.razorpayPaymentId, refundOptions);
        */

        const cfOrderId = order.cashfreeOrderId || order._id.toString();
        const refundId = `refund_${Date.now()}`;
        const refundPayload = {
            refund_amount: Number(amount) || Number(order.totalPrice),
            refund_id: refundId,
            refund_note: 'Admin initiated refund via Cashfree',
        };

        let cfRefundRes;
        try {
            cfRefundRes = await axios.post(
                `${getCashfreeBaseUrl()}/orders/${cfOrderId}/refunds`,
                refundPayload,
                { headers: getCashfreeHeaders(), timeout: 15000 }
            );
        } catch (err: any) {
            console.error('Cashfree Refund Error Response:', err?.response?.data || err.message);
            throw new Error(err?.response?.data?.message || 'Cashfree refund request failed');
        }

        const refundData = cfRefundRes.data;
        let newStatus = 'Refund Initiated';
        let newRefundStatus = 'pending';

        if (refundData && (refundData.refund_status === 'SUCCESS' || refundData.refund_status === 'PROCESSED')) {
            newStatus = 'Refunded';
            newRefundStatus = 'processed';
        } else if (refundData && refundData.refund_status === 'FAILED') {
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

        res.json({ message: 'Refund processed successfully', refund: refundData, status: newStatus });
    } catch (error: any) {
        console.error('Refund Error:', error);
        res.status(500).json({ message: error.message || 'Server Error processing refund' });
    }
});

// @route   POST /api/payment/webhook
// @desc    Cashfree & Razorpay Webhook Endpoint
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
    try {
        logWithTime('POST /api/payment/webhook - [Webhook] Received webhook request');

        /*
        // ORIGINAL RAZORPAY WEBHOOK LOGIC (COMMENTED OUT)
        const signature = req.headers['x-razorpay-signature'];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(req.rawBody)
            .digest('hex');
        if (expectedSignature !== signature) { ... }
        */

        // Cashfree Webhook Processing
        const cfSignature = req.headers['x-webhook-signature'];
        const cfTimestamp = req.headers['x-webhook-timestamp'];
        const secret = process.env.CASHFREE_SECRET_KEY || '';

        if (cfSignature && cfTimestamp && secret) {
            const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
            const signatureData = cfTimestamp + rawBody;
            const expectedCfSignature = crypto
                .createHmac('sha256', secret)
                .update(signatureData)
                .digest('base64');

            if (expectedCfSignature !== cfSignature) {
                logWithTime('POST /api/payment/webhook - [Webhook] Cashfree Signature mismatch');
            }
        }

        const type = req.body.type || req.body.event;
        const data = req.body.data;

        logWithTime(`POST /api/payment/webhook - [Webhook] Event type: ${type}`);

        if (type === 'PAYMENT_SUCCESS_WEBHOOK' && data?.order) {
            const orderId = data.order.order_id;
            const order = await Order.findOne({ $or: [{ cashfreeOrderId: orderId }, { _id: orderId }] });

            if (order && !order.isPaid) {
                order.isPaid = true;
                order.status = 'Captured';
                order.cashfreePaymentId = data.payment?.cf_payment_id ? String(data.payment.cf_payment_id) : '';
                order.paymentMethod = data.payment?.payment_group || 'Cashfree';
                await order.save();

                if (order.orderItems && order.orderItems.length > 0) {
                    for (const item of order.orderItems) {
                        await Product.findByIdAndUpdate(item.product, {
                            $inc: { salesCount: item.qty }
                        });
                    }
                }
                logWithTime('POST /api/payment/webhook - [Webhook] Order Captured via Cashfree Webhook');
            }
        }

        if (type === 'PAYMENT_FAILED_WEBHOOK' && data?.order) {
            const orderId = data.order.order_id;
            await Order.findOneAndUpdate(
                { $or: [{ cashfreeOrderId: orderId }, { _id: orderId }] },
                { status: 'Cancelled' }
            );
            logWithTime('POST /api/payment/webhook - [Webhook] Order Cancelled via Cashfree Webhook');
        }

        if (type === 'REFUND_STATUS_WEBHOOK' && data?.refund) {
            const refund = data.refund;
            const orderId = refund.order_id;
            const refundStatus = refund.refund_status;

            const order = await Order.findOne({ $or: [{ cashfreeOrderId: orderId }, { _id: orderId }] });
            if (order) {
                if (refundStatus === 'SUCCESS' || refundStatus === 'PROCESSED') {
                    order.status = 'Refunded';
                    order.refundStatus = 'processed';
                    await order.save();

                    // Decrement sales count
                    if (order.orderItems && order.orderItems.length > 0) {
                        for (const item of order.orderItems) {
                            await Product.findByIdAndUpdate(item.product, {
                                $inc: { salesCount: -item.qty }
                            });
                        }
                    }
                    logWithTime('POST /api/payment/webhook - [Webhook] Order Status Updated To: Refunded & Sales Decremented');
                } else if (refundStatus === 'FAILED') {
                    order.status = 'Refund Failed';
                    order.refundStatus = 'failed';
                    await order.save();
                    logWithTime('POST /api/payment/webhook - [Webhook] Order Status Updated To: Refund Failed');
                }
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (error: any) {
        console.error('Webhook Error:', error);
        res.status(500).send('Webhook Error');
    }
});

export default router;
