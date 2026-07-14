import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress extends Document {
    userId: mongoose.Types.ObjectId;
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AddressSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        fullName: { type: String, required: true },
        addressLine1: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: String, required: true },
        phone: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IAddress>('Address', AddressSchema);
