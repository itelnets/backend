import { Request, Response } from 'express';
import Product from '../models/Product';

const formatProducts = (products: any[]) => products.map(p => ({
    _id: p._id,
    productId: p._id,
    product: p,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
}));

export const getWishlist = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const products = await Product.find({ savedBy: userId });
        return res.status(200).json({ wishlist: formatProducts(products) });
    } catch (error) {
        console.error('getWishlist error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const addToWishlist = async (req: Request, res: Response) => {
    try {
        const { productId } = req.body;
        const userId = (req as any).user.userId;

        await Product.findByIdAndUpdate(productId, { $addToSet: { savedBy: userId } });

        const products = await Product.find({ savedBy: userId });
        return res.status(200).json({ wishlist: formatProducts(products) });
    } catch (error) {
        console.error('addToWishlist error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const userId = (req as any).user.userId;

        await Product.findByIdAndUpdate(productId, { $pull: { savedBy: userId } });

        const products = await Product.find({ savedBy: userId });
        return res.status(200).json({ wishlist: formatProducts(products) });
    } catch (error) {
        console.error('removeFromWishlist error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
