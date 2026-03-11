/**
 * AI Routes
 * Defines all AI-related API endpoints
 */

import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import {
  asyncHandler,
  validate,
  validationRules,
  aiLimiter,
  ttsLimiter,
} from '../middleware/index.js';

const router = Router();

/**
 * @route   POST /api/v1/ai/summary
 * @desc    Generate summary for a transcript
 * @access  Public (rate limited)
 */
router.post(
  '/summary',
  aiLimiter,
  validationRules.generateSummary,
  validate,
  asyncHandler(aiController.generateSummary)
);

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Chat with transcript context
 * @access  Public (rate limited)
 */
router.post(
  '/chat',
  aiLimiter,
  validationRules.chat,
  validate,
  asyncHandler(aiController.chat)
);

/**
 * @route   POST /api/v1/ai/tts
 * @desc    Generate speech from text
 * @access  Public (strictly rate limited)
 */
router.post(
  '/tts',
  ttsLimiter,
  validationRules.tts,
  validate,
  asyncHandler(aiController.generateSpeech)
);

/**
 * @route   POST /api/v1/ai/entities
 * @desc    Extract entities from transcript
 * @access  Public (rate limited)
 */
router.post(
  '/entities',
  aiLimiter,
  validationRules.generateSummary, // Same validation as summary
  validate,
  asyncHandler(aiController.extractEntities)
);

export default router;
