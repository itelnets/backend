import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth';
import {
    submitDoctorRequest,
    getDoctorStatus,
    getAllDoctorRequests,
    approveDoctorRequest,
    rejectDoctorRequest,
} from '../controllers/doctorController';

const router = Router();

// Customer Doctor Routes
router.post('/request', authenticate, submitDoctorRequest);
router.get('/status', authenticate, getDoctorStatus);

// Admin Doctor Routes
router.get('/admin/requests', authenticate, isAdmin, getAllDoctorRequests);
router.put('/admin/approve/:id', authenticate, isAdmin, approveDoctorRequest);
router.put('/admin/reject/:id', authenticate, isAdmin, rejectDoctorRequest);

export default router;
