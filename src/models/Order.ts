import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
    product: mongoose.Types.ObjectId;
    name: string;
    qty: number;
    image: string;
    price: number;
}

export interface IOrder extends Document {
    user: mongoose.Types.ObjectId;
    orderItems: IOrderItem[];
    shippingAddress: {
        address: string;
        city: string;
        postalCode: string;
        country: string;
        addressLine1?: string;
        addressLine2?: string;
        landmark?: string;
        state?: string;
    };
    paymentMethod: string;
    paymentResult?: {
        id: string;
        status: string;
        update_time: string;
        email_address: string;
    };
    taxPrice: number;
    shippingPrice: number;
    totalPrice: number;
    isPaid: boolean;
    paidAt?: Date;
    isDelivered: boolean;
    deliveredAt?: Date;
    cashfreeOrderId?: string;
    cashfreePaymentId?: string;
    paymentSessionId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    status: 'Pending' | 'Captured' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refund Initiated' | 'Refunded' | 'Refund Failed' | 'Refund Requested' | 'Refund Denied';
    refundStatus?: 'NONE' | 'requested' | 'pending' | 'processed' | 'failed' | 'denied';
}

const orderSchema = new Schema<IOrder>(
    {
        user: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        orderItems: [
            {
                product: {
                    type: Schema.Types.ObjectId,
                    required: true,
                    ref: 'Product',
                },
                name: { type: String, required: true },
                qty: { type: Number, required: true },
                image: { type: String, default: '' },
                price: { type: Number, required: true },
            },
        ],
        shippingAddress: {
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
            addressLine1: { type: String },
            addressLine2: { type: String },
            landmark: { type: String },
            state: { type: String },
        },
        paymentMethod: {
            type: String,
            required: true,
            default: 'Cashfree',
        },
        paymentResult: {
            id: { type: String },
            status: { type: String },
            update_time: { type: String },
            email_address: { type: String },
        },
        taxPrice: {
            type: Number,
            required: true,
            default: 0.0,
        },
        shippingPrice: {
            type: Number,
            required: true,
            default: 0.0,
        },
        totalPrice: {
            type: Number,
            required: true,
            default: 0.0,
        },
        isPaid: {
            type: Boolean,
            required: true,
            default: false,
        },
        paidAt: {
            type: Date,
        },
        isDelivered: {
            type: Boolean,
            required: true,
            default: false,
        },
        deliveredAt: {
            type: Date,
        },
        cashfreeOrderId: {
            type: String,
        },
        cashfreePaymentId: {
            type: String,
        },
        paymentSessionId: {
            type: String,
        },
        razorpayOrderId: {
            type: String,
        },
        razorpayPaymentId: {
            type: String,
        },
        razorpaySignature: {
            type: String,
        },
        status: {
            type: String,
            enum: ['Pending', 'Captured', 'Shipped', 'Delivered', 'Cancelled', 'Refund Initiated', 'Refunded', 'Refund Failed', 'Refund Requested', 'Refund Denied'],
            default: 'Pending',
        },
        refundStatus: {
            type: String,
            enum: ['NONE', 'requested', 'pending', 'processed', 'failed', 'denied'],
            default: 'NONE',
        },
    },
    {
        timestamps: true,
    }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
