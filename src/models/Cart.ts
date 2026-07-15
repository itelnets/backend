import mongoose, { Document, Schema } from 'mongoose';

export interface ICart extends Document {
    userId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    quantity: number;
    isSavedForLater: boolean;
    isSold: boolean;
    paymentStatus: string;
    paymentMethod?: string;
    orderId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const cartSchema = new Schema<ICart>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    },
    isSavedForLater: {
        type: Boolean,
        default: false
    },
    isSold: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }
}, {
    timestamps: true
});

const Cart = mongoose.models.Cart || mongoose.model<ICart>('Cart', cartSchema);

export default Cart;
