import { Request, Response } from 'express';
import Product from '../models/Product';
import Cart from '../models/Cart';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
});

const getPublicUrl = (key: string) => {
    if (!key) return key;
    if (key.startsWith('http')) return key;

    const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

const getImageKeyFromUrl = (urlOrKey: string) => {
    if (!urlOrKey) return urlOrKey;
    let key = String(urlOrKey);

    if (key.includes('?')) {
        key = key.split('?')[0];
    }
    if (key.includes('.amazonaws.com/')) {
        key = key.split('.amazonaws.com/')[1];
    }

    return key;
};

const normalizeImageValue = (urlOrKey: string) => {
    const value = String(urlOrKey);
    return value.startsWith('http') ? value : getPublicUrl(getImageKeyFromUrl(value));
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
        const { search, brand, categories, inStock, sort, priceRanges, ratings, type } = req.query;
        let query: any = {};
        
        if (search) {
            query.name = { $regex: search as string, $options: 'i' };
        }
        
        if (type) {
            query.type = type as string;
        }

        if (brand) {
            query.brand = { $in: (brand as string).split('|') };
        }
        
        if (categories) {
            query.categories = { $in: (categories as string).split('|') };
        }
        
        if (inStock === 'true') {
            query.inStock = { $regex: /^yes$/i }; // Assuming "Yes" is stored, or could be true if boolean
        }

        if (priceRanges) {
            const ranges = (priceRanges as string).split('|');
            const discountedPriceExpr = { 
                $multiply: [ 
                    "$price", 
                    { $subtract: [1, { $divide: [{ $ifNull: ["$discount", 0] }, 100] }] } 
                ] 
            };
            
            const priceQueries = ranges.map(range => {
                if (range === 'Under ₹500') return { $expr: { $lte: [discountedPriceExpr, 500] } };
                if (range === '₹500 - ₹1,000') return { $expr: { $and: [{ $gte: [discountedPriceExpr, 500] }, { $lte: [discountedPriceExpr, 1000] }] } };
                if (range === 'Over ₹1,000') return { $expr: { $gte: [discountedPriceExpr, 1000] } };
                return null;
            }).filter(Boolean);

            if (priceQueries.length > 0) {
                query.$and = query.$and || [];
                query.$and.push({ $or: priceQueries });
            }
        }

        if (ratings) {
            const ratingArray = (ratings as string).split('|');
            let minRatingReq = 5;
            if (ratingArray.includes('3 Stars & Up')) minRatingReq = 3;
            else if (ratingArray.includes('4 Stars & Up')) minRatingReq = 4;
            
            if (minRatingReq < 5) {
                query.rating = { $gte: minRatingReq };
            }
        }

        let sortQuery: any = { order: 1, createdAt: -1 };
        if (sort === 'Price: Low to High') sortQuery = { price: 1 };
        if (sort === 'Price: High to Low') sortQuery = { price: -1 };
        if (sort === 'Newest') sortQuery = { createdAt: -1 };
        if (sort === 'Top Rated') sortQuery = { rating: -1 };
        if (sort === 'Best sellers') sortQuery = { bestSeller: -1 }; // Or however we track best sellers

        const products = await Product.find(query).sort(sortQuery);
        const processedProducts = await Promise.all(products.map(processProductForResponse));
        res.status(200).json(processedProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products' });
    }
};

export const getFilters = async (req: Request, res: Response) => {
    try {
        const { type } = req.query;
        let query: any = { brand: { $ne: null } };
        if (type) {
            query.type = type as string;
        }
        const brands = await Product.distinct('brand', query);
        res.status(200).json({ brands: brands.filter(Boolean).sort() });
    } catch (error) {
        console.error('Error fetching filters:', error);
        res.status(500).json({ message: 'Server error fetching filters' });
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
        const productData: any = { ...req.body };

        if (req.body.images !== undefined) {
            if (Array.isArray(req.body.images)) {
                productData.images = req.body.images.map((img: any) => normalizeImageValue(String(img)));
            } else if (typeof req.body.images === 'string') {
                productData.images = [normalizeImageValue(req.body.images)];
            }
        }

        const product = new Product(productData);
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
            if (req.body.images !== undefined) {
                // Find images that were removed in the edit
                const oldImageKeys = (product.images || []).map(img => getImageKeyFromUrl(String(img)));
                let newImages: string[] = [];
                let newImageKeys: string[] = [];

                if (Array.isArray(req.body.images)) {
                    newImages = req.body.images.map((img: any) => normalizeImageValue(String(img)));
                    newImageKeys = req.body.images.map((img: any) => getImageKeyFromUrl(String(img)));
                } else if (typeof req.body.images === 'string') {
                    newImages = [normalizeImageValue(String(req.body.images))];
                    newImageKeys = [getImageKeyFromUrl(String(req.body.images))];
                }
                const imagesToDelete = oldImageKeys.filter(imgKey => !newImageKeys.includes(imgKey));

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
                req.body.images = newImages; // so product.set(req.body) uses the normalized images
            }

            if (req.body.isActive === false && product.isActive !== false) {
                // Check if any user has this product in their active cart
                const cartCount = await Cart.countDocuments({
                    productId: product._id,
                    isSavedForLater: false,
                    isSold: false
                });

                if (cartCount > 0) {
                    return res.status(400).json({ message: 'Item already in cart' });
                }
            }

            product.set(req.body);
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
                const imageKeys = product.images.map(img => getImageKeyFromUrl(String(img)));
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
