import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctorRequest extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    email: string;
    mobileNumber: string;
    registrationNumber: string;
    specialization: string;
    hospitalClinic?: string;
    documentUrl?: string;
    status: 'pending' | 'approved' | 'rejected';
    promoCode?: string;
    discountDetails?: string;
    discountPercent?: number;
    adminNotes?: string;
    approvedAt?: Date;
    rejectedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const DoctorRequestSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        mobileNumber: {
            type: String,
            required: true,
            trim: true,
        },
        registrationNumber: {
            type: String,
            required: true,
            trim: true,
        },
        specialization: {
            type: String,
            required: true,
            trim: true,
        },
        hospitalClinic: {
            type: String,
            default: '',
            trim: true,
        },
        documentUrl: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        promoCode: {
            type: String,
            default: '',
        },
        discountDetails: {
            type: String,
            default: '',
        },
        discountPercent: {
            type: Number,
            default: 25,
        },
        adminNotes: {
            type: String,
            default: '',
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        rejectedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IDoctorRequest>('DoctorRequest', DoctorRequestSchema, 'doctor_requests');
