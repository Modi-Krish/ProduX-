/**
 * AI Controller — Gemini-powered features
 *
 * FIX (SEC-10): User-controlled inputs (title, description, currentUrl, pageTitle)
 * are now sanitized and length-limited before being injected into AI prompts.
 * This prevents prompt injection attacks where a user could craft task titles
 * to manipulate Gemini's output (e.g., "Ignore previous instructions...").
 *
 * FIX (EXT-1): The /api/ai/coach endpoint now requires authentication.
 * The extension must send a valid Bearer token with each request.
 */

const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Sanitization Helpers ──────────────────────────────────

/**
 * Remove potentially injection-harmful patterns from user-supplied strings.
 * Strips control characters, excessive whitespace, and limits length.
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, maxLength = 500) {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x1F\x7F]/g, ' ')  // Strip control characters
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize a URL string — keep only the hostname and path, remove query/fragment.
 * @param {string} url - Raw URL string
 * @returns {string} Sanitized URL or 'unknown'
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return 'unknown';
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname.substring(0, 60)}`;
  } catch {
    return 'unknown';
  }
}

// ── Controllers ───────────────────────────────────────────

/**
 * @desc    Generate AI-powered subtask breakdown from a task title/description
 * @route   POST /api/ai/breakdown
 * @access  Private
 */
const generateSubtasks = async (req, res, next) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required for AI breakdown',
      });
    }

    // FIX (SEC-10): Sanitize user inputs before injection into AI prompt
    const safeTitle = sanitizeInput(title, 200);
    const safeDescription = sanitizeInput(description, 500);

    if (!safeTitle) {
      return res.status(400).json({
        success: false,
        message: 'Task title contains invalid characters',
      });
    }

    const prompt = `You are a helpful productivity assistant. Break down the following task into 3-7 specific, actionable subtasks.

Task Title: ${safeTitle}
${safeDescription ? `Task Description: ${safeDescription}` : ''}

Respond with a JSON array of subtask title strings only. No explanations. No markdown. Only valid JSON.
Example: ["Research the topic", "Create an outline", "Write the first draft"]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const raw = response.text || '';

    // Parse JSON safely
    let subtasks = [];
    try {
      // Strip markdown code fences if Gemini returns them
      const cleaned = raw.replace(/```json?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        subtasks = parsed
          .filter((s) => typeof s === 'string' && s.trim())
          .map((s) => s.trim().substring(0, 200))
          .slice(0, 10); // Cap at 10 subtasks
      }
    } catch (parseError) {
      logger.warn('AI subtask response parse failed', {
        userId: req.user._id,
        raw: raw.substring(0, 200),
      });
      subtasks = [];
    }

    res.status(200).json({
      success: true,
      data: subtasks,
    });
  } catch (error) {
    logger.error('AI breakdown error', {
      userId: req.user._id,
      error: error.message,
    });
    next(error);
  }
};

/**
 * @desc    Generate AI-powered focus coaching warning
 * @route   POST /api/ai/coach
 * @access  Private (requires Firebase ID Token)
 *
 * FIX (EXT-1 / SEC-16): This endpoint now requires authentication.
 * The protect middleware is applied in aiRoutes.js, so this handler
 * can trust that req.user is populated.
 *
 * The Chrome extension MUST include a valid Bearer token header:
 *   Authorization: Bearer <firebase_id_token>
 */
const generateFocusWarning = async (req, res, next) => {
  try {
    const { intendedFocus, currentUrl, pageTitle } = req.body;

    if (!intendedFocus) {
      return res.status(400).json({
        success: false,
        message: 'intendedFocus is required',
      });
    }

    // FIX (SEC-10): Sanitize all inputs — currentUrl and pageTitle come from
    // the browser and could contain injected strings
    const safeFocus = sanitizeUrl(intendedFocus);
    const safeCurrent = sanitizeUrl(currentUrl);
    const safeTitle = sanitizeInput(pageTitle, 100);

    const prompt = `You are a strict but encouraging productivity coach. The user intended to focus on: "${safeFocus}" but is currently browsing: "${safeCurrent}" (page title: "${safeTitle || 'unknown'}").

Write a single motivating warning message (max 120 characters) urging them to return to their focus site. Be direct but not harsh.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const warning = (response.text || '')
      .replace(/^["']|["']$/g, '') // Strip surrounding quotes
      .trim()
      .substring(0, 200);

    res.status(200).json({
      success: true,
      warning,
    });
  } catch (error) {
    logger.error('AI coach error', {
      userId: req.user?._id,
      error: error.message,
    });
    next(error);
  }
};

module.exports = { generateSubtasks, generateFocusWarning };
