import express from 'express';
import { authenticate } from '../middleware/auth';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlistController';

const router = express.Router();

router.route('/')
    .get(authenticate, getWishlist)
    .post(authenticate, addToWishlist);

router.route('/:productId')
    .delete(authenticate, removeFromWishlist);

export default router;
