import { Request, Response } from 'express';
import DoctorRequest from '../models/DoctorRequest';
import User from '../models/User';
import { sendDoctorApprovalEmail, sendDoctorRejectionEmail } from '../utils/emailOtp';

// Submit or Update Doctor Request
export const submitDoctorRequest = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { name, email, mobileNumber, registrationNumber, specialization, hospitalClinic, documentUrl } = req.body;

        if (!name || !email || !mobileNumber || !registrationNumber || !specialization) {
            return res.status(400).json({ message: 'All required fields must be provided' });
        }

        // 1. Check if there is an active pending request
        const pendingRequest = await DoctorRequest.findOne({ userId, status: 'pending' });
        if (pendingRequest) {
            return res.status(400).json({
                message: 'You already have a pending verification request.',
                doctorRequest: pendingRequest
            });
        }

        // 2. Check if doctor verification is already approved
        const approvedRequest = await DoctorRequest.findOne({ userId, status: 'approved' });
        if (approvedRequest) {
            return res.status(400).json({
                message: 'Your doctor verification is already approved.',
                doctorRequest: approvedRequest
            });
        }

        // 3. Create a brand new distinct doctor request entry in DB (e.g. 2nd request)
        const doctorRequest = new DoctorRequest({
            userId,
            name,
            email,
            mobileNumber,
            registrationNumber,
            specialization,
            hospitalClinic: hospitalClinic || '',
            documentUrl: documentUrl || '',
            status: 'pending'
        });

        await doctorRequest.save();

        return res.status(201).json({
            message: 'Doctor verification sent',
            doctorRequest
        });
    } catch (error: any) {
        console.error('Error submitting doctor request:', error);
        return res.status(500).json({ message: 'Server error while submitting request', error: error.message });
    }
};

// Get Doctor Request Status for Logged-In User
export const getDoctorStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const doctorRequest = await DoctorRequest.findOne({ userId }).sort({ createdAt: -1 });
        return res.json({ doctorRequest });
    } catch (error: any) {
        console.error('Error fetching doctor status:', error);
        return res.status(500).json({ message: 'Server error while fetching status', error: error.message });
    }
};

// Admin: Get All Doctor Requests
export const getAllDoctorRequests = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        const query: any = {};
        if (status && ['pending', 'approved', 'rejected'].includes(String(status))) {
            query.status = status;
        }

        const requests = await DoctorRequest.find(query).sort({ createdAt: -1 });
        return res.json({ doctorRequests: requests });
    } catch (error: any) {
        console.error('Error fetching doctor requests:', error);
        return res.status(500).json({ message: 'Server error fetching requests', error: error.message });
    }
};

// Admin: Approve Doctor Request
export const approveDoctorRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { promoCode, discountDetails, adminNotes } = req.body;

        const doctorRequest = await DoctorRequest.findById(id);
        if (!doctorRequest) {
            return res.status(404).json({ message: 'Doctor request not found' });
        }

        const rawDiscount = parseInt(discountDetails) || 25;
        const discountPercent = Math.min(Math.max(rawDiscount, 1), 99);
        const offerText = `${discountPercent}% OFF on all prescription & healthcare products`;

        const generate8CharPromoCode = (): string => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        const finalPromoCode = (promoCode && typeof promoCode === 'string' && promoCode.trim().length === 8)
            ? promoCode.trim().toUpperCase()
            : generate8CharPromoCode();

        doctorRequest.status = 'approved';
        doctorRequest.promoCode = finalPromoCode;
        doctorRequest.discountDetails = offerText;
        doctorRequest.discountPercent = discountPercent;
        if (adminNotes !== undefined) doctorRequest.adminNotes = adminNotes;
        doctorRequest.approvedAt = new Date();

        await doctorRequest.save();

        // Sync fields to User table
        await User.findByIdAndUpdate(doctorRequest.userId, {
            isDoctorVerified: true,
            doctorPromoCode: doctorRequest.promoCode,
            doctorDiscountDetails: offerText,
            doctorDiscountPercent: discountPercent,
        });

        // Send approval email (async in background)
        sendDoctorApprovalEmail(
            doctorRequest.email,
            doctorRequest.name,
            doctorRequest.promoCode || '',
            offerText
        ).catch(err => console.error('Failed sending approval email:', err));

        return res.json({
            message: 'Doctor request approved successfully',
            doctorRequest
        });
    } catch (error: any) {
        console.error('Error approving doctor request:', error);
        return res.status(500).json({ message: 'Server error approving request', error: error.message });
    }
};

// Admin: Reject Doctor Request
export const rejectDoctorRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const doctorRequest = await DoctorRequest.findById(id);
        if (!doctorRequest) {
            return res.status(404).json({ message: 'Doctor request not found' });
        }

        doctorRequest.status = 'rejected';
        if (adminNotes !== undefined) doctorRequest.adminNotes = adminNotes;
        doctorRequest.rejectedAt = new Date();

        await doctorRequest.save();

        // Sync fields to User table
        await User.findByIdAndUpdate(doctorRequest.userId, {
            isDoctorVerified: false,
            doctorPromoCode: null,
            doctorDiscountDetails: null,
        });

        // Send rejection email (async in background)
        sendDoctorRejectionEmail(
            doctorRequest.email,
            doctorRequest.name,
            doctorRequest.adminNotes
        ).catch(err => console.error('Failed sending rejection email:', err));

        return res.json({
            message: 'Doctor request rejected',
            doctorRequest
        });
    } catch (error: any) {
        console.error('Error rejecting doctor request:', error);
        return res.status(500).json({ message: 'Server error rejecting request', error: error.message });
    }
};
