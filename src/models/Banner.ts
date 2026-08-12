import mongoose, { Document, Schema } from 'mongoose';

export interface IBanner extends Document {
    imageKey: string;
    fileSize: number;
    width: number;
    height: number;
    tabTitle?: string;
    tabSubtitle?: string;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const BannerSchema: Schema = new Schema({
    imageKey: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    tabTitle: { type: String, default: '' },
    tabSubtitle: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

export default mongoose.model<IBanner>('Banner', BannerSchema);
