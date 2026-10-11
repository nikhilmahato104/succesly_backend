import { Router }     from 'express';
import moduleRoutes   from './module';
import roleRoutes     from './role';
import userRoutes     from './user';
import authRoutes     from './auth';
import apiKeyRoutes   from './api-key';
import projectRoutes      from './project/project.routes';
import activityLogRoutes  from './activity-log/activity-log.routes';
import deviceInfoRoutes   from './device-info/device-info.routes';

const router = Router();

router.use('/modules',   moduleRoutes);
router.use('/roles',     roleRoutes);
router.use('/users',     userRoutes);
router.use('/auth',      authRoutes);
router.use('/api-keys',  apiKeyRoutes);
router.use('/projects',       projectRoutes);
router.use('/activity-logs',  activityLogRoutes);
router.use('/device-info',    deviceInfoRoutes);

export default router;
