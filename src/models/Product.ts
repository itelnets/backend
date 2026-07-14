import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    description: string;
    price: number;
    discount: number;
    images: string[];
    type?: string;
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
    packageQuantity?: string;
    bestSeller?: string;
    order?: number;
}

const productSchema = new Schema<IProduct>(
    {
        name: { type: String },
        description: { type: String },
        price: { type: Number },
        discount: { type: Number, default: 0 },
        images: { type: [String], default: [] },
        type: { type: String },
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
        packageQuantity: { type: String },
        bestSeller: { type: String },
        order: { type: Number, default: 0 }
    },
    { timestamps: true }
);

export default mongoose.model<IProduct>('Product', productSchema);
