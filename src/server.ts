import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth';
import productRoutes from './routes/product';
import uploadRoutes from './routes/upload';
import addressRoutes from './routes/addressRoutes';
import bannerRoutes from './routes/banner';
import cartRoutes from './routes/cart';
import wishlistRoutes from './routes/wishlist';
import userRoutes from './routes/userRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { logger } from './middleware/logger';

const app = express();
app.set('trust proxy', 1); // Trust first proxy for rate limiting (e.g., ngrok/load balancer)
const PORT = process.env.PORT || 4000;

// Middleware
app.use(logger);

app.use(cors({
    origin: true, // This allows ALL origins seamlessly
    credentials: true
}));
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/users', userRoutes);
import orderRoutes from './routes/orderRoutes';

app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);

// Root route to prevent 500 errors on Vercel base URL
app.get('/', (req, res) => {
    res.send('E-commerce Backend API is running...');
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('CRITICAL ERROR: MONGODB_URI environment variable is not defined!');
} else {
    // Serverless-friendly connection options
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
    })
    .then(() => {
        console.log('Successfully connected to MongoDB');
        // Only start the listener if we aren't in a serverless environment
        if (process.env.NODE_ENV !== 'production' || process.env.IS_LOCAL) {
            app.listen(PORT, () => {
                console.log(`Server is running on http://localhost:${PORT}`);
            });
        }
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });
}

export default app;

