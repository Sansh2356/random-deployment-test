/**
 * Response Helper Utility
 * Standardizes API response format
 */

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export const sendSuccess = (res, data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 * @param {Object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Optional success message
 */
export const sendCreated = (res, data, message = 'Resource created successfully') => {
  sendSuccess(res, data, message, 201);
};

/**
 * Send a no content response (204)
 * @param {Object} res - Express response object
 */
export const sendNoContent = (res) => {
  res.status(204).send();
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info
 */
export const sendPaginated = (res, data, pagination) => {
  res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < pagination.total,
      hasPrev: pagination.page > 1,
    },
  });
};

export default {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
};
