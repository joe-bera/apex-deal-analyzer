import { Router } from 'express';
import { signup, login, logout, getCurrentUser, updateProfile, getLogoUploadUrl, updateProfileLogo } from '../controllers/authController';
import { optionalAuth } from '../middleware/auth';
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
router.post('/logout', optionalAuth, logout);
router.get('/me', optionalAuth, getCurrentUser);

// Profile / Company branding routes
router.patch('/profile', optionalAuth, updateProfile);
router.post('/profile/logo-upload-url', optionalAuth, getLogoUploadUrl);
router.patch('/profile/logo', optionalAuth, updateProfileLogo);

export default router;
