import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    description: string;
    price: number;
    discount: number;
    images: string[];
    overview?: string;
    specifications?: { key: string; value: string }[];
    suggestedUse?: string;
    otherIngredients?: string;
    warnings?: string;
    disclaimer?: string;
    isActive?: boolean;
}

const productSchema = new Schema<IProduct>(
    {
        name: { type: String, required: true },
        description: { type: String, required: true },
        price: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        images: { type: [String], default: [] },
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
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

export default mongoose.model<IProduct>('Product', productSchema);
