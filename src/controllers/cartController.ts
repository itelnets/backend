import { Request, Response } from 'express';
import Cart from '../models/Cart';
import Product from '../models/Product';

const getFormattedCartItems = async (userId: string) => {
    const cartItems = await Cart.find({ userId }).populate('productId');

    return cartItems.map(item => {
        const product = item.productId as any;

        let isSoldOut = false;
        if (product) {
            if (!product.isActive) {
                isSoldOut = true;
            } else if (
                product.inStock === '0' ||
                product.inStock?.toLowerCase() === 'out of stock' ||
                product.inStock?.toLowerCase() === 'false' ||
                product.inStock?.toLowerCase() === 'no'
            ) {
                isSoldOut = true;
            }
        } else {
            isSoldOut = true;
        }

        return {
            _id: item._id,
            userId: item.userId,
            productId: product ? product._id : item.productId,
            quantity: item.quantity,
            isSavedForLater: item.isSavedForLater || false,
            isSold: item.isSold || false,
            paymentStatus: (item as any).paymentStatus || 'pending',
            paymentMethod: (item as any).paymentMethod,
            orderId: (item as any).orderId,
            createdAt: (item as any).createdAt,
            updatedAt: (item as any).updatedAt,
            isSoldOut: isSoldOut,
            product: product
        };
    });
};

export const getCart = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const formattedItems = await getFormattedCartItems(userId);
        const items = formattedItems.filter(item => !item.isSavedForLater);
        const savedItems = formattedItems.filter(item => item.isSavedForLater);
        res.status(200).json({ items, savedItems });
    } catch (error) {
        console.error('getCart error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const addToCart = async (req: Request, res: Response) => {
    try {
        // Drop the old unique index to prevent duplicate key errors. 
        // We do it here to ensure the db connection is fully established.
        await Cart.collection.dropIndex('user_1').catch(() => { });

        const { productId, quantity, saveForLater } = req.body;
        const userId = (req as any).user.userId;

        let cartItem = await Cart.findOne({ userId, productId });

        if (cartItem) {
            if (saveForLater !== undefined) {
                cartItem.isSavedForLater = saveForLater;
                // keep product savedForLaterBy in sync
                if (saveForLater) {
                    await Product.findByIdAndUpdate(productId, { $addToSet: { savedForLaterBy: userId } });
                } else {
                    await Product.findByIdAndUpdate(productId, { $pull: { savedForLaterBy: userId } });
                }
            }
            cartItem.quantity += (quantity || 1);
            await cartItem.save();
        } else {
            cartItem = new Cart({
                userId,
                productId,
                quantity: quantity || 1,
                isSavedForLater: saveForLater || false
            });
            await cartItem.save();

            if (saveForLater) {
                await Product.findByIdAndUpdate(productId, { $addToSet: { savedForLaterBy: userId } });
            }
        }

        const formattedItems = await getFormattedCartItems(userId);
        const items = formattedItems.filter(item => !item.isSavedForLater);
        const savedItems = formattedItems.filter(item => item.isSavedForLater);
        res.status(200).json({ items, savedItems });
    } catch (error) {
        console.error('addToCart error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const updateCartItem = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const { quantity, saveForLater } = req.body;
        const userId = (req as any).user.userId;

        const cartItem = await Cart.findOne({ userId, productId });
        if (!cartItem) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        if (saveForLater !== undefined) {
            cartItem.isSavedForLater = saveForLater;
            if (saveForLater) {
                await Product.findByIdAndUpdate(productId, { $addToSet: { savedForLaterBy: userId } });
            } else {
                await Product.findByIdAndUpdate(productId, { $pull: { savedForLaterBy: userId } });
            }
        }

        if (typeof quantity === 'number') {
            if (quantity <= 0) {
                await cartItem.deleteOne();
                const formattedItems = await getFormattedCartItems(userId);
                const items = formattedItems.filter(item => !item.isSavedForLater);
                const savedItems = formattedItems.filter(item => item.isSavedForLater);
                return res.status(200).json({ items, savedItems });
            }

            cartItem.quantity = quantity;
        }

        await cartItem.save();

        const formattedItems = await getFormattedCartItems(userId);
        const items = formattedItems.filter(item => !item.isSavedForLater);
        const savedItems = formattedItems.filter(item => item.isSavedForLater);
        return res.status(200).json({ items, savedItems });
    } catch (error) {
        console.error('updateCartItem error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const removeFromCart = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const userId = (req as any).user.userId;

        const cartItem = await Cart.findOne({ userId, productId });
        if (cartItem) {
            // if it was saved for later, remove user from product.savedForLaterBy
            if (cartItem.isSavedForLater) {
                await Product.findByIdAndUpdate(productId, { $pull: { savedForLaterBy: userId } });
            }
            await cartItem.deleteOne();
        }

        const formattedItems = await getFormattedCartItems(userId);
        const items = formattedItems.filter(item => !item.isSavedForLater);
        const savedItems = formattedItems.filter(item => item.isSavedForLater);
        res.status(200).json({ items, savedItems });
    } catch (error) {
        console.error('removeFromCart error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export const clearCart = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        await Cart.deleteMany({ userId, isSavedForLater: false });

        const formattedItems = await getFormattedCartItems(userId);
        const items = formattedItems.filter(item => !item.isSavedForLater);
        const savedItems = formattedItems.filter(item => item.isSavedForLater);
        res.status(200).json({ message: 'Cart cleared', items, savedItems });
    } catch (error) {
        console.error('clearCart error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
