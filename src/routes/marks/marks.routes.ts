import { Router } from 'express';
import { authMiddleware, csrfMiddleware, apiKeyMiddleware } from '../../middlewares';
import {
  getAllMarks,
  getMarksById,
  getMarksByStudentId,
  createMarks,
  updateMarks,
  deleteMarks,
} from '../../controllers/marks.controller';

const router = Router();

router.use(authMiddleware, csrfMiddleware, apiKeyMiddleware);

router.get('/',                   getAllMarks);
router.get('/student/:studentId', getMarksByStudentId);  // Must be before /:id
router.get('/:id',                getMarksById);
router.post('/',                  createMarks);
router.patch('/:id',              updateMarks);
router.delete('/:id',             deleteMarks);

export default router;
