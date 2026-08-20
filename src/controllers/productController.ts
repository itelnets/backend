import { Request, Response } from 'express';
import Product from '../models/Product';
import Cart from '../models/Cart';
import ProductType from '../models/ProductType';
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

const extractWeightInGrams = (product: any): number => {
    if (product.weight) {
        const num = parseFloat(String(product.weight));
        if (!isNaN(num)) {
            if (String(product.weightUnit).toLowerCase() === 'kg') return num * 1000;
            return num;
        }
    }
    if (product.specifications && Array.isArray(product.specifications)) {
        const spec = product.specifications.find((s: any) =>
            s && s.key && (
                s.key.toLowerCase().includes('weight') ||
                s.key === 'Weight (gm)'
            )
        );
        if (spec && spec.value) {
            const valStr = String(spec.value).trim().toLowerCase();
            const match = valStr.match(/([\d.]+)\s*(kg|gm|g)?/i);
            if (match) {
                const num = parseFloat(match[1]);
                if (!isNaN(num)) {
                    if (match[2] === 'kg') return num * 1000;
                    return num;
                }
            }
        }
    }
    return 0;
};

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { sort, inStock, brand, minPrice, maxPrice, ratings, search, type, categories, page, limit, includeFilters, isActive } = req.query;

        let query: any = {};

        if (isActive === 'all') {
            // Admin requesting all products regardless of active status
        } else if (isActive === 'false') {
            query.isActive = false;
        } else {
            query.isActive = true;
        }

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

        let discountFilter: any = {};
        if (req.query.minDiscount !== undefined && !isNaN(parseFloat(req.query.minDiscount as string))) {
            discountFilter.$gte = parseFloat(req.query.minDiscount as string);
        } else if (req.query.discount !== undefined && !isNaN(parseFloat(req.query.discount as string))) {
            discountFilter.$gte = parseFloat(req.query.discount as string);
        }
        if (req.query.maxDiscount !== undefined && !isNaN(parseFloat(req.query.maxDiscount as string))) {
            discountFilter.$lte = parseFloat(req.query.maxDiscount as string);
        }
        if (Object.keys(discountFilter).length > 0) {
            query.discount = discountFilter;
        }

        if (brand) {
            query.brand = { $in: (brand as string).split(',') };
        }

        if (categories) {
            query.categories = { $in: (categories as string).split('|') };
        }

        if (inStock === 'true') {
            query.inStock = { $ne: 'No' };
        } else if (inStock === 'false') {
            query.inStock = 'No';
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
        if (sort === 'Price: Low to High' || sort === 'price_asc') sortQuery = { price: 1 };
        if (sort === 'Price: High to Low' || sort === 'price_desc') sortQuery = { price: -1 };
        if (sort === 'Newest' || sort === 'newest') sortQuery = { createdAt: -1 };
        if (sort === 'Top Rated' || sort === 'rating_desc') sortQuery = { rating: -1 };
        if (sort === 'Best sellers' || sort === 'bestsellers') sortQuery = { bestSeller: -1, createdAt: -1 };
        if (sort === 'Highest Discount' || sort === 'highest_discount' || sort === 'discount_desc') sortQuery = { discount: -1, createdAt: -1 };

        const isPaginated = page !== undefined || limit !== undefined;
        const isWeightSort = sort === 'Heaviest' || sort === 'heaviest' || sort === 'Lightest' || sort === 'lightest';

        let processedProducts: any[] = [];
        let totalProducts = 0;
        let pageNum = 1;
        let limitNum = 20;

        if (isWeightSort) {
            const allProducts = await Product.find(query);
            let processed = await Promise.all(allProducts.map(processProductForResponse));
            if (sort === 'Heaviest' || sort === 'heaviest') {
                processed.sort((a, b) => extractWeightInGrams(b) - extractWeightInGrams(a));
            } else {
                processed.sort((a, b) => extractWeightInGrams(a) - extractWeightInGrams(b));
            }
            totalProducts = processed.length;
            if (isPaginated) {
                pageNum = parseInt(page as string, 10) || 1;
                limitNum = parseInt(limit as string, 10) || 20;
                const skip = (pageNum - 1) * limitNum;
                processedProducts = processed.slice(skip, skip + limitNum);
            } else {
                processedProducts = processed;
            }
        } else {
            let productsQuery = Product.find(query).lean().sort(sortQuery);

            if (isPaginated) {
                pageNum = parseInt(page as string, 10) || 1;
                limitNum = parseInt(limit as string, 10) || 20;
                const skip = (pageNum - 1) * limitNum;

                const [total, products] = await Promise.all([
                    Product.countDocuments(query),
                    productsQuery.skip(skip).limit(limitNum)
                ]);
                totalProducts = total;
                processedProducts = await Promise.all(products.map(processProductForResponse));
            } else {
                const products = await productsQuery;
                totalProducts = products.length;
                processedProducts = await Promise.all(products.map(processProductForResponse));
            }
        }

        let availableBrands: string[] = [];
        if (includeFilters === 'true') {
            // Get available brands for the base category query (ignoring current filter selections)
            const filterQuery: any = { brand: { $ne: null } };
            if (type) filterQuery.type = new RegExp(`^${(type as string).trim()}$`, 'i');
            const brands = await Product.distinct('brand', filterQuery);
            availableBrands = brands.filter(Boolean).sort();
        }

        if (isPaginated) {
            const totalPages = Math.ceil(totalProducts / limitNum);
            const responseData: any = {
                page: pageNum,
                totalPages,
                totalProducts,
                limit: limitNum,
                products: processedProducts
            };

            if (includeFilters === 'true') {
                responseData.filters = { brands: availableBrands };
            }

            return res.status(200).json(responseData);
        }

        if (includeFilters === 'true') {
            return res.status(200).json({
                products: processedProducts,
                filters: {
                    brands: availableBrands
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
        if (req.user?.userId) {
            productData.adminId = req.user.userId;
        }
        delete productData.rating; // Manual rating setting removed; ratings are calculated from reviews

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

            if (req.user?.userId) {
                req.body.adminId = req.user.userId;
            }
            const updatedProduct = await Product.findByIdAndUpdate(
                req.params.id,
                { $set: req.body },
                { new: true, runValidators: true }
            );
            console.log(`\x1b[33m[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] ${req.params.id} Name: ${updatedProduct?.name}, Price: ${updatedProduct?.price}\x1b[0m`);
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
        const productId = req.params.id;

        // Check if product is currently present in any active user cart
        const inCartCount = await Cart.countDocuments({ productId, isSold: false });
        if (inCartCount > 0) {
            return res.status(400).json({
                message: 'Product already added in cart'
            });
        }

        const product = await Product.findByIdAndDelete(productId);
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

export const getProductTypes = async (req: Request, res: Response) => {
    try {
        const types = await ProductType.find({ isActive: true }).sort({ createdAt: 1 });
        const typeNames = types.map(t => t.name);
        res.status(200).json({ types: typeNames });
    } catch (error) {
        console.error('Error fetching product types:', error);
        res.status(500).json({ message: 'Server error fetching product types' });
    }
};

export const createProductType = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Product type name is required' });
        }
        const trimmed = name.trim();
        let existing = await ProductType.findOne({ name: new RegExp(`^${trimmed}$`, 'i') });
        if (!existing) {
            existing = await ProductType.create({ name: trimmed });
        }
        res.status(201).json({ message: 'Product type saved', type: existing });
    } catch (error: any) {
        console.error('Error saving product type:', error);
        res.status(500).json({ message: 'Server error saving product type' });
    }
};

export const updateProductType = async (req: Request, res: Response) => {
    try {
        const { oldName, newName } = req.body;
        if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
            return res.status(400).json({ message: 'Both oldName and newName are required' });
        }

        const trimmedOld = oldName.trim();
        const trimmedNew = newName.trim();

        // Update ProductType document
        await ProductType.findOneAndUpdate(
            { name: new RegExp(`^${trimmedOld}$`, 'i') },
            { name: trimmedNew },
            { upsert: true, new: true }
        );

        // Update all Products matching old type
        const updateResult = await Product.updateMany(
            { type: new RegExp(`^${trimmedOld}$`, 'i') },
            { type: trimmedNew }
        );

        res.status(200).json({
            message: 'Product type updated successfully',
            updatedProductsCount: updateResult.modifiedCount
        });
    } catch (error: any) {
        console.error('Error updating product type:', error);
        res.status(500).json({ message: 'Server error updating product type' });
    }
};

export const deleteProductType = async (req: Request, res: Response) => {
    try {
        const typeName = req.params.name || req.query.name || req.body.name;
        if (!typeName || typeof typeName !== 'string' || !typeName.trim()) {
            return res.status(400).json({ message: 'Product type name is required' });
        }

        const trimmed = typeName.trim();

        // 1. Remove ProductType document from product_types collection
        await ProductType.deleteMany({ name: new RegExp(`^${trimmed}$`, 'i') });

        // 2. Find all products associated with this ProductType
        const productsToDelete = await Product.find({ type: new RegExp(`^${trimmed}$`, 'i') });

        let deletedProductsCount = 0;
        let deletedImagesCount = 0;
        const bucket = process.env.AWS_S3_BUCKET_NAME || 'my-bucket';

        // 3. For each product, delete S3 images and delete product document
        for (const product of productsToDelete) {
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                for (const img of product.images) {
                    const imageKey = getImageKeyFromUrl(String(img));
                    if (imageKey) {
                        try {
                            const command = new DeleteObjectCommand({
                                Bucket: bucket,
                                Key: imageKey
                            });
                            await s3.send(command);
                            deletedImagesCount++;
                        } catch (s3Err) {
                            console.error(`Failed to delete S3 image ${imageKey}:`, s3Err);
                        }
                    }
                }
            }

            // Remove product document
            await Product.findByIdAndDelete(product._id);
            deletedProductsCount++;
        }

        res.status(200).json({
            message: `Page deleted successfully`,
            deletedProductsCount,
            deletedImagesCount
        });
    } catch (error: any) {
        console.error('Error deleting product type:', error);
        res.status(500).json({ message: 'Server error deleting product type' });
    }
};
