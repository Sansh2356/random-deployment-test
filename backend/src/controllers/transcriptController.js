/**
 * Transcripts Controller
 * Handles all transcript-related API endpoints
 */

import * as supabaseService from '../services/supabaseService.js';
import { transformToConferences } from '../utils/dataProcessor.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

/**
 * Get all conferences (grouped transcripts)
 * GET /api/v1/transcripts/conferences
 */
export const getConferences = async (req, res) => {
  logger.info('Controller: Getting all conferences');

  const transcripts = await supabaseService.fetchAllTranscripts();

  if (!transcripts || transcripts.length === 0) {
    logger.warn('No transcripts found in database');
    return sendSuccess(res, [], 'No transcripts found');
  }

  const conferences = transformToConferences(transcripts);

  sendSuccess(res, conferences, `Found ${conferences.length} conferences`);
};

/**
 * Get all raw transcripts
 * GET /api/v1/transcripts
 */
export const getAllTranscripts = async (req, res) => {
  logger.info('Controller: Getting all transcripts');

  const transcripts = await supabaseService.fetchAllTranscripts();

  sendSuccess(res, transcripts, `Found ${transcripts.length} transcripts`);
};

/**
 * Get a single transcript by ID
 * GET /api/v1/transcripts/:id
 */
export const getTranscriptById = async (req, res) => {
  const { id } = req.params;

  logger.info(`Controller: Getting transcript by ID: ${id}`);

  const transcript = await supabaseService.fetchTranscriptById(id);

  if (!transcript) {
    throw new APIError(`Transcript not found with ID: ${id}`, 404, 'NOT_FOUND');
  }

  sendSuccess(res, transcript);
};

/**
 * Search transcripts
 * GET /api/v1/transcripts/search?q=query
 */
export const searchTranscripts = async (req, res) => {
  const { q } = req.query;

  logger.info(`Controller: Searching transcripts for: "${q}"`);

  const results = await supabaseService.searchTranscripts(q);

  // Transform to conferences format for consistency
  const conferences = transformToConferences(results);

  sendSuccess(res, conferences, `Found ${results.length} matching transcripts`);
};

export default {
  getConferences,
  getAllTranscripts,
  getTranscriptById,
  searchTranscripts,
};
