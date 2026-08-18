import express from 'express';
import { verifyPromoCode } from '../controllers/promoController';
import { authenticateOptional } from '../middleware/auth';

const router = express.Router();

// Optional authentication middleware: if token exists, populate req.user; otherwise proceed
router.post('/verify', authenticateOptional, verifyPromoCode);

export default router;
