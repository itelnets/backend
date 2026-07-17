import express from 'express';
import { register, verifyOTP, login, forgotPassword, resetPassword, adminLogin } from '../controllers/authController';

const router = express.Router();

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
