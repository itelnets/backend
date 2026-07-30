import express from 'express';
import { getProfile, updateProfile, requestEmailChange, verifyEmailChange } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/change-email-request', authenticate, requestEmailChange);
router.post('/change-email-verify', authenticate, verifyEmailChange);

export default router;
