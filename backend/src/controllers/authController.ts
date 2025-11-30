import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * Sign up a new user
 * POST /api/auth/signup
 *
 * Body: { email, password, full_name, role? }
 */
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, full_name, role = 'analyst' } = req.body;

    // Validate required fields
    if (!email || !password || !full_name) {
      throw new AppError(400, 'Email, password, and full name are required');
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters long');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(400, 'Invalid email format');
    }

    // Validate role
    const validRoles = ['admin', 'broker', 'analyst', 'investor'];
    if (!validRoles.includes(role)) {
      throw new AppError(400, `Role must be one of: ${validRoles.join(', ')}`);
    }

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role,
        },
      },
    });

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data.user) {
      throw new AppError(500, 'User creation failed');
    }

    // Return success
    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email for verification.',
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name,
        role,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Log in an existing user
 * POST /api/auth/login
 *
 * Body: { email, password }
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new AppError(400, 'Email and password are required');
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AppError(401, 'Invalid email or password');
    }

    if (!data.user || !data.session) {
      throw new AppError(401, 'Authentication failed');
    }

    // Fetch user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      // Profile might not exist yet, use basic user data
      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name,
          role: data.user.user_metadata?.role || 'analyst',
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      });
      return;
    }

    // Return user data with profile
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        organization: profile.organization,
        phone_number: profile.phone_number,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Log out current user
 * POST /api/auth/logout
 *
 * Requires: Authorization header with Bearer token
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'No authorization token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Sign out using Supabase Auth
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      throw new AppError(500, 'Logout failed');
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 *
 * Requires: Authorization header with Bearer token
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'No authorization token provided');
    }

    const token = authHeader.substring(7);

    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError(401, 'Invalid or expired token');
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Return basic user data if profile doesn't exist
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name,
          role: user.user_metadata?.role || 'analyst',
        },
      });
      return;
    }

    // Return full profile data
    res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        organization: profile.organization,
        phone_number: profile.phone_number,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active,
        created_at: profile.created_at,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
