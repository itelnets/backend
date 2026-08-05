import express from 'express';
import { getProfile, updateProfile, requestEmailChange, verifyEmailChange, getAllUsersAdmin, deleteUserProfile, toggleUserStatus } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.delete('/profile', authenticate, deleteUserProfile);
router.post('/change-email-request', authenticate, requestEmailChange);
router.post('/change-email-verify', authenticate, verifyEmailChange);

router.get('/admin/all', authenticate, getAllUsersAdmin);
router.put('/admin/:id/status', authenticate, toggleUserStatus);

export default router;
