import mongoose, { Document, Schema } from 'mongoose';

export interface IBanner extends Document {
    imageKey: string;
    fileSize: number;
    width: number;
    height: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const BannerSchema: Schema = new Schema({
    imageKey: { type: String, required: true },
    fileSize: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

export default mongoose.model<IBanner>('Banner', BannerSchema);
