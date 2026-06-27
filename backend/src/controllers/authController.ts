import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';
import { parseResume } from '../services/resumeParser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'jobpilot_super_secret_jwt_key_2026';
const SALT_ROUNDS = 10;

// Register user
export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Insert user into DB
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase().trim(), passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error: any) {
    if (error.message && error.message.includes('duplicate key') || error.message?.includes('unique constraint')) {
      return res.status(409).json({ error: 'Email is already registered' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await query(
      'SELECT id, email, password_hash, resume_text FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, hasResume: !!user.resume_text }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

// Get User Profile (includes Resume)
export const getProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query('SELECT resume_text FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      email: req.user?.email,
      resume_text: result.rows[0].resume_text || ''
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
};

// Update User Resume
export const updateResume = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { resume_text } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (resume_text === undefined) {
    return res.status(400).json({ error: 'Resume text is required' });
  }

  try {
    const result = await query(
      'UPDATE users SET resume_text = $1 WHERE id = $2 RETURNING id, resume_text',
      [resume_text, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      message: 'Resume updated successfully',
      resume_text: result.rows[0].resume_text
    });
  } catch (error) {
    console.error('Update resume error:', error);
    return res.status(500).json({ error: 'Failed to update resume' });
  }
};

// Upload & Parse PDF/DOCX Resume
export const uploadResumeFile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No resume file uploaded.' });
  }

  try {
    const resumeText = await parseResume(req.file.buffer, req.file.mimetype);

    // Save extracted text to database
    const result = await query(
      'UPDATE users SET resume_text = $1 WHERE id = $2 RETURNING id, resume_text',
      [resumeText, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      message: 'Resume file parsed and updated successfully',
      resume_text: result.rows[0].resume_text
    });
  } catch (error: any) {
    console.error('Resume upload/parsing error:', error);
    return res.status(500).json({ error: error.message || 'Failed to parse and upload resume.' });
  }
};
