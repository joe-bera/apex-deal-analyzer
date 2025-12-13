import { Router } from 'express';
import { signup, login, logout, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate, signupSchema, loginSchema } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * Authentication Routes
 */

// Public routes (no authentication required)
// Rate limited to prevent brute force attacks
router.post('/signup', authLimiter, validate(signupSchema, 'body'), signup);
router.post('/login', authLimiter, validate(loginSchema, 'body'), login);

// Protected routes (authentication required)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
