import mongoose from 'mongoose';
import dns from 'dns';

// Fix for MongoDB Atlas SRV resolution issues on some local networks
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

export const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState >= 1) {
        return;
    }
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        const err = new Error('MONGODB_URI environment variable is not defined');
        console.error(err.message);
        throw err;
    }
    try {
        await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        console.log('Connected to MongoDB');
    } catch (error) {
        isConnected = false;
        console.error('MongoDB connection error:', error);
        throw error;
    }
};
