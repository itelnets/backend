import express from 'express';
import { getBanners, createBanner, deleteBanner, updateBanner, reorderBanners } from '../controllers/bannerController';

const router = express.Router();

router.route('/')
    .get(getBanners)
    .post(createBanner);

router.route('/reorder')
    .post(reorderBanners);

router.route('/:id')
    .delete(deleteBanner)
    .patch(updateBanner);

export default router;
