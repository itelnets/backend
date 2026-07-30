import { Request, Response } from 'express';
import User from '../models/User';
import Address from '../models/Address';

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Not authorized, please login' });
        }

        const user = await User.findById(userId);

        if (user) {
            let addresses = undefined;
            if (req.query.include === 'addresses') {
                addresses = await Address.find({ userId });
            }

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                mobileNumber: user.mobileNumber,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                ...(addresses && { addresses }),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Not authorized, please login' });
        }

        const user = await User.findById(userId);

        if (user) {
            user.name = req.body.name !== undefined ? req.body.name : user.name;
            user.mobileNumber = req.body.mobileNumber !== undefined ? req.body.mobileNumber : user.mobileNumber;

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                mobileNumber: updatedUser.mobileNumber,
                role: updatedUser.role,
                isEmailVerified: updatedUser.isEmailVerified,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};

import { generateOTP, isOTPExpired } from '../utils/otp';
import { sendEmailOTP } from '../utils/emailOtp';

export const requestEmailChange = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { newEmail } = req.body;

        if (!userId || !newEmail) {
            return res.status(400).json({ message: 'User and new email are required' });
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|in|org|net|co\.in|edu|gov|io|co)$/i;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Check if new email is already in use by a verified user
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser && existingUser.isEmailVerified) {
            return res.status(400).json({ message: 'Email is already registered to another account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if OTP was sent recently
        if (user.otpExpiresAt && user.otpExpiresAt > new Date()) {
            return res.status(400).json({ message: 'OTP already sent. Please try after 2 minutes' });
        }

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 mins

        user.pendingEmail = newEmail;
        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        await user.save();

        const sent = await sendEmailOTP(newEmail, otp);
        if (!sent) {
            return res.status(500).json({ message: 'Failed to send OTP to the new email.' });
        }

        res.status(200).json({ message: 'OTP sent to new email' });
    } catch (error) {
        console.error('Request email change error:', error);
        res.status(500).json({ message: 'Failed to request email change' });
    }
};

export const verifyEmailChange = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { otp } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({ message: 'OTP is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.pendingEmail) {
            return res.status(400).json({ message: 'No pending email change request found' });
        }

        if (!user.otp || user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (!user.otpExpiresAt || isOTPExpired(user.otpExpiresAt)) {
            return res.status(400).json({ message: 'Your OTP has expired' });
        }

        // Apply email change
        user.email = user.pendingEmail;
        user.pendingEmail = undefined;
        user.otp = undefined;
        user.otpExpiresAt = undefined;
        user.isEmailVerified = true;
        
        const updatedUser = await user.save();

        res.status(200).json({
            message: 'Email updated successfully',
            user: {
                _id: updatedUser._id,
                email: updatedUser.email,
                name: updatedUser.name,
                mobileNumber: updatedUser.mobileNumber,
                role: updatedUser.role,
                isEmailVerified: updatedUser.isEmailVerified,
            }
        });
    } catch (error) {
        console.error('Verify email change error:', error);
        res.status(500).json({ message: 'Failed to verify and update email' });
    }
};
