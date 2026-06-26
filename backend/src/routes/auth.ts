import { Router } from 'express';
import { register, login, getProfile, updateResume } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateToken, getProfile);
router.put('/resume', authenticateToken, updateResume);

export default router;
