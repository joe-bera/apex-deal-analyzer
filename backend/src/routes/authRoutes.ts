import { Router } from 'express';
import { signup, login, logout, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Authentication Routes
 */

// Public routes (no authentication required)
router.post('/signup', signup);
router.post('/login', login);

// Protected routes (authentication required)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
