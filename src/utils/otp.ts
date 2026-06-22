/**
 * Generate a random 6-digit OTP
 */
export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if OTP is expired
 */
export const isOTPExpired = (expiresAt: Date): boolean => {
    return new Date() > expiresAt;
};

