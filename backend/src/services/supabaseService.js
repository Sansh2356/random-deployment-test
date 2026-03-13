/**
 * Supabase Service
 * Handles all database operations with Supabase
 */

import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from '../config/logger.js';

// Create Supabase client
let supabase = null;

/**
 * Initialize Supabase client
 * @returns {Object} Supabase client instance
 */
const getSupabaseClient = () => {
  if (!supabase) {
    if (!config.supabase.url || !config.supabase.anonKey) {
      logger.error('Supabase configuration is missing. Please check your .env file.');
      throw new Error('Supabase configuration is missing');
    }

    supabase = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        persistSession: false, // Server-side, no session persistence needed
      },
    });

    logger.info('Supabase client initialized successfully');
  }

  return supabase;
};

/**
 * Wrap Supabase operations with timeout
 * @param {Promise} promise - Supabase operation promise
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Wrapped promise with timeout
 */
const withTimeout = (promise, timeoutMs = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database operation timed out')), timeoutMs)
    ),
  ]);
};

/**
 * Fetch all transcripts from the database
 * @returns {Promise<Array>} Array of transcript records
 */
export const fetchAllTranscripts = async () => {
  const client = getSupabaseClient();

  logger.info('Fetching all transcripts from Supabase...');

  const { data, error } = await withTimeout(
    client
      .from('transcripts')
      .select('*')
      .order('event_date', { ascending: false })
  );

  if (error) {
    logger.error('Supabase fetch error:', { error: error.message, details: error.details });
    throw new Error(`Database error: ${error.message}`);
  }

  logger.info(`Successfully fetched ${data?.length || 0} transcripts`);
  return data || [];
};

/**
 * Fetch a single transcript by ID
 * @param {string} id - Transcript ID
 * @returns {Promise<Object|null>} Transcript record or null
 */
export const fetchTranscriptById = async (id) => {
  const client = getSupabaseClient();

  logger.info(`Fetching transcript with ID: ${id}`);

  const { data, error } = await withTimeout(
    client
      .from('transcripts')
      .select('*')
      .eq('id', id)
      .single()
  );

  if (error) {
    if (error.code === 'PGRST116') {
      logger.warn(`Transcript not found: ${id}`);
      return null;
    }
    logger.error('Supabase fetch error:', { error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
};

/**
 * Search transcripts using PostgreSQL Full-Text Search via Supabase RPC.
 * Returns ranked results with highlighted snippets.
 * @param {string} query - Search query
 * @param {number} limit - Max results per page
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of matching transcript search results
 */
export const searchTranscripts = async (query, limit = 20, offset = 0) => {
  const client = getSupabaseClient();

  // Sanitize: strip characters that could interfere with tsquery parsing.
  // plainto_tsquery on the DB side already handles safe conversion, but we
  // still trim and cap length on the application side.
  const sanitizedQuery = query
    .replace(/[<>"'`;(){}[\]\\]/g, '')
    .trim()
    .substring(0, 200);

  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    logger.warn('Search query too short or invalid after sanitization');
    return { results: [], total: 0 };
  }

  logger.info(`FTS searching transcripts for: "${sanitizedQuery}" (limit=${limit}, offset=${offset})`);

  // Run both RPC calls in parallel for speed.
  const [searchResult, countResult] = await Promise.all([
    withTimeout(
      client.rpc('search_transcripts_fts', {
        search_query: sanitizedQuery,
        result_limit: limit,
        result_offset: offset,
      })
    ),
    withTimeout(
      client.rpc('search_transcripts_fts_count', {
        search_query: sanitizedQuery,
      })
    ),
  ]);

  if (searchResult.error) {
    logger.error('Supabase FTS search error:', { error: searchResult.error.message });
    throw new Error(`Search error: ${searchResult.error.message}`);
  }

  if (countResult.error) {
    logger.warn('Supabase FTS count error (non-fatal):', { error: countResult.error.message });
  }

  const results = searchResult.data || [];
  const total = countResult.data ?? results.length;

  logger.info(`FTS search returned ${results.length} results (total: ${total})`);
  return { results, total };
};

/**
 * Get cached AI content (summary, etc.) for a transcript
 * @param {string} transcriptId - Transcript ID
 * @param {string} type - Content type (summary, timeline, etc.)
 * @returns {Promise<string|null>} Cached content or null
 */
export const getCachedAIContent = async (transcriptId, type) => {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('ai_cache')
    .select('content')
    .eq('transcript_id', transcriptId)
    .eq('type', type)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.warn('Cache lookup error:', { error: error.message });
  }

  return data?.content || null;
};

/**
 * Store AI content in cache
 * @param {string} transcriptId - Transcript ID
 * @param {string} type - Content type
 * @param {string} content - Content to cache
 */
export const cacheAIContent = async (transcriptId, type, content) => {
  const client = getSupabaseClient();

  const { error } = await client
    .from('ai_cache')
    .upsert({
      transcript_id: transcriptId,
      type,
      content,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'transcript_id,type',
    });

  if (error) {
    logger.warn('Cache store error:', { error: error.message });
    // Don't throw - caching failure shouldn't break the main flow
  } else {
    logger.debug(`Cached ${type} for transcript ${transcriptId}`);
  }
};

/**
 * Health check for Supabase connection
 * @returns {Promise<boolean>} True if connection is healthy
 */
export const healthCheck = async () => {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('transcripts').select('id').limit(1);
    return !error;
  } catch (err) {
    logger.error('Supabase health check failed:', { error: err.message });
    return false;
  }
};

export default {
  fetchAllTranscripts,
  fetchTranscriptById,
  searchTranscripts,
  getCachedAIContent,
  cacheAIContent,
  healthCheck,
};
