import express from 'express';
import { login, logout, updateUserPayment, deductUserCredit } from '../controller/auth.controller.js';

const router = express.Router();

// login aur logout endpoints mapping definitions
router.post('/login', login);
router.post('/logout', logout);
router.post('/update-payment', updateUserPayment);
router.post('/deduct-credit', deductUserCredit);

export default router;
