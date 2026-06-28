import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
    user: mongoose.Types.ObjectId;
    product: string;
    rating: number;
    comment: string;
    isPositive: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ReviewSchema: Schema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        product: {
            type: String,
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
            trim: true,
        },
        isPositive: {
            type: Boolean,
            default: true,
        },
        tags: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Prevent a user from submitting more than one review per product
ReviewSchema.index({ user: 1, product: 1 }, { unique: true });

export default mongoose.model<IReview>('Review', ReviewSchema);
