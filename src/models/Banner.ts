import mongoose, { Document, Schema } from 'mongoose';

export interface IBanner extends Document {
    adminId?: mongoose.Types.ObjectId;
    imageKey: string;
    fileSize: number;
    width: number;
    height: number;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const BannerSchema: Schema = new Schema({
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
    imageKey: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

BannerSchema.index({ order: 1, createdAt: -1 });
BannerSchema.index({ isActive: 1 });

export default mongoose.model<IBanner>('Banner', BannerSchema);
