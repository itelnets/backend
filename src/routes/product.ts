import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { getReviews, createReview, updateReview } from '../controllers/reviewController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);

// Review routes
router.route('/:id/reviews')
    .get(getReviews)
    .post(authenticate, createReview)
    .put(authenticate, updateReview);

export default router;
