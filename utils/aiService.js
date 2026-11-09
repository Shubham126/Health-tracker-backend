import { GoogleGenAI } from "@google/genai";

let aiClient = null;

export const getClient = () => {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return aiClient;
};

export const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Helper to strip markdown code blocks before JSON parsing
export const parseJSONResponse = (text) => {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return null;
  }
};

// Main chat completion wrapper
export const chatCompletion = async ({
  systemPrompt,
  userMessage,
  temperature = 0.7,
}) => {
  const client = getClient();

  if (!client) {
    return "AI features are disabled because no GEMINI_API_KEY is configured.";
  }

  try {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature,
      },
    });

    return response.text ? response.text.trim() : "";
  } catch (err) {
    console.error("Gemini AI API Error:", err.message);
    throw err;
  }
};

// System Prompts for each AI feature
export const SYSTEM_PROMPTS = {
  weekly: `You are an encouraging and analytical habit coach. Review the user's weekly habit performance.
Write a concise, 120-180 word personalized report that covers:
1. Key wins and strengths (mention actual habit names)
2. Struggles or missed targets
3. Patterns observed
4. Gentle encouragement and actionable focus for next week.
Do not use markdown headers (# or ##). Write in clean paragraphs with line breaks.`,

  suggestion: `You are an expert behavioral scientist. Suggest exactly 3 new habits tailored to the user's goals, productive hours, and past struggles.
Return ONLY valid JSON as an array of 3 objects with this exact schema:
[
  {
    "name": "Habit Name",
    "description": "Brief description of the habit",
    "frequency": "daily",
    "category": "health",
    "icon": "💧",
    "reason": "Why this fits you specifically"
  }
]
Category must be strictly one of: health, fitness, learning, mindfulness, productivity, social, finance, creative, other.
Do not wrap in any extra keys. Output only valid JSON.`,

  recovery: `You are an empathetic habit recovery coach. The user just broke an active streak.
Provide a supportive 3-day comeback plan.
Structure your response as:
- An empathetic opening sentence acknowledging how normal slip-ups are.
- Day 1: One small, concrete action to rebuild momentum.
- Day 2: One incremental step forward.
- Day 3: A return to standard consistency.
- A final closing line of warm encouragement.
Mention the specific habit name and keep it under 150 words.`,

  chat: `You are an AI habit analyst with access to the user's actual 30-day habit history.
Answer the user's question clearly, citing specific numbers, percentages, day names, and habit names from the provided context.
Ground your response strictly in the provided data. Do not make up facts or give generic advice unless asked.`,

  morning: `You are an energetic morning habit coach.
Write a punchy, warm, 30-60 word morning motivation message.
Mention 1 or 2 of the user's actual habit names and current streaks.
Limit emojis to at most one. Keep it grounded, natural, and never cheesy.`,
};