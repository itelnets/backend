import mongoose from 'mongoose';
import dns from 'dns';
import { seedDefaultProductTypes } from '../models/ProductType';

// Fix for MongoDB Atlas SRV resolution issues across cloud/serverless environments
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
    console.warn('Unable to set custom DNS servers:', e);
}

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

export const connectDB = async () => {
    if (isConnected || mongoose.connection.readyState >= 1) {
        isConnected = true;
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI as string, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        console.log('Connected to MongoDB');
        seedDefaultProductTypes();
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
};
