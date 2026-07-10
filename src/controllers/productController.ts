import { Request, Response } from 'express';
import Product from '../models/Product';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
});

export const getProducts = async (req: Request, res: Response) => {
    try {
        const products = await Product.find({});
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products' });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Server error fetching product' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const product = new Product(req.body);
        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Server error creating product' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            // Find images that were removed in the edit
            const oldImages = (product.images || []).map(img => String(img));
            let newImages: string[] = [];
            if (Array.isArray(req.body.images)) {
                newImages = req.body.images.map((img: any) => String(img));
            } else if (typeof req.body.images === 'string') {
                newImages = [String(req.body.images)];
            }
            const imagesToDelete = oldImages.filter(img => !newImages.includes(img));

            // Delete removed images from S3
            if (imagesToDelete.length > 0) {
                const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
                for (const imageKey of imagesToDelete) {
                    try {
                        const command = new DeleteObjectCommand({
                            Bucket: bucket,
                            Key: imageKey
                        });
                        await s3.send(command);
                    } catch (s3Error) {
                        console.error(`Failed to delete orphaned image ${imageKey} from S3:`, s3Error);
                    }
                }
            }

            product.set(req.body);
            if (req.body.images !== undefined) {
                product.images = newImages;
            }
            if (req.body.isActive !== undefined) {
                product.isActive = req.body.isActive;
            }
            const updatedProduct = await product.save();
            res.status(200).json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server error updating product' });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (product) {
            // Delete images from S3
            if (product.images && product.images.length > 0) {
                const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
                const imageKeys = product.images.map(img => String(img));
                for (const imageKey of imageKeys) {
                    try {
                        const command = new DeleteObjectCommand({
                            Bucket: bucket,
                            Key: imageKey
                        });
                        await s3.send(command);
                    } catch (s3Error) {
                        console.error(`Failed to delete image ${imageKey} from S3:`, s3Error);
                    }
                }
            }

            res.status(200).json({ message: 'Product deleted successfully' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server error deleting product' });
    }
};
