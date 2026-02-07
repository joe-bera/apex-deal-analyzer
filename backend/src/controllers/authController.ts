import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
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
        company_name: profile.company_name,
        company_logo_url: profile.company_logo_url,
        company_phone: profile.company_phone,
        company_email: profile.company_email,
        company_address: profile.company_address,
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
        company_name: profile.company_name,
        company_logo_url: profile.company_logo_url,
        company_phone: profile.company_phone,
        company_email: profile.company_email,
        company_address: profile.company_address,
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
 * Update user profile (company branding fields)
 * PATCH /api/auth/profile
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { company_name, company_phone, company_email, company_address } = req.body;

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_name: company_name ?? null,
        company_phone: company_phone ?? null,
        company_email: company_email ?? null,
        company_address: company_address ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError || !profile) {
      console.error('Profile update error:', updateError);
      throw new AppError(500, 'Failed to update profile');
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        company_name: profile.company_name,
        company_logo_url: profile.company_logo_url,
        company_phone: profile.company_phone,
        company_email: profile.company_email,
        company_address: profile.company_address,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get a signed upload URL for company logo
 * POST /api/auth/profile/logo-upload-url
 */
export const getLogoUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { file_name, file_size } = req.body;

    if (!file_name) {
      throw new AppError(400, 'file_name is required');
    }

    // Max 5MB for logos
    if (file_size && file_size > 5 * 1024 * 1024) {
      throw new AppError(400, 'Logo file must be under 5MB');
    }

    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `logos/${req.user.id}/${Date.now()}-${sanitizedFileName}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('property-photos')
      .createSignedUploadUrl(storagePath);

    if (uploadError || !uploadData) {
      console.error('Failed to create logo upload URL:', uploadError);
      throw new AppError(500, 'Failed to create upload URL');
    }

    res.status(200).json({
      success: true,
      upload_url: uploadData.signedUrl,
      storage_path: storagePath,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Get logo upload URL error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Update profile logo after upload
 * PATCH /api/auth/profile/logo
 */
export const updateProfileLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { storage_path } = req.body;

    if (!storage_path) {
      throw new AppError(400, 'storage_path is required');
    }

    // Build public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('property-photos')
      .getPublicUrl(storage_path);

    const company_logo_url = urlData.publicUrl;

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_logo_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError || !profile) {
      console.error('Profile logo update error:', updateError);
      throw new AppError(500, 'Failed to update profile logo');
    }

    res.status(200).json({
      success: true,
      message: 'Logo updated successfully',
      company_logo_url,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Update profile logo error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
