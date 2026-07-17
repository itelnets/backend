import { Request, Response } from 'express';
import Address from '../models/Address';

// Extended request to include user
interface AuthRequest extends Request {
    user?: any;
}

// @desc    Get all addresses for logged in user
// @route   GET /api/addresses
// @access  Private
export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const addresses = await Address.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(addresses);
    } catch (error: any) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ message: 'Server error fetching addresses' });
    }
};

// @desc    Create a new address
// @route   POST /api/addresses
// @access  Private
export const createAddress = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { fullName, addressLine1, addressLine2, landmark, city, state, zip, phone, isDefault } = req.body;

        // If setting as default, unset other defaults
        if (isDefault) {
            await Address.updateMany(
                { userId: req.user.userId },
                { $set: { isDefault: false } }
            );
        }

        const address = new Address({
            userId: req.user.userId,
            fullName,
            addressLine1,
            addressLine2,
            landmark,
            city,
            state,
            zip,
            phone,
            isDefault: isDefault || false
        });

        const createdAddress = await address.save();
        res.status(201).json(createdAddress);
    } catch (error: any) {
        console.error('Error creating address:', error);
        res.status(500).json({ message: 'Server error creating address' });
    }
};

// @desc    Update an address
// @route   PUT /api/addresses/:id
// @access  Private
export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { fullName, addressLine1, addressLine2, landmark, city, state, zip, phone, isDefault } = req.body;

        const address = await Address.findOne({ _id: req.params.id, userId: req.user.userId });

        if (!address) {
            res.status(404).json({ message: 'Address not found' });
            return;
        }

        if (isDefault) {
            await Address.updateMany(
                { userId: req.user.userId, _id: { $ne: address._id } },
                { $set: { isDefault: false } }
            );
        }

        address.fullName = fullName || address.fullName;
        address.addressLine1 = addressLine1 || address.addressLine1;
        if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
        if (landmark !== undefined) address.landmark = landmark;
        address.city = city || address.city;
        address.state = state || address.state;
        address.zip = zip || address.zip;
        address.phone = phone || address.phone;
        
        if (isDefault !== undefined) {
            address.isDefault = isDefault;
        }

        const updatedAddress = await address.save();
        res.json(updatedAddress);
    } catch (error: any) {
        console.error('Error updating address:', error);
        res.status(500).json({ message: 'Server error updating address' });
    }
};

// @desc    Delete an address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const address = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });

        if (!address) {
            res.status(404).json({ message: 'Address not found' });
            return;
        }

        res.json({ message: 'Address removed' });
    } catch (error: any) {
        console.error('Error deleting address:', error);
        res.status(500).json({ message: 'Server error deleting address' });
    }
};
