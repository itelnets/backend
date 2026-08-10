import express from 'express';
import { getBanners, createBanner, deleteBanner, updateBanner, reorderBanners } from '../controllers/bannerController';
import { authenticate, isAdmin } from '../middleware/auth';

const router = express.Router();

router.route('/')
    .get(getBanners)
    .post(authenticate, isAdmin, createBanner);

router.route('/reorder')
    .post(authenticate, isAdmin, reorderBanners);

router.route('/:id')
    .delete(authenticate, isAdmin, deleteBanner)
    .patch(authenticate, isAdmin, updateBanner);

export default router;
