import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Address from '../models/Address';

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Not authorized, please login' });
        }

        const [user, addresses] = await Promise.all([
            User.findById(userId).lean(),
            req.query.include === 'addresses' ? Address.find({ userId }).lean() : Promise.resolve(undefined)
        ]);

        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                mobileNumber: user.mobileNumber,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                isDoctorVerified: user.isDoctorVerified || false,
                doctorPromoCode: user.doctorPromoCode || '',
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
            return res.status(400).json({ message: 'Email is already registered' });
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

export const getAllUsersAdmin = async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        let matchStage: any = {};
        if (search) {
            matchStage = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
            if (/^[0-9a-fA-F]{24}$/.test(search)) {
                matchStage.$or.push({ _id: new mongoose.Types.ObjectId(search) });
            }
        }

        const aggregationPipeline: any[] = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'orders'
                }
            },
            {
                $addFields: {
                    totalOrders: { $size: '$orders' },
                    successOrders: {
                        $size: {
                            $filter: {
                                input: '$orders',
                                as: 'order',
                                cond: {
                                    $in: ['$$order.status', ['Captured', 'Shipped', 'Delivered']]
                                }
                            }
                        }
                    },
                    returnCount: {
                        $size: {
                            $filter: {
                                input: '$orders',
                                as: 'order',
                                cond: {
                                    $in: ['$$order.status', ['Refund Requested', 'Refund Initiated', 'Refunded', 'Refund Failed']]
                                }
                            }
                        }
                    },
                    failedOrders: {
                        $size: {
                            $filter: {
                                input: '$orders',
                                as: 'order',
                                cond: {
                                    $in: ['$$order.status', ['Cancelled', 'Pending']]
                                }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    orders: 0 // Remove the full orders array from the final output
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            }
        ];

        const results = await User.aggregate(aggregationPipeline);

        const totalUsers = results[0].metadata[0] ? results[0].metadata[0].total : 0;
        const users = results[0].data;

        res.json({
            users,
            page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers
        });
    } catch (error) {
        console.error('Get all users admin error:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};

// @desc    Delete user profile (soft delete)
// @route   DELETE /api/users/profile
// @access  Private
export const deleteUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        // @ts-ignore
        const user = await User.findById(req.user.userId);

        if (user) {
            user.isDeleted = true;
            await user.save();
            res.json({ message: 'User deleted successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Toggle user status (isDeleted) by admin
// @route   PUT /api/users/admin/:id/status
// @access  Private/Admin
export const toggleUserStatus = async (req: Request, res: Response) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isDeleted = req.body.isDeleted;
        await user.save();

        res.json({ message: 'User status updated successfully', user });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
