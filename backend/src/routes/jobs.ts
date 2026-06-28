import { Router } from 'express';
import { getJobs, createJob, updateJobStatus, deleteJob, searchJobs } from '../controllers/jobsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, getJobs);
router.post('/', authenticateToken, createJob);
router.post('/search', authenticateToken, searchJobs);
router.put('/:id', authenticateToken, updateJobStatus);
router.delete('/:id', authenticateToken, deleteJob);

export default router;
