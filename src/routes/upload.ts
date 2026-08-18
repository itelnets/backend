import express, { Request, Response } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { authenticate } from '../middleware/auth';

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
            } else if (type === 'doctor' || type === 'certificate') {
                cb(null, `doctors/${filename}`);
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for images and documents
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|pdf/;
        const isPdf = file.mimetype === 'application/pdf';
        const mimetype = filetypes.test(file.mimetype) || isPdf;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload supports JPEG, JPG, PNG, WEBP, and PDF files."));
    }
});

// @route   POST /api/upload
// @desc    Upload an image or document to S3 and return Presigned URL + Key
// @access  Private (Authenticated Users)
router.post('/', authenticate, upload.single('image'), async (req: Request, res: Response) => {
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
            message: 'File uploaded successfully',
            imageUrl: publicUrl,
            imageKey: fileKey,
            size: req.file.size
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
});

// @route   DELETE /api/upload
// @desc    Delete a file from S3 bucket by Key or URL
// @access  Private (Authenticated Users)
router.delete('/', authenticate, async (req: Request, res: Response) => {
    try {
        const { key, fileUrl } = req.body;
        let targetKey = key || req.query.key;

        if (!targetKey && fileUrl) {
            if (typeof fileUrl === 'string') {
                if (fileUrl.includes('.amazonaws.com/')) {
                    targetKey = fileUrl.split('.amazonaws.com/')[1];
                } else if (fileUrl.includes('/upload/file/')) {
                    targetKey = fileUrl.split('/upload/file/')[1];
                } else {
                    targetKey = fileUrl;
                }
            }
        }

        if (!targetKey) {
            return res.status(400).json({ message: 'File key or URL is required' });
        }

        const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
        const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: targetKey,
        });

        await s3.send(deleteCommand);

        return res.json({ message: 'File deleted from S3 successfully', key: targetKey });
    } catch (error: any) {
        console.error('Error deleting file from S3:', error);
        return res.status(500).json({ message: 'Failed to delete file from S3', error: error.message });
    }
});

// @route   GET /api/upload/file/*
// @desc    Get a presigned URL for a private S3 file and redirect to it
// @access  Public
router.get('/file/*', async (req: Request, res: Response) => {
    try {
        const fileKey = req.params[0];
        if (!fileKey) {
            return res.status(400).json({ message: 'File key is required' });
        }

        const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
        const isDownload = req.query.download === 'true';
        const rawFileName = fileKey.split('/').pop() || 'certificate-document';
        const filename = rawFileName.includes('.') ? rawFileName : `${rawFileName}.jpg`;

        // Generate a presigned URL (valid for 1 hour)
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: fileKey,
            ...(isDownload ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {})
        });
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        res.setHeader('Cache-Control', 'public, max-age=3500');
        res.redirect(signedUrl);
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(500).json({ message: 'Error retrieving file' });
    }
});

// @route   GET /api/upload/download-file
// @desc    Download proxy endpoint optimized for instant streaming download
router.get('/download-file', async (req: Request, res: Response) => {
    try {
        const fileUrl = req.query.url as string;
        if (!fileUrl) {
            return res.status(400).send('URL required');
        }

        // Fast-Path: If it's an S3 /upload/file/ URL, redirect to presigned attachment URL (instant 0ms lag)
        if (fileUrl.includes('/upload/file/')) {
            const fileKeyWithParams = fileUrl.split('/upload/file/')[1];
            const cleanKey = fileKeyWithParams.split('?')[0];
            return res.redirect(`/api/upload/file/${cleanKey}?download=true`);
        }

        const rawFileName = fileUrl.split('/').pop()?.split('?')[0] || 'certificate-document';
        const filename = rawFileName.includes('.') ? rawFileName : `${rawFileName}.jpg`;

        const response = await fetch(fileUrl);
        if (!response.ok || !response.body) {
            return res.redirect(fileUrl);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream chunk-by-chunk for instant download start
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
        res.end();
    } catch (error: any) {
        console.error('Download proxy error:', error);
        res.status(500).send('Error downloading file');
    }
});

export default router;
