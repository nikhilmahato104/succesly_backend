import { Router }     from 'express';
import studentRoutes  from './student';
import marksRoutes    from './marks';
import moduleRoutes   from './module';
import roleRoutes     from './role';
import userRoutes     from './user';
import authRoutes     from './auth';
import apiKeyRoutes   from './api-key';
import bookingRoutes  from './booking/booking.routes';
import boardRoutes    from './board/board.routes';

const router = Router();

router.use('/students',  studentRoutes);
router.use('/marks',     marksRoutes);
router.use('/modules',   moduleRoutes);
router.use('/roles',     roleRoutes);
router.use('/users',     userRoutes);
router.use('/auth',      authRoutes);
router.use('/api-keys',  apiKeyRoutes);
router.use('/bookings',  bookingRoutes);
router.use('/boards',    boardRoutes);

export default router;
