import express, { Request, Response } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { authenticate, isAdmin } from '../middleware/auth';

const router = express.Router();

// Initialize S3 Client
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
});

// Configure Multer to use S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME || 'my-bucket',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req: any, file: any, cb: any) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req: any, file: any, cb: any) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
            const type = req.query.type || 'product';
            if (type === 'banner') {
                cb(null, `banners/${filename}`);
            } else {
                const productId = req.body.productId || req.query.productId || 'unassigned';
                const rawProductType = req.body.productType || req.query.productType || req.body.type || req.query.type || '';
                const productTypeFolder = rawProductType.trim()
                    ? rawProductType.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
                    : '';

                if (productTypeFolder && productTypeFolder !== 'product') {
                    cb(null, `products/${productTypeFolder}/${productId}/${filename}`);
                } else {
                    cb(null, `products/${productId}/${filename}`);
                }
            }
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload only supports the following filetypes - " + filetypes));
    }
});

// @route   POST /api/upload
// @desc    Upload an image to S3 and return the Presigned URL + Key
// @access  Private/Admin
router.post('/', authenticate, isAdmin, upload.single('image'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const fileKey = (req.file as any).key;

        // Generate Public URL for frontend preview
        const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
        const region = process.env.AWS_REGION || 'us-east-1';
        const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;

        res.json({
            message: 'Image uploaded successfully',
            imageUrl: publicUrl,
            imageKey: fileKey,
            size: req.file.size
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
});

// @route   GET /api/upload/file/*
// @desc    Get a presigned URL for a private S3 image and redirect to it
// @access  Public
router.get('/file/*', async (req: Request, res: Response) => {
    try {
        const fileKey = req.params[0];
        if (!fileKey) {
            return res.status(400).json({ message: 'File key is required' });
        }

        const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
        // Generate a presigned URL (valid for 1 hour)
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        });
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        // Tell the browser to cache this redirect (and the resulting image) for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3500');
        res.redirect(signedUrl);
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(500).json({ message: 'Error retrieving file' });
    }
});

export default router;
