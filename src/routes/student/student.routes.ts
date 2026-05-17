import { Router } from 'express';
import { authMiddleware, csrfMiddleware, apiKeyMiddleware } from '../../middlewares';
import {
  getAllStudents,
  getGradeSummary,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../../controllers/student.controller';

const router = Router();

router.use(authMiddleware, csrfMiddleware, apiKeyMiddleware);

router.get('/',               getAllStudents);
router.get('/summary/grades', getGradeSummary);  // Must be before /:id
router.get('/:id',            getStudentById);
router.post('/',              createStudent);
router.patch('/:id',          updateStudent);
router.delete('/:id',         deleteStudent);

export default router;
