import nodemailer from 'nodemailer';


export const sendEmailOTP = async (email: string, otp: string): Promise<boolean> => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    const isProduction = Boolean(emailUser && emailPass);

    // DEV MODE: just log to console if credentials are not found
    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] OTP for ${email}: ${otp}`);
        console.log('========================================\n');
        return true;
    }

    // PRODUCTION: send real Gmail using App Password
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        await transporter.sendMail({
            from: `"Itelents" <${emailUser}>`,
            to: email,
            subject: 'Your OTP for Itelents Registration',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>Thank you for choosing Itelents. To complete your registration and verify your email address, please use the following One-Time Password (OTP):</p>
                    <h2 style="color: #15803d; font-size: 28px; letter-spacing: 6px; margin: 20px 0;">${otp}</h2>
                    <p>This OTP is valid for <strong>2 minutes</strong>. For your security, please do not share this code with anyone.</p>
                    <p style="color: #6b7280; font-size: 13px;">If you did not request this verification, please ignore this email.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Itelents</strong></p>
                </div>
            `,
        });

        return true;
    } catch (error: any) {
        console.error('Email OTP send error:', error.message);
        return false;
    }
};

export const sendVerificationSuccessEmail = async (email: string): Promise<boolean> => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    const isProduction = Boolean(emailUser && emailPass);

    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] Verification Success Email for ${email}`);
        console.log('========================================\n');
        return true;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        await transporter.sendMail({
            from: `"Itelents" <${emailUser}>`,
            to: email,
            subject: 'Registration Successful - Welcome to Itelents!',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>Thank you for registering with us. Your registration has been successfully completed.</p>
                    <p>Welcome to our Ayurvedic family. We are delighted to have you with us and look forward to supporting your wellness journey with the goodness of Ayurveda. You can now explore and purchase our range of authentic Ayurvedic products, carefully formulated to promote natural health and well-being.</p>
                    <p>We are committed to providing high-quality products and a seamless shopping experience. Thank you for choosing us as your trusted partner in achieving a healthier lifestyle.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Itelents</strong></p>
                </div>
            `,
        });

        return true;
    } catch (error: any) {
        console.error('Welcome email send error:', error.message);
        return false;
    }
};

export const sendPasswordResetLink = async (email: string, token: string): Promise<boolean> => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const isProduction = Boolean(emailUser && emailPass);

    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] Password Reset Link for ${email}:\n${resetLink}`);
        console.log('========================================\n');
        return true;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        await transporter.sendMail({
            from: `"Itelents" <${emailUser}>`,
            to: email,
            subject: 'Reset Your Itelents Password',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>We received a request to reset the password for your Itelents account associated with this email address.</p>
                    <div style="margin: 20px 0;">
                        <a href="${resetLink}" style="background-color: #15803d; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>This link is valid for <strong>2 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Itelents Security Team</strong></p>
                </div>
            `,
        });
        return true;
    } catch (error: any) {
        console.error('Password reset email error:', error.message);
        return false;
    }
};

export const sendPasswordResetSuccessEmail = async (email: string): Promise<void> => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    const isProduction = Boolean(emailUser && emailPass);

    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] Password Reset Success Email sent to ${email}`);
        console.log('========================================\n');
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        await transporter.sendMail({
            from: `"Itelents" <${emailUser}>`,
            to: email,
            subject: 'Your Password Has Been Reset Successfully',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>This email is to confirm that the password for your Itelents account has been successfully reset.</p>
                    <p>If you did not make this change, please contact our support team immediately.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Itelents Security Team</strong></p>
                </div>
            `,
        });
    } catch (error: any) {
        console.error('Password reset success email error:', error.message);
    }
};
