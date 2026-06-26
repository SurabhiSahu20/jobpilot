import { Response } from 'express';
import { query } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';

// Get all jobs for the current user
export const getJobs = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve job applications' });
  }
};

// Create a new job tracker entry
export const createJob = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const {
    company,
    role,
    location,
    salary,
    experience,
    skills,
    description,
    apply_link,
    status,
    notes
  } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!company || !role) {
    return res.status(400).json({ error: 'Company and Role are required fields' });
  }

  try {
    const skillsArray = Array.isArray(skills) ? skills : [];

    const result = await query(
      `INSERT INTO jobs (
        user_id, company, role, location, salary, experience, skills, description, apply_link, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        userId,
        company,
        role,
        location || '',
        salary || '',
        experience || '',
        skillsArray,
        description || '',
        apply_link || '',
        status || 'Wishlist',
        notes || ''
      ]
    );

    return res.status(201).json({
      message: 'Job tracker created successfully',
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Create job error:', error);
    return res.status(500).json({ error: 'Failed to create job application tracker' });
  }
};

// Update job application status or notes
export const updateJobStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const jobId = req.params.id;
  const { status, notes } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!status) {
    return res.status(400).json({ error: 'Status is required to update' });
  }

  const validStatuses = ['Wishlist', 'Applied', 'OA', 'Interview', 'Offer', 'Rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid application status value' });
  }

  try {
    const result = await query(
      'UPDATE jobs SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
      [status, notes !== undefined ? notes : null, jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job application not found or unauthorized' });
    }

    return res.json({
      message: 'Job application updated successfully',
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Update job status error:', error);
    return res.status(500).json({ error: 'Failed to update job application' });
  }
};

// Delete job application tracker
export const deleteJob = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const jobId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query(
      'DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING *',
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job application not found or unauthorized' });
    }

    return res.json({
      message: 'Job application deleted successfully',
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Delete job error:', error);
    return res.status(500).json({ error: 'Failed to delete job application' });
  }
};
