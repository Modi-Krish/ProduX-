/**
 * Validation Middleware Factory
 *
 * Validates that required fields are present and non-empty in req.body.
 * Optionally validates field types and lengths.
 *
 * Usage:
 *   router.post('/route', validate(['title', 'deadline']), controller);
 *
 * Extended Usage (with rules):
 *   validate([
 *     { field: 'title', maxLength: 200 },
 *     { field: 'email', type: 'email' },
 *   ])
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (fields) => {
  return (req, res, next) => {
    const missing = [];
    const errors = [];

    for (const fieldDef of fields) {
      // Support both simple strings and rule objects
      const field = typeof fieldDef === 'string' ? fieldDef : fieldDef.field;
      const rules = typeof fieldDef === 'object' ? fieldDef : {};

      const value = req.body[field];

      // Check presence and non-empty
      if (value === undefined || value === null || String(value).trim() === '') {
        missing.push(field);
        continue;
      }

      // Type validation
      if (rules.type === 'email') {
        if (!EMAIL_REGEX.test(String(value))) {
          errors.push(`'${field}' must be a valid email address`);
        }
      }

      if (rules.type === 'number') {
        if (isNaN(Number(value))) {
          errors.push(`'${field}' must be a number`);
        }
      }

      // Length validation
      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors.push(`'${field}' must not exceed ${rules.maxLength} characters`);
      }

      if (rules.minLength && String(value).length < rules.minLength) {
        errors.push(`'${field}' must be at least ${rules.minLength} characters`);
      }

      // Allowed values validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`'${field}' must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join('; '),
      });
    }

    next();
  };
};

module.exports = { validate };
