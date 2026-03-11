/**
 * Health Routes
 * Defines health check endpoints
 */

import { Router } from 'express';
import * as healthController from '../controllers/healthController.js';
import { asyncHandler } from '../middleware/index.js';

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Basic health check
 * @access  Public
 */
router.get('/', healthController.healthCheck);

/**
 * @route   GET /api/v1/health/detailed
 * @desc    Detailed health check with service status
 * @access  Public
 */
router.get('/detailed', asyncHandler(healthController.detailedHealthCheck));

export default router;
