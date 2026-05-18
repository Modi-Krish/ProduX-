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
      You are the "Quest Master", a fantasy RPG guide helping a hero conquer their real-world productivity goals.
      Break down the following real-world task into 3 to 5 actionable, bite-sized RPG-style quest steps (subtasks).
      
      Task Title: "${title}"
      Task Description: "${description || 'None'}"
      
      Guidelines:
      1. Write short, active, clear action items.
      2. Frame them with playful RPG/fantasy flavor where appropriate (e.g., "Draft the blueprint" or "Synthesize code components" or "Defeat the research dragon").
      3. Return ONLY a raw JSON array of strings. Do not include markdown code block formatting like \`\`\`json or \`\`\`.
      
      Example output:
      ["Scout out the documentation for hidden traps", "Establish a secure sandbox environment", "Synthesize a functional prototype"]
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
