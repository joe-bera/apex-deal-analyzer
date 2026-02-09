import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from './errorHandler';

/**
 * Extend Express Request type to include user data
 */
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: string;
        full_name?: string;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header and attaches user to request
 *
 * Usage:
 *   router.get('/protected', authenticate, handler);
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'No authorization token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError(401, 'Invalid or expired token');
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Use metadata from auth user if profile doesn't exist
      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'analyst',
        full_name: user.user_metadata?.full_name,
      };
      return next();
    }

    // Check if user is active
    if (!profile.is_active) {
      throw new AppError(403, 'Account is deactivated. Please contact support.');
    }

    // Attach user to request
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(401).json({ success: false, error: 'Authentication failed' });
    }
  }
};

/**
 * Role-based authorization middleware
 * Checks if authenticated user has one of the required roles
 *
 * Usage:
 *   router.delete('/property/:id', authenticate, authorize(['admin', 'broker']), handler);
 *
 * @param roles - Array of allowed roles
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // User should be attached by authenticate middleware
      if (!req.user) {
        throw new AppError(401, 'Authentication required');
      }

      // Check if user's role is in allowed roles
      if (!roles.includes(req.user.role)) {
        throw new AppError(
          403,
          `Access denied. Required role: ${roles.join(' or ')}`
        );
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
      } else {
        res.status(403).json({ success: false, error: 'Authorization failed' });
      }
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is present, but doesn't require it
 *
 * Usage:
 *   router.get('/properties', optionalAuth, handler);
 *   // In handler: if (req.user) { ... } else { ... }
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // If no token, set anonymous user and continue
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = { id: 'anonymous', email: 'guest@apex.app', role: 'analyst' };
      return next();
    }

    const token = authHeader.substring(7);

    // Try to verify token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Invalid token — set anonymous user and continue
      req.user = { id: 'anonymous', email: 'guest@apex.app', role: 'analyst' };
      return next();
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', user.id)
      .single();

    if (profile && profile.is_active) {
      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
      };
    } else {
      req.user = { id: 'anonymous', email: 'guest@apex.app', role: 'analyst' };
    }

    next();
  } catch (_error) {
    // If anything fails, set anonymous user and continue
    req.user = { id: 'anonymous', email: 'guest@apex.app', role: 'analyst' };
    next();
  }
};
