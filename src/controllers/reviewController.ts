import { Request, Response } from 'express';
import Review from '../models/Review';
import mongoose from 'mongoose';
import Product from '../models/Product';

const updateProductRating = async (productId: string) => {
    const reviewDocs = await Review.find({ productId });
    const numReviews = reviewDocs.length;
    let rating = 0;
    if (numReviews > 0) {
        const sum = reviewDocs.reduce((acc, review) => acc + review.rating, 0);
        rating = Number((sum / numReviews).toFixed(1));
    }
    const reviews = reviewDocs.map(r => ({ userId: r.user, rating: r.rating }));
    await Product.findByIdAndUpdate(productId, { rating, numReviews, reviews });
};

export const getReviews = async (req: Request, res: Response) => {
    try {
        const { id: productId } = req.params;

        const reviews = await Review.find({ productId })
            .populate('user', 'email name')
            .sort({ createdAt: -1 });

        // Calculate stats
        const totalReviews = reviews.length;
        let averageRating = 0;
        const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        if (totalReviews > 0) {
            let sum = 0;
            reviews.forEach((review) => {
                sum += review.rating;
                if (ratingDistribution[review.rating as keyof typeof ratingDistribution] !== undefined) {
                    ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
                }
            });
            averageRating = Number((sum / totalReviews).toFixed(1));
        }

        res.status(200).json({
            reviews,
            stats: {
                averageRating,
                totalReviews,
                ratingDistribution,
            },
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ message: 'Failed to fetch reviews' });
    }
};

export const createReview = async (req: Request, res: Response) => {
    try {
        const { id: productId } = req.params;
        const userId = req.user?.userId;



        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { rating, comment, isPositive, tags } = req.body;

        if (!rating || !comment) {
            return res.status(400).json({ message: 'Rating and comment are required' });
        }

        // Check if user already reviewed
        const existingReview = await Review.findOne({ user: userId, productId });
        if (existingReview) {
            return res.status(400).json({ message: 'You have already reviewed this product' });
        }

        const review = await Review.create({
            user: userId,
            productId,
            rating,
            comment,
            isPositive: isPositive ?? (rating >= 3),
            tags: tags || [],
        });

        await updateProductRating(productId);

        res.status(201).json({ message: 'Review created successfully', review });
    } catch (error: any) {
        if (error.code === 11000) {
             return res.status(400).json({ message: 'You have already reviewed this product' });
        }
        console.error('Create review error:', error);
        res.status(500).json({ message: 'Failed to create review' });
    }
};

export const updateReview = async (req: Request, res: Response) => {
    try {
        const { id: productId } = req.params;
        const userId = req.user?.userId;



        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { rating, comment, isPositive, tags } = req.body;

        const review = await Review.findOne({ user: userId, productId });
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (rating) review.rating = rating;
        if (comment) review.comment = comment;
        if (isPositive !== undefined) review.isPositive = isPositive;
        if (tags) review.tags = tags;
        // recalculate isPositive if rating changes and isPositive not explicitly provided
        if (rating && isPositive === undefined) {
             review.isPositive = rating >= 3;
        }

        await review.save();
        await updateProductRating(productId);

        res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({ message: 'Failed to update review' });
    }
};
