import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth';
import Order from '../models/Order';
import { generateInvoicePdfBuffer } from '../utils/invoiceUtils';

const router = express.Router();

// @route   GET /api/orders/myorders
// @desc    Get logged in user orders
// @access  Private
router.get('/myorders', authenticate, async (req: any, res: any) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;

        const query: any = { user: new mongoose.Types.ObjectId(req.user.userId) };

        if (status && status !== 'All' && status !== 'All Orders') {
            if (status === 'Success') {
                query.isPaid = true;
                query.status = { $ne: 'Refunded' };
            } else if (status === 'Pending') {
                query.status = 'Pending';
                query.isPaid = false;
            } else if (status === 'Failed') {
                // Include both hard cancellations and abandoned/pending checkouts in Failed
                query.status = { $in: ['Cancelled', 'Pending'] };
            } else if (status === 'Refunded') {
                query.status = 'Refunded';
            } else if (status === 'Captured') {
                query.status = 'Captured';
            }
        } else {
            // By default (All Orders), show everything including abandoned 'Pending' checkouts
            // so users can see when a payment popup was closed.
        }

        const orders = await Order.find(query)
            .populate('orderItems.product', 'name image price')
            .populate('user', 'name email mobileNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // Calculate total amount for all orders matching the query
        const aggregationResult = await Order.aggregate([
            { $match: query },
            { $group: { _id: null, totalAmount: { $sum: "$totalPrice" } } }
        ]);
        const totalAmount = aggregationResult.length > 0 ? aggregationResult[0].totalAmount : 0;

        res.json({ totalPages, currentPage: page, totalOrders, totalAmount, orders });
    } catch (error: any) {
        console.error('Fetch My Orders Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', authenticate, async (req: any, res: any) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('orderItems.product', 'name image price');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Ensure the order belongs to the user
        if (order.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.json(order);
    } catch (error: any) {
        console.error('Fetch Order By ID Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/orders/:id/invoice
// @desc    Generate order invoice PDF
// @access  Private
router.get('/:id/invoice', authenticate, async (req: any, res: any) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('orderItems.product', 'name image price')
            .populate('user', 'name email mobileNumber');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view this order invoice' });
        }

        const pdfBuffer = await generateInvoicePdfBuffer(req.params.id);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Invoice-${order._id}.pdf`,
            'Content-Length': Buffer.from(pdfBuffer).length
        });

        res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
        console.error('Invoice Generation Error:', error);
        res.status(500).json({ message: 'Server Error during invoice generation' });
    }
});


// @route   POST /api/orders/:id/request-return
// @desc    User requests a return
// @access  Private
router.post('/:id/request-return', authenticate, async (req: any, res: any) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!order.isPaid || !order.paidAt) {
            return res.status(400).json({ message: 'Order is not paid' });
        }

        // 48 hours check
        const fortyEightHours = 2 * 24 * 60 * 60 * 1000;
        if (Date.now() - new Date(order.paidAt).getTime() > fortyEightHours) {
            return res.status(400).json({ message: 'Return window of 48 hours has expired' });
        }

        if (order.status !== 'Captured' && order.status !== 'Shipped' && order.status !== 'Delivered') {
            return res.status(400).json({ message: `Cannot request return for order in ${order.status} status` });
        }

        order.status = 'Refund Requested';
        order.refundStatus = 'requested';
        const updatedOrder = await order.save();

        res.json({ message: 'Return requested successfully', order: updatedOrder });
    } catch (error: any) {
        console.error('Request Return Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/orders/admin/all
// @desc    Get all orders for admin dashboard
// @access  Private/Admin
router.get('/admin/all', authenticate, async (req: any, res: any) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;
        const search = req.query.search as string;
        const userId = req.query.userId as string;

        const query: any = {};
        if (status && status !== 'All') {
            query.status = status;
        }

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.user = userId;
        }

        if (search) {
            if (mongoose.Types.ObjectId.isValid(search.trim())) {
                query._id = search.trim();
            } else {
                query._id = null; // Forces empty result if invalid ID is searched
            }
        }

        const orders = await Order.find(query)
            .populate('orderItems.product', 'name image price')
            .populate('user', 'name email mobileNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        res.json({ totalPages, currentPage: page, totalOrders, orders });
    } catch (error: any) {
        console.error('Fetch All Orders Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

export default router;
