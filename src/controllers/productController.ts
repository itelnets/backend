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
        const { sort, inStock, brand, minPrice, maxPrice, ratings, search, type, categories } = req.query;

        let query: any = { isActive: true }; // Assuming only active products

        if (search) {
            const searchStr = (search as string).trim();
            const escapedSearch = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Create a fuzzy regex: 'raja' becomes 'r.*a.*j.*a'
            const fuzzyRegex = escapedSearch.split('').join('.*');

            const searchQueries: any[] = [
                { name: { $regex: fuzzyRegex, $options: 'i' } }
            ];

            if (/^[0-9a-fA-F]{24}$/.test(searchStr)) {
                searchQueries.push({ _id: searchStr });
            }

            query.$or = searchQueries;
        }

        if (type) {
            query.type = new RegExp(`^${(type as string).trim()}$`, 'i');
        }

        if (brand) {
            query.brand = { $in: (brand as string).split(',') };
        }

        if (categories) {
            query.categories = { $in: (categories as string).split('|') };
        }

        if (inStock === 'true') {
            query.inStock = { $regex: /^yes$/i }; // Assuming "Yes" is stored, or could be true if boolean
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            const discountedPriceExpr = {
                $multiply: [
                    "$price",
                    { $subtract: [1, { $divide: [{ $ifNull: ["$discount", 0] }, 100] }] }
                ]
            };

            const priceConditions: any[] = [];
            if (minPrice !== undefined) {
                priceConditions.push({ $gte: [discountedPriceExpr, parseFloat(minPrice as string)] });
            }
            if (maxPrice !== undefined) {
                priceConditions.push({ $lte: [discountedPriceExpr, parseFloat(maxPrice as string)] });
            }

            if (priceConditions.length > 0) {
                query.$and = query.$and || [];
                query.$and.push({ $expr: priceConditions.length === 1 ? priceConditions[0] : { $and: priceConditions } });
            }
        }

        if (ratings) {
            const ratingArray = (ratings as string).split(',');
            const ratingQueries = ratingArray.map(r => {
                const num = parseInt(r);
                if (!isNaN(num)) {
                    // For 5 stars, just match >= 5
                    if (num === 5) return { rating: { $gte: 5 } };
                    // For others, match [num, num+1) e.g. 4 matches 4.0 to 4.9
                    return { rating: { $gte: num, $lt: num + 1 } };
                }
                return null;
            }).filter(Boolean);

            if (ratingQueries.length > 0) {
                query.$and = query.$and || [];
                query.$and.push({ $or: ratingQueries });
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

        if (req.query.includeFilters === 'true') {
            // Get available brands for the base category query (ignoring current filter selections)
            const filterQuery: any = { brand: { $ne: null } };
            if (type) filterQuery.type = new RegExp(`^${(type as string).trim()}$`, 'i');
            const brands = await Product.distinct('brand', filterQuery);

            return res.status(200).json({
                products: processedProducts,
                filters: {
                    brands: brands.filter(Boolean).sort()
                }
            });
        }

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
            query.type = new RegExp(`^${(type as string).trim()}$`, 'i');
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
                const oldImageKeys = (product.images || []).map((img: any) => getImageKeyFromUrl(String(img)));
                let newImages: string[] = [];
                let newImageKeys: string[] = [];

                if (Array.isArray(req.body.images)) {
                    newImages = req.body.images.map((img: any) => normalizeImageValue(String(img)));
                    newImageKeys = req.body.images.map((img: any) => getImageKeyFromUrl(String(img)));
                } else if (typeof req.body.images === 'string') {
                    newImages = [normalizeImageValue(String(req.body.images))];
                    newImageKeys = [getImageKeyFromUrl(String(req.body.images))];
                }
                const imagesToDelete = oldImageKeys.filter((imgKey: any) => !newImageKeys.includes(imgKey));

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
                const imageKeys = product.images.map((img: any) => getImageKeyFromUrl(String(img)));
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
