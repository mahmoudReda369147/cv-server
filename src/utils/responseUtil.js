/**
 * Utility function to create a standardized API response
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Message describing the result
 * @param {any} data - Data to be returned (optional)
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Standardized response object
 */
const createResponse = (success, message, data = null, statusCode = 200) => {
  return {
    success,
    message,
    data,
    statusCode
  };
};

/**
 * Send a standardized API response
 * @param {Object} res - Express response object
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Message describing the result
 * @param {any} data - Data to be returned (optional)
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendResponse = (res, success, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success,
    message,
    data
  });
};

module.exports = {
  createResponse,
  sendResponse
};