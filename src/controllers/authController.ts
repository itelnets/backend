import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { generateOTP, isOTPExpired } from '../utils/otp';
import { sendEmailOTP, sendVerificationSuccessEmail, sendPasswordResetLink, sendPasswordResetSuccessEmail } from '../utils/emailOtp';
import crypto from 'crypto';


export const register = async (req: Request, res: Response) => {
    try {
        const { email, mobileNumber, password } = req.body;

        // Validation
        if (!email || !mobileNumber || !password) {
            return res.status(400).json({
                message: 'Email, mobile number, and password are required',
            });
        }

        // Validate email format strictly (allowing common TLDs to prevent typos like .comv)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|in|org|net|co\.in|edu|gov|io|co)$/i;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Validate phone number format (should include country code)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(mobileNumber)) {
            return res.status(400).json({
                message: 'Invalid phone number format. Please include country code (e.g., +911234567890)',
            });
        }

        // Check if verified user already exists (by email or mobile)
        const existingByEmail = await User.findOne({ email });
        if (existingByEmail && existingByEmail.isEmailVerified) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const existingByMobile = await User.findOne({ mobileNumber });
        if (existingByMobile && existingByMobile.isEmailVerified) {
            return res.status(400).json({ message: 'Mobile number already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if unverified user recently requested an OTP
        const existingUser = existingByEmail || existingByMobile;
        if (existingUser && existingUser.otpExpiresAt && existingUser.otpExpiresAt > new Date()) {
            // Only block if they are trying with the EXACT same email and mobile
            if (existingUser.email === email && existingUser.mobileNumber === mobileNumber) {
                return res.status(400).json({ message: 'OTP already sent. Please try after 2 minutes' });
            }
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        // Create or update unverified user
        if (existingUser) {
            existingUser.email = email;
            existingUser.mobileNumber = mobileNumber;
            existingUser.password = hashedPassword;
            existingUser.isEmailVerified = false;
            existingUser.otp = otp;
            existingUser.otpExpiresAt = otpExpiresAt;
            await existingUser.save();
        } else {
            await User.create({
                email,
                mobileNumber,
                password: hashedPassword,
                role: 'customer',
                isEmailVerified: false,
                otp,
                otpExpiresAt,
            });
        }

        // Send OTP via Email
        const sent = await sendEmailOTP(email, otp);
        if (!sent) {
            return res.status(500).json({
                message: 'Failed to send OTP email. Please try again',
            });
        }

        res.status(200).json({
            message: `OTP sent successfully.`,
            email,
        });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed. Please try again' });
    }
};

export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found. Please register again' });
        }

        // Check OTP match
        if (!user.otp || user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP. Please try again' });
        }

        // Check OTP expiry
        if (!user.otpExpiresAt || isOTPExpired(user.otpExpiresAt)) {
            return res.status(400).json({ message: 'Your OTP has expired' });
        }

        // Mark verified and clear OTP
        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpiresAt = undefined;
        await user.save();

        // Send Welcome/Success Email (background task)
        sendVerificationSuccessEmail(user.email).catch(console.error);

        res.status(200).json({
            message: 'Registration successfully!',
        });
    } catch (error: any) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Verification failed. Please try again' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Bypass verification check for admin
        if (user.role !== 'admin' && !user.isEmailVerified) {
            return res.status(401).json({ message: 'Please verify your email first' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        res.status(200).json({
            message: 'Login successfully!',
            token,
            email: user.email,
            name: user.email,
            user: {
                id: user._id,
                email: user.email,
                mobileNumber: user.mobileNumber,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
            },
            role: user.role,
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed. Please try again later' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'Email not registered' });
        }

        if (!user.isEmailVerified) {
            return res.status(401).json({ message: 'Please verify your email first' });
        }

        // Check if a reset link was recently sent
        if (user.resetPasswordExpiresAt && user.resetPasswordExpiresAt > new Date()) {
            return res.status(400).json({ message: 'Password reset link already sent. Please try after 2 minutes' });
        }

        // Generate a cryptographically secure token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Save to user (expires in 2 minutes)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
        await user.save();

        // Send Email
        const sent = await sendPasswordResetLink(user.email, resetToken);
        if (!sent) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpiresAt = undefined;
            await user.save();
            return res.status(500).json({ message: 'Failed to send reset email. Please try again later.' });
        }

        res.status(200).json({ message: 'Password reset link sent successfully' });
    } catch (error: any) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }

        // Find user by token
        const user = await User.findOne({ resetPasswordToken: token });

        if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
            return res.status(400).json({ message: 'Password reset link has expired.' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiresAt = undefined;
        await user.save();

        // Send Success Email (background task)
        sendPasswordResetSuccessEmail(user.email).catch(console.error);

        res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error: any) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Failed to reset password. Please try again later.' });
    }
};
