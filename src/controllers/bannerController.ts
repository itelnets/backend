import { Request, Response } from 'express';
import Banner from '../models/Banner';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 Client
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
});

// Get S3 Public URL
const getPublicUrl = (key: string) => {
    if (!key) return key;
    if (key.startsWith('http')) return key;

    const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

const getImageKeyFromUrl = (urlOrKey: string) => {
    if (!urlOrKey) return urlOrKey;
    let value = String(urlOrKey);

    if (value.includes('?')) {
        value = value.split('?')[0];
    }
    if (value.includes('.amazonaws.com/')) {
        return value.split('.amazonaws.com/')[1];
    }
    return value;
};

const normalizeBannerImageValue = (urlOrKey: string) => {
    const value = String(urlOrKey);
    return value.startsWith('http') ? value : getPublicUrl(getImageKeyFromUrl(value));
};

export const getBanners = async (req: Request, res: Response) => {
    try {
        const { isActive } = req.query;
        let query: any = {};

        if (isActive === 'all') {
            // Admin requesting all banners
        } else if (isActive === 'false') {
            query.isActive = false;
        } else {
            query.isActive = true;
        }

        const banners = await Banner.find(query).sort({ order: 1, createdAt: -1 }).lean();

        const processedBanners = banners.map(b => ({
            _id: b._id,
            imageKey: b.imageKey,
            imageUrl: b.imageKey ? getPublicUrl(b.imageKey) : '',
            fileSize: b.fileSize || 0,
            width: b.width || 0,
            height: b.height || 0,
            isActive: b.isActive !== false,
            order: (b as any).order || 0,
            createdAt: b.createdAt
        }));
        res.status(200).json(processedBanners);
    } catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({ message: 'Server error fetching banners' });
    }
};

export const createBanner = async (req: Request, res: Response) => {
    try {
        const { imageKey, fileSize, width, height } = req.body;

        if (!imageKey) {
            return res.status(400).json({ message: 'Image key is required' });
        }

        const normalizedImageUrl = normalizeBannerImageValue(String(imageKey));

        // Shift all existing banners order by +1 so new banner takes top position (order 0)
        await Banner.updateMany({}, { $inc: { order: 1 } });

        const banner = new Banner({
            adminId: req.user?.userId,
            imageKey: normalizedImageUrl,
            fileSize: fileSize || 0,
            width: width || 0,
            height: height || 0,
            order: 0
        });

        await banner.save();

        const responseBanner = {
            _id: banner._id,
            imageKey: banner.imageKey,
            imageUrl: getPublicUrl(banner.imageKey),
            fileSize: banner.fileSize,
            width: banner.width,
            height: banner.height,
            isActive: banner.isActive,
            order: (banner as any).order || 0,
            createdAt: banner.createdAt
        };

        res.status(201).json({ message: 'Banner created successfully', banner: responseBanner });
    } catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({ message: 'Server error creating banner' });
    }
};

export const updateBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const update = { ...req.body };
        if (req.user?.userId) {
            update.adminId = req.user.userId;
        }

        const existingBanner = await Banner.findById(id);
        if (!existingBanner) {
            return res.status(404).json({ message: 'Banner not found' });
        }

        if (update.imageKey) {
            const normalizedNewImageKey = normalizeBannerImageValue(String(update.imageKey));

            // If the image is being changed, delete the old one from S3
            if (existingBanner.imageKey && existingBanner.imageKey !== normalizedNewImageKey) {
                const bucket = process.env.AWS_S3_BUCKET_NAME;
                const oldKey = getImageKeyFromUrl(existingBanner.imageKey);
                try {
                    await s3.send(new DeleteObjectCommand({
                        Bucket: bucket,
                        Key: oldKey
                    }));
                } catch (s3Error) {
                    console.error('Failed to delete old banner image from S3:', s3Error);
                }
            }
            update.imageKey = normalizedNewImageKey;
        }

        const banner = await Banner.findByIdAndUpdate(id, update, { new: true });

        if (!banner) return res.status(404).json({ message: 'Banner not found' });

        const responseBanner = {
            _id: banner._id,
            imageKey: banner.imageKey,
            imageUrl: getPublicUrl(banner.imageKey),
            fileSize: banner.fileSize,
            width: banner.width,
            height: banner.height,
            isActive: banner.isActive,
            order: (banner as any).order || 0,
            createdAt: banner.createdAt
        };

        res.status(200).json({ message: 'Banner updated', banner: responseBanner });
    } catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({ message: 'Server error updating banner' });
    }
};

export const reorderBanners = async (req: Request, res: Response) => {
    try {
        const { order } = req.body; // expected array of ids in desired order
        if (!Array.isArray(order)) return res.status(400).json({ message: 'Invalid order payload' });

        // update each banner's order
        await Promise.all(order.map(async (id: string, idx: number) => {
            await Banner.updateOne({ _id: id as any }, { $set: { order: idx } });
        }));

        res.status(200).json({ message: 'Banners reordered' });
    } catch (error) {
        console.error('Error reordering banners:', error);
        res.status(500).json({ message: 'Server error reordering banners' });
    }
};

export const deleteBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);

        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }

        // Delete the image object from AWS S3
        const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
        try {
            const key = getImageKeyFromUrl(banner.imageKey);
            await s3.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
            }));
        } catch (s3Error) {
            console.error('Failed to delete banner image from S3:', s3Error);
        }

        await Banner.findByIdAndDelete(id);
        res.status(200).json({ message: 'Banner deleted successfully' });
    } catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({ message: 'Server error deleting banner' });
    }
};
