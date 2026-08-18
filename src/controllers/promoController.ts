import { Response } from 'express';
import User from '../models/User';
import DoctorRequest from '../models/DoctorRequest';

// @desc    Verify promo code against database records
// @route   POST /api/promo/verify
// @access  Public (optional Auth to match user doctor promo)
export const verifyPromoCode = async (req: any, res: Response): Promise<void> => {
    try {
        const { code } = req.body;
        if (!code || typeof code !== 'string') {
            res.status(400).json({ valid: false, message: 'Please enter a promo code' });
            return;
        }

        const cleanCode = code.trim().toUpperCase();

        // 1. Search User table for matching verified doctor promo code
        const userPromo = await User.findOne({
            doctorPromoCode: new RegExp(`^${cleanCode}$`, 'i'),
            isDoctorVerified: true
        });

        // 2. Search DoctorRequest table for matching approved promo code
        const doctorReq = await DoctorRequest.findOne({
            promoCode: new RegExp(`^${cleanCode}$`, 'i'),
            status: 'approved'
        });

        if (userPromo || doctorReq) {
            const currentUserId = req.user?.userId || req.user?._id || req.user?.id;
            const targetUserId = userPromo?._id?.toString() || doctorReq?.userId?.toString();

            // Strict Ownership Check: Doctor promo codes can ONLY be used by the verified doctor account it belongs to!
            if (!currentUserId || !targetUserId || currentUserId.toString() !== targetUserId.toString()) {
                res.status(400).json({
                    valid: false,
                    message: 'Invalid or expired promo code'
                });
                return;
            }

            const discountPercent = userPromo?.doctorDiscountPercent || doctorReq?.discountPercent || 10;
            const validCode = userPromo?.doctorPromoCode || doctorReq?.promoCode || cleanCode;

            res.json({
                valid: true,
                code: validCode,
                discountPercent,
                message: `Promo code applied successfully!`
            });
            return;
        }

        res.status(400).json({ valid: false, message: 'Invalid or expired promo code' });
    } catch (error: any) {
        console.error('Error verifying promo code:', error);
        res.status(500).json({ valid: false, message: 'Server error verifying promo code' });
    }
};
