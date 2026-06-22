import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    name: string;
    mobileNumber: string;
    password: string;
    role: 'customer' | 'admin';
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        mobileNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['customer', 'admin'],
            default: 'customer'
        },
        isVerified: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model<IUser>('User', UserSchema);

