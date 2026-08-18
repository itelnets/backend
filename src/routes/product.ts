import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct, reorderProducts, getFilters, getProductTypes, createProductType, updateProductType, deleteProductType } from '../controllers/productController';
import { getReviews, createReview, updateReview } from '../controllers/reviewController';
import { authenticate, isAdmin } from '../middleware/auth';

const router = express.Router();

router.route('/').get(getProducts).post(authenticate, isAdmin, createProduct);
router.route('/types').get(getProductTypes).post(authenticate, isAdmin, createProductType).put(authenticate, isAdmin, updateProductType).delete(authenticate, isAdmin, deleteProductType);
router.route('/types/:name').delete(authenticate, isAdmin, deleteProductType);
router.route('/filters').get(getFilters);
router.route('/reorder').post(authenticate, isAdmin, reorderProducts);
router.route('/:id').get(getProductById).put(authenticate, isAdmin, updateProduct).delete(authenticate, isAdmin, deleteProduct);

// Review routes
router.route('/:id/reviews')
    .get(getReviews)
    .post(authenticate, createReview)
    .put(authenticate, updateReview);

export default router;
