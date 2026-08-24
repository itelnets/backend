import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface JWTPayload {
    userId: string;
    email?: string;
    mobileNumber?: string;
    role: string;
}

/**
 * Generate JWT token
 */
export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, JWT_SECRET);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

