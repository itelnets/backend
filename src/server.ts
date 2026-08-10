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
    origin: true, // This dynamically reflects the request origin, allowing all origins while supporting credentials
    credentials: true
}));
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI as string)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

export default app;

