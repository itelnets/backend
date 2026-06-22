import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    description: string;
    price: number;
    discount: number;
    images: string[];
}

const productSchema = new Schema<IProduct>(
    {
        name: { type: String, required: true },
        description: { type: String, required: true },
        price: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        images: { type: [String], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model<IProduct>('Product', productSchema);
