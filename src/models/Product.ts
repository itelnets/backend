import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
    adminId?: mongoose.Types.ObjectId;
    name: string;
    description: string;
    price: number;
    discount: number;
    images: string[];
    type?: string;
    categories?: string[];
    rating?: number;
    numReviews?: number;
    reviews?: { userId: mongoose.Types.ObjectId; rating: number }[];
    overview?: string;
    specifications?: { key: string; value: string }[];
    suggestedUse?: string;
    otherIngredients?: string;
    warnings?: string;
    disclaimer?: string;
    isActive?: boolean;
    brand?: string;
    manufacturer?: string;
    inStock?: string;
    bestSeller?: string;
    order?: number;
    // Per-user lists (store user ObjectIds)
    savedBy?: mongoose.Types.ObjectId[]; // wishlist users
    savedForLaterBy?: mongoose.Types.ObjectId[]; // users who saved this product for later
    hsn?: string;
    batchNo?: string;
    expiredOn?: string;
}

const productSchema = new Schema<IProduct>(
    {
        adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
        name: { type: String },
        description: { type: String },
        price: { type: Number },
        discount: { type: Number, default: 0 },
        images: { type: [String], default: [] },
        type: { type: String },
        categories: { type: [String], default: [] },
        rating: { type: Number, default: 0 },
        numReviews: { type: Number, default: 0 },
        reviews: [
            {
                userId: { type: Schema.Types.ObjectId, ref: 'User' },
                rating: { type: Number, required: true }
            }
        ],
        overview: { type: String },
        specifications: [
            {
                key: { type: String },
                value: { type: String }
            }
        ],
        suggestedUse: { type: String },
        otherIngredients: { type: String },
        warnings: { type: String },
        disclaimer: { type: String },
        isActive: { type: Boolean, default: true },
        brand: { type: String },
        manufacturer: { type: String },
        inStock: { type: String },
        bestSeller: { type: String },
        order: { type: Number, default: 0 },
        savedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
        savedForLaterBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
        hsn: { type: String },
        batchNo: { type: String },
        expiredOn: { type: String }
    },
    { timestamps: true }
);

productSchema.index({ order: 1, createdAt: -1 });
productSchema.index({ type: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ createdAt: -1 });

export default mongoose.model<IProduct>('Product', productSchema);
