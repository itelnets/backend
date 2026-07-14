import { Request, Response } from 'express';
import Product from '../models/Product';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
});

const getPublicUrl = (key: string) => {
    if (!key) return key;
    // If it's already a full URL, return it
    if (key.startsWith('http')) return key;

    const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

const processProductForResponse = async (product: any) => {
    const prodObj = product.toObject ? product.toObject() : product;
    if (prodObj.images && Array.isArray(prodObj.images)) {
        prodObj.images = prodObj.images.map((img: string) => getPublicUrl(img));
    }
    return prodObj;
};

export const getProducts = async (req: Request, res: Response) => {
    try {
        const products = await Product.find({}).sort({ order: 1, createdAt: -1 });
        const processedProducts = await Promise.all(products.map(processProductForResponse));
        res.status(200).json(processedProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products' });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            const processedProduct = await processProductForResponse(product);
            res.status(200).json(processedProduct);
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

const extractKeyFromUrl = (urlOrKey: string) => {
    if (!urlOrKey) return urlOrKey;
    let key = String(urlOrKey);
    // Remove query parameters
    if (key.includes('?')) key = key.split('?')[0];
    // Extract key after amazonaws.com/
    if (key.includes('.amazonaws.com/')) {
        return key.split('.amazonaws.com/')[1];
    }
    return key;
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            // Find images that were removed in the edit
            const oldImages = (product.images || []).map(img => String(img));
            let newImages: string[] = [];
            if (Array.isArray(req.body.images)) {
                newImages = req.body.images.map((img: any) => extractKeyFromUrl(String(img)));
            } else if (typeof req.body.images === 'string') {
                newImages = [extractKeyFromUrl(String(req.body.images))];
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
export const reorderProducts = async (req: Request, res: Response) => {
    try {
        const { orderedIds }: { orderedIds: string[] } = req.body;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ message: 'orderedIds must be an array' });
        }
        // Update each product's order field based on its position in the array
        await Promise.all(
            orderedIds.map((id, index) =>
                Product.findByIdAndUpdate(id, { order: index })
            )
        );
        res.status(200).json({ message: 'Products reordered successfully' });
    } catch (error) {
        console.error('Error reordering products:', error);
        res.status(500).json({ message: 'Server error reordering products' });
    }
};
