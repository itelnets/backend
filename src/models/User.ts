import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    name?: string;
    email: string;
    pendingEmail?: string;
    mobileNumber: string;
    password: string;
    role: 'customer' | 'admin';
    isEmailVerified: boolean;
    otp?: string;
    otpExpiresAt?: Date;
    resetPasswordToken?: string;
    resetPasswordExpiresAt?: Date;
    isDeleted: boolean;
    isDoctorVerified?: boolean;
    doctorPromoCode?: string;
    doctorDiscountDetails?: string;
    doctorDiscountPercent?: number;
    ipAddress?: string;
    latitude?: number;
    longitude?: number;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema(
    {
        name: {
            type: String,
            default: '',
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        pendingEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        mobileNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['customer', 'admin'],
            default: 'customer',
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        isDoctorVerified: {
            type: Boolean,
            default: false,
        },
        doctorPromoCode: {
            type: String,
            default: null,
        },
        doctorDiscountDetails: {
            type: String,
            default: null,
        },
        doctorDiscountPercent: {
            type: Number,
            default: 25,
        },
        otp: {
            type: String,
            default: null,
        },
        ipAddress: {
            type: String,
            default: null,
        },
        latitude: {
            type: Number,
            default: null,
        },
        longitude: {
            type: Number,
            default: null,
        },
        otpExpiresAt: {
            type: Date,
            default: null,
        },
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IUser>('User', UserSchema);
