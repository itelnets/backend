import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
    mobileNumber: string;
    otp: string;
    expiresAt: Date;
    createdAt: Date;
}

const OTPSchema: Schema = new Schema(
    {
        mobileNumber: {
            type: String,
            required: true,
            index: true
        },
        otp: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expireAfterSeconds: 0 }
        }
    },
    {
        timestamps: true
    }
);

// Create TTL index for automatic expiration
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOTP>('OTP', OTPSchema);

