/**
 * Validation middleware factory
 * Validates that required fields are present in req.body
 */
const validate = (requiredFields) => {
  return (req, res, next) => {
    const missing = [];
    for (const field of requiredFields) {
      if (!req.body[field] || String(req.body[field]).trim() === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = { validate };
