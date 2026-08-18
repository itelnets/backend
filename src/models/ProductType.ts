import mongoose, { Document, Schema } from 'mongoose';

export interface IProductType extends Document {
    name: string;
    description?: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const ProductTypeSchema: Schema = new Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        description: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const ProductType = mongoose.model<IProductType>('ProductType', ProductTypeSchema, 'product_types');

export default ProductType;

/**
 * Seed initial default product types into MongoDB product_types collection
 */
export const seedDefaultProductTypes = async () => {
    try {
        const count = await ProductType.countDocuments();
        if (count === 0) {
            const defaults = ['Supplements', 'Sports', 'Bath', 'Beauty', 'Grocery', 'Home', 'Baby', 'Pets'];
            const docs = defaults.map(name => ({ name }));
            await ProductType.insertMany(docs);
            console.log('Seeded default product types into product_types collection');
        }
    } catch (err) {
        console.error('Error seeding default product types:', err);
    }
};
