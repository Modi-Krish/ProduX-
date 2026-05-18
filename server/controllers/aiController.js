// server/controllers/aiController.js
const { GoogleGenAI } = require('@google/genai');

// The client automatically picks up the GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

/**
 * Generate subtasks for a task (Quest Master)
 * POST /api/ai/breakdown
 */
exports.generateSubtasks = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const prompt = `
      Break down the following task into a structured workflow.
      
      Task Title: "${title}"
      Task Description: "${description || 'None'}"
      
      Rules:
      - Generate 4–8 subtasks.
      - Subtasks must directly relate to the task title.
      - Keep each subtask short, actionable, and clear.
      - Use professional and natural wording.
      - Avoid fantasy, RPG, poetic, or vague language.
      - Maintain logical workflow order.
      - Focus on execution-oriented steps.
      - Do not repeat similar subtasks.
      - Output ONLY a raw JSON array of strings. Do not include markdown code block formatting like \`\`\`json or \`\`\`.

      Guidelines:
      - If the title is technical, generate technical workflow subtasks.
      - If the title is business-related, generate planning/execution subtasks.
      - If the title is creative, generate ideation/production subtasks.
      - Make the subtasks realistic and useful for productivity.

      Example Input: "Lean AI ML"
      Example Output: ["Define the AI problem scope", "Collect essential training data", "Build a lightweight prototype", "Test initial model performance", "Gather early user feedback", "Optimize model accuracy"]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    let rawText = response.text || '';
    
    // Clean up any potential markdown wrapping
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let subtasks = [];
    try {
      subtasks = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse AI subtasks response:', rawText, parseError);
      // Fallback in case AI returned something invalid
      subtasks = [
        `Scout out resources for ${title}`,
        `Draft initial plan for ${title}`,
        `Execute primary objectives`,
        `Deliver final solution & review`
      ];
    }

    return res.status(200).json({ subtasks });
  } catch (error) {
    console.error('Quest Master subtask generation failed:', error);
    return res.status(500).json({ message: 'AI failed to generate quests', error: error.message });
  }
};

/**
 * Generate a context-aware distraction warning (Focus Coach)
 * POST /api/ai/coach
 */
exports.generateFocusWarning = async (req, res) => {
  try {
    const { intendedFocus, currentUrl, pageTitle } = req.body;

    if (!intendedFocus || !currentUrl) {
      return res.status(400).json({ message: 'Intended focus and current URL are required' });
    }

    const prompt = `
      You are a strict but humorous "Focus Coach" RPG guide. 
      The hero was supposed to be focusing on their quest: "${intendedFocus}".
      Instead, they got distracted and navigated to a prohibited territory.
      
      Distracted URL: "${currentUrl}"
      Distracted Page Title: "${pageTitle || 'Unknown page'}"
      
      Write a short, sharp, and slightly sassy 1-sentence alert warning them to close the distraction.
      - Make it extremely context-aware based on what they are wasting time on.
      - Incorporate RPG flavor (e.g., calling them "hero", "adventurer", mentioning their "focus pool" or "mana").
      - Keep it under 20 words so it fits perfectly in a standard system notification.
      
      Example: "Adventurer! Youtube's siren song drains your focus pool. Return to the sacred React quest immediately!"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const warning = (response.text || `Get back to ${intendedFocus}! You are currently wasting time in distraction territory.`).trim();

    return res.status(200).json({ warning });
  } catch (error) {
    console.error('Focus Coach warning generation failed:', error);
    return res.status(500).json({ message: 'AI failed to generate focus warning', error: error.message });
  }
};
