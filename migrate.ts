import mongoose from 'mongoose';
import Review from './src/models/Review';
import Product from './src/models/Product';
import dotenv from 'dotenv';
dotenv.config();

async function migrateData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce');
        console.log('Connected to DB');
        
        // 1. Rename 'product' to 'productId' in all Reviews
        const reviews = await Review.find({});
        let reviewUpdates = 0;
        for (let r of reviews) {
            const raw = (r as any)._doc;
            if (raw.product) {
                raw.productId = raw.product;
                delete raw.product;
                await mongoose.connection.collection('reviews').updateOne(
                    { _id: r._id },
                    { $set: { productId: raw.productId }, $unset: { product: '' } }
                );
                reviewUpdates++;
            }
        }
        console.log(`Updated ${reviewUpdates} reviews to use productId`);

        // 2. Update all Products to have 'reviews' array
        const products = await Product.find({});
        let productUpdates = 0;
        for(let product of products) {
            const reviewDocs = await Review.find({ productId: String(product._id) });
            const numReviews = reviewDocs.length;
            let rating = 0;
            if (numReviews > 0) {
                const sum = reviewDocs.reduce((acc, review) => acc + review.rating, 0);
                rating = Number((sum / numReviews).toFixed(1));
            }
            const productReviews = reviewDocs.map(r => ({ userId: r.user, rating: r.rating }));
            await Product.findByIdAndUpdate(product._id, { rating, numReviews, reviews: productReviews });
            productUpdates++;
        }
        console.log(`Updated ${productUpdates} products with new embedded array`);
    } catch(err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
migrateData();
