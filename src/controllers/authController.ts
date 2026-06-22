import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { verifyFirebaseIdToken } from '../utils/firebaseAuth';

/**
 * Register user and send OTP via Firebase
 * POST /api/auth/register
 * 
 * Note: The frontend should use Firebase Client SDK to send OTP.
 * This endpoint stores user data temporarily until OTP is verified.
 */
export const register = async (req: Request, res: Response) => {
    try {
        const { name, mobileNumber, password, role } = req.body;

        // Validation
        if (!name || !mobileNumber || !password) {
            return res.status(400).json({
                message: 'Name, mobile number, and password are required'
            });
        }

        if (!['customer', 'admin'].includes(role)) {
            return res.status(400).json({
                message: 'Role must be either "customer" or "admin"'
            });
        }

        // Validate phone number format (should include country code)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(mobileNumber)) {
            return res.status(400).json({
                message: 'Invalid phone number format. Please include country code (e.g., +1234567890)'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ mobileNumber });
        if (existingUser && existingUser.isVerified) {
            return res.status(400).json({
                message: 'User with this mobile number already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create or update user (unverified)
        if (existingUser) {
            existingUser.name = name;
            existingUser.password = hashedPassword;
            existingUser.role = role;
            existingUser.isVerified = false;
            await existingUser.save();
        } else {
            await User.create({
                name,
                mobileNumber,
                password: hashedPassword,
                role,
                isVerified: false
            });
        }

        // Note: OTP sending is handled by Firebase Client SDK on the frontend
        // The frontend should call Firebase's sendPhoneVerificationCode method
        res.status(200).json({
            message: 'OTP sent to your mobile number!',
            mobileNumber: mobileNumber
        });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({
            message: 'Registration failed. Please try again.'
        });
    }
};

/**
 * Verify OTP using Firebase ID token and complete registration
 * POST /api/auth/verify-otp
 * 
 * The frontend should verify the OTP with Firebase Client SDK first,
 * then send the Firebase ID token to this endpoint.
 */
export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { mobileNumber, idToken } = req.body;

        // Validation
        if (!mobileNumber || !idToken) {
            return res.status(400).json({
                message: 'Mobile number and Firebase ID token are required'
            });
        }

        // Verify Firebase ID token
        let decodedToken;
        try {
            decodedToken = await verifyFirebaseIdToken(idToken);
        } catch (error: any) {
            return res.status(401).json({
                message: 'Invalid or expired Firebase token. Please verify OTP again.'
            });
        }

        // Verify that the phone number in the token matches the request
        const tokenPhoneNumber = decodedToken.phone_number;
        if (tokenPhoneNumber !== mobileNumber) {
            return res.status(400).json({
                message: 'Phone number mismatch. Please try again.'
            });
        }

        // Find user
        let user = await User.findOne({ mobileNumber });
        if (!user) {
            return res.status(404).json({
                message: 'User not found. Please register again.'
            });
        }

        // Mark user as verified
        user.isVerified = true;
        await user.save();

        // Generate JWT token for our backend
        const token = generateToken({
            userId: user._id.toString(),
            mobileNumber: user.mobileNumber,
            role: user.role
        });

        // Return user info and token
        res.status(200).json({
            message: 'Registration successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                mobileNumber: user.mobileNumber,
                role: user.role,
                isVerified: user.isVerified
            },
            role: user.role
        });
    } catch (error: any) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            message: 'Verification failed. Please try again.'
        });
    }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { mobileNumber, password } = req.body;

        if (!mobileNumber || !password) {
            return res.status(400).json({
                message: 'Mobile number and password are required'
            });
        }

        const user = await User.findOne({ mobileNumber });

        if (!user) {
            return res.status(404).json({
                message: 'User not found. Please register first.'
            });
        }

        if (!user.isVerified) {
            return res.status(401).json({
                message: 'Please verify your mobile number first.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const token = generateToken({
            userId: user._id.toString(),
            mobileNumber: user.mobileNumber,
            role: user.role
        });

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                mobileNumber: user.mobileNumber,
                role: user.role,
                isVerified: user.isVerified
            },
            role: user.role
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Login failed. Please try again.'
        });
    }
};

