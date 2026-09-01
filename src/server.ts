import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import productRoutes from './routes/product';
import uploadRoutes from './routes/upload';
import addressRoutes from './routes/addressRoutes';
import bannerRoutes from './routes/banner';
import cartRoutes from './routes/cart';
import wishlistRoutes from './routes/wishlist';
import userRoutes from './routes/userRoutes';
import paymentRoutes from './routes/paymentRoutes';
import orderRoutes from './routes/orderRoutes';
import doctorRoutes from './routes/doctorRoutes';
import promoRoutes from './routes/promoRoutes';
import { logger } from './middleware/logger';

const app = express();
app.set('trust proxy', 1); // Trust first proxy for rate limiting (e.g., Vercel / load balancer)
const PORT = process.env.PORT;

// Middleware
app.use(logger);

app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
        if (!origin || allowedOrigins.includes(origin) || process.env.FRONTEND_URL === origin || process.env.ADMIN_URL === origin) {
            callback(null, true);
        } else {
            // console.warn(`[CORS] Allowing unknown origin for webhooks: ${origin}`);
            callback(null, true);
        }
    },
    credentials: true
}));
app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({ extended: true }));

// Ensure DB is connected before handling any request (Serverless optimization)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/payment', paymentRoutes);

// Health check endpoints (supports /, /health, /api, /api/health)
const healthHandler = (req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', message: 'Server is running' });
};
app.get('/', healthHandler);

// Only start listening if we aren't in a serverless environment (Vercel sets process.env.VERCEL)
if (!process.env.VERCEL) {
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    });
}

export default app;
