import { Router }            from 'express';
import { authMiddleware }    from '../../middlewares/auth.middleware';
import { csrfMiddleware }    from '../../middlewares/csrf.middleware';
import { apiKeyMiddleware }  from '../../middlewares/api-key.middleware';
import {
  getIndustryTypes,
  checkSlug,
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignAnalytics,
  getOverviewAnalytics,
  getCampaignClicks,
} from '../../controllers/campaign.controller';

const router = Router();

// Static paths first — otherwise '/:id' would swallow them

// GET /campaigns/industry-types        → JWT (dropdown options)
router.get('/industry-types',        authMiddleware,                                  getIndustryTypes);

// GET /campaigns/check-slug?slug=abc   → JWT + API key (live "is this name free?" check)
router.get('/check-slug',            authMiddleware, apiKeyMiddleware,                checkSlug);

// GET /campaigns/analytics/overview    → JWT + API key (cross-campaign / industry analytics)
router.get('/analytics/overview',    authMiddleware, apiKeyMiddleware,                getOverviewAnalytics);

// GET  /campaigns                      → JWT + API key
router.get('/',                      authMiddleware, apiKeyMiddleware,                getAllCampaigns);

// POST /campaigns                      → JWT + CSRF + API key
router.post('/',                     authMiddleware, csrfMiddleware, apiKeyMiddleware, createCampaign);

// GET  /campaigns/:id/analytics        → JWT + API key
router.get('/:id/analytics',         authMiddleware, apiKeyMiddleware,                getCampaignAnalytics);

// GET  /campaigns/:id/clicks           → JWT + API key (raw click log)
router.get('/:id/clicks',            authMiddleware, apiKeyMiddleware,                getCampaignClicks);

// GET  /campaigns/:id                  → JWT + API key
router.get('/:id',                   authMiddleware, apiKeyMiddleware,                getCampaignById);

// PATCH /campaigns/:id                 → JWT + CSRF + API key
router.patch('/:id',                 authMiddleware, csrfMiddleware, apiKeyMiddleware, updateCampaign);

// DELETE /campaigns/:id                → JWT + CSRF + API key (soft delete / archive)
router.delete('/:id',                authMiddleware, csrfMiddleware, apiKeyMiddleware, deleteCampaign);

export default router;
