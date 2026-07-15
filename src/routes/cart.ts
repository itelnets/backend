import express from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cartController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.route('/')
    .get(authenticate, getCart)
    .post(authenticate, addToCart)
    .delete(authenticate, clearCart);

router.route('/:productId')
    .put(authenticate, updateCartItem)
    .delete(authenticate, removeFromCart);

export default router;
