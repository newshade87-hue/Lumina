
import { GoogleGenAI, Type } from "@google/genai";
import { Importance, AIResult } from "../types";

export const analyzeNote = async (content: string): Promise<AIResult | null> => {
  if (!content || content.length < 10) return null;

  try {
    // Safely access API_KEY to prevent crashing if process.env is not defined
    let apiKey = '';
    try {
      apiKey = process.env.API_KEY || '';
    } catch (e) {
      console.warn("Lumina: Environment variables not accessible via process.env");
    }

    if (!apiKey) {
      console.error("Lumina: API_KEY is missing. Gemini features disabled.");
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following note content. Provide a concise summary, extract 3-5 keywords, determine the overall sentiment (Positive, Neutral, or Negative), suggest 2-3 related high-level concepts or topics for further research, and extract any actionable tasks. 
      Note Content: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'A brief 1-2 sentence summary of the note.',
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-5 key topics or terms.',
            },
            sentiment: {
              type: Type.STRING,
              description: 'Overall emotional tone.',
            },
            relatedConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Suggested topics for further exploration.',
            },
            suggestedTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: 'The task description.' },
                  importance: { 
                    type: Type.STRING, 
                    enum: [Importance.LOW, Importance.MEDIUM, Importance.HIGH, Importance.CRITICAL],
                    description: 'The estimated priority level.'
                  },
                },
                required: ['text', 'importance'],
              },
            },
          },
          required: ['summary', 'keywords', 'sentiment', 'relatedConcepts', 'suggestedTasks'],
        },
      },
    });

    return JSON.parse(response.text.trim()) as AIResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
