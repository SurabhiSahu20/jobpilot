import { Router } from 'express';
import { getResumeMatch, getInterviewQuestions, getCoverLetter } from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/match', authenticateToken, getResumeMatch);
router.post('/interview-questions', authenticateToken, getInterviewQuestions);
router.post('/cover-letter', authenticateToken, getCoverLetter);

export default router;
