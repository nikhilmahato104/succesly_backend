import { Router } from 'express';
import {
  getAllBoards,
  getBoardById,
  createBoard,
  updateBoard,
  saveBoard,
  deleteBoard,
  duplicateBoard,
  getBoardHistory,
  getBoardVersion,
  restoreBoardVersion,
} from '../../controllers/board.controller';

const router = Router();

router.get('/',                              getAllBoards);
router.post('/',                             createBoard);
router.get('/:id',                           getBoardById);
router.patch('/:id',                         updateBoard);
router.put('/:id/save',                      saveBoard);
router.delete('/:id',                        deleteBoard);
router.post('/:id/duplicate',                duplicateBoard);
router.get('/:id/history',                   getBoardHistory);
router.get('/:id/history/:version',          getBoardVersion);
router.post('/:id/history/:version/restore', restoreBoardVersion);

export default router;
