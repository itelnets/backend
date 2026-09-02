import nodemailer from 'nodemailer';

const getTransporter = () => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST || 'smtpout.secureserver.net';
    const emailPort = Number(process.env.EMAIL_PORT) || 465;

    return nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
            user: emailUser,
            pass: emailPass,
        },
    });
};

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

    // PRODUCTION: send email
    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${emailUser}>`,
            to: email,
            subject: 'Your OTP for Pratham Herbs Registration',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>Thank you for choosing Pratham Herbs. To complete your registration and verify your email address, please use the following One-Time Password (OTP):</p>
                    <h2 style="color: #15803d; font-size: 28px; letter-spacing: 6px; margin: 20px 0;">${otp}</h2>
                    <p>This OTP is valid for <strong>2 minutes</strong>. For your security, please do not share this code with anyone.</p>
                    <p style="color: #6b7280; font-size: 13px;">If you did not request this verification, please ignore this email.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Pratham Herbs</strong></p>
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
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${emailUser}>`,
            to: email,
            subject: 'Registration Successful - Welcome to Pratham Herbs!',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>Thank you for registering with us. Your registration has been successfully completed.</p>
                    <p>Welcome to our Ayurvedic family. We are delighted to have you with us and look forward to supporting your wellness journey with the goodness of Ayurveda. You can now explore and purchase our range of authentic Ayurvedic products, carefully formulated to promote natural health and well-being.</p>
                    <p>We are committed to providing high-quality products and a seamless shopping experience. Thank you for choosing us as your trusted partner in achieving a healthier lifestyle.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Pratham Herbs</strong></p>
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
    const frontendUrl = process.env.FRONTEND_URL;
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const isProduction = Boolean(emailUser && emailPass);

    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] Password Reset Link for ${email}:\n${resetLink}`);
        console.log('========================================\n');
        return true;
    }

    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${emailUser}>`,
            to: email,
            subject: 'Reset Your Pratham Herbs Password',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>We received a request to reset the password for your Pratham Herbs account associated with this email address.</p>
                    <div style="margin: 20px 0;">
                        <a href="${resetLink}" style="background-color: #15803d; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>This link is valid for <strong>2 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Pratham Herbs Security Team</strong></p>
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
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${emailUser}>`,
            to: email,
            subject: 'Your password has been reset successfully',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6;">
                    <p>Dear Customer,</p>
                    <p>This email is to confirm that the password for your Pratham Herbs account has been successfully reset.</p>
                    <p>If you did not make this change, please contact our support team immediately.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Pratham Herbs Security Team</strong></p>
                </div>
            `,
        });
    } catch (error: any) {
        console.error('Password reset success email error:', error.message);
    }
};

export const sendDoctorApprovalEmail = async (email: string, name: string, promoCode: string, discountDetails: string): Promise<boolean> => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const isProduction = Boolean(emailUser && emailPass);

    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] Doctor Approval Email to ${email} (Dr. ${name}): Code=${promoCode}`);
        console.log('========================================\n');
        return true;
    }

    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${emailUser}>`,
            to: email,
            subject: 'Doctor Verification Approved - Your Exclusive Promo Code!',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
                    <h2 style="color: #15803d; margin-top: 0;">Doctor Verification Approved!</h2>
                    <p>Dear Dr. ${name},</p>
                    <p>We are pleased to inform you that your medical council registration details have been verified and approved by our team.</p>
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0; color: #166534; font-size: 13px; font-weight: bold; text-transform: uppercase;">YOUR EXCLUSIVE DOCTOR PROMO CODE:</p>
                        <div style="margin: 14px 0;">
                            <span style="font-family: monospace, Courier, sans-serif; color: #15803d; font-size: 28px; font-weight: bold; letter-spacing: 3px; display: inline-block;">${promoCode}</span>
                        </div>
                        <p style="margin: 14px 0 0 0; color: #15803d; font-size: 13px; font-weight: 500;">${discountDetails.includes('%') ? discountDetails : `${discountDetails}% OFF on all prescription & healthcare products`}</p>
                    </div>
                    <p>You can use this promo code during checkout to claim your doctor discount on all eligible products.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Pratham Herbs Team</strong></p>
                </div>
            `,
        });
        return true;
    } catch (error: any) {
        console.error('Doctor approval email error:', error.message);
        return false;
    }
};

export const sendDoctorRejectionEmail = async (email: string, name: string, reason?: string): Promise<boolean> => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const isProduction = Boolean(emailUser && emailPass);

    if (!isProduction) {
        console.log('\n========================================');
        console.log(`[DEV] Doctor Rejection Email to ${email} (Dr. ${name}): Reason=${reason || 'None provided'}`);
        console.log('========================================\n');
        return true;
    }

    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${emailUser}>`,
            to: email,
            subject: 'Doctor Verification Request Update - Pratham Herbs',
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
                    <h2 style="color: #dc2626; margin-top: 0;">Doctor Verification Request Status</h2>
                    <p>Dear Dr. ${name},</p>
                    <p>Thank you for submitting your doctor verification details with Pratham Herbs.</p>
                    <p>After reviewing your submitted details and medical council registration records, we were unable to approve your request at this time.</p>
                    ${reason ? `
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: bold;">REASON / NOTES:</p>
                        <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 14px;">${reason}</p>
                    </div>
                    ` : ''}
                    <p>If you believe there was a typo or mismatch, you can log in to your account and resubmit your updated verification details anytime in Doctor Corner.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>Pratham Herbs Team</strong></p>
                </div>
            `,
        });
        return true;
    } catch (error: any) {
        console.error('Doctor rejection email error:', error.message);
        return false;
    }
};
