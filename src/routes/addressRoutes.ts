import express from 'express';
import { getAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/addressController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.route('/')
    .get(authenticate, getAddresses)
    .post(authenticate, createAddress);

router.route('/:id')
    .put(authenticate, updateAddress)
    .delete(authenticate, deleteAddress);

export default router;
