import { Router } from 'express';
import multer from 'multer';
import { register, login, getProfile, updateResume, uploadResumeFile } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateToken, getProfile);
router.put('/resume', authenticateToken, updateResume);
router.post('/resume-upload', authenticateToken, upload.single('resume'), uploadResumeFile);

export default router;
