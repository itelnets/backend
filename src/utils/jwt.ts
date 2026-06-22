import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export interface JWTPayload {
    userId: string;
    mobileNumber: string;
    role: string;
}

/**
 * Generate JWT token
 */
export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d'
    });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

