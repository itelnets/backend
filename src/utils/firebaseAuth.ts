import admin from '../config/firebase';

/**
 * Verify Firebase ID token
 * This is used after the frontend verifies the OTP with Firebase
 */
export const verifyFirebaseIdToken = async (idToken: string) => {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        throw new Error('Invalid or expired Firebase ID token');
    }
};

/**
 * Get user by phone number from Firebase
 */
export const getFirebaseUserByPhone = async (phoneNumber: string) => {
    try {
        const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
        return user;
    } catch (error) {
        return null;
    }
};

/**
 * Create a custom token for a user
 * This can be used to authenticate users in Firebase
 */
export const createCustomToken = async (uid: string, additionalClaims?: object) => {
    try {
        const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
        return customToken;
    } catch (error) {
        throw new Error('Failed to create custom token');
    }
};

