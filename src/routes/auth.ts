import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, verifyOTP, login, forgotPassword, resetPassword, adminLogin } from '../controllers/authController';

const router = express.Router();

import User from '../models/User';

const authLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes
    max: 3, // Limit each IP+email to 5 requests per window
    message: { message: 'Too many requests for this email, try after 2 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false, // Disables the IPv6 key generator warning
    keyGenerator: (req) => {
        return `${req.ip}_${req.body.email ? req.body.email.toLowerCase().trim() : 'no-email'}`;
    },
    skip: async (req) => {
        if (!req.body.email) return false;

        // Only apply rate limiting if the email is actually registered
        const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
        if (!user) {
            return true; // Skip rate limiting (don't count this request)
        }
        return false;
    }
});

router.post('/register', authLimiter, register);
router.post('/verify-otp', verifyOTP);
router.post('/login', authLimiter, login);
router.post('/admin-login', adminLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
