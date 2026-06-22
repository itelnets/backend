import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        // Option 1: Using service account JSON file
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
            });
        }
        // Option 2: Using individual environment variables
        else if (process.env.FIREBASE_PROJECT_ID) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
        }
        // Option 3: Using default credentials (for Google Cloud environments)
        else {
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw new Error('Failed to initialize Firebase Admin SDK');
    }
}

export default admin;

