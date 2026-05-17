import { GoogleGenAI, Type } from "@google/genai";
import { TAROT_CARDS } from "../constants";

// Lazy init - only create client when actually needed and key is available
let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (ai) return ai;
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API Key not configured. AI features will be disabled.');
    return null;
  }
  try {
    ai = new GoogleGenAI({ apiKey });
    return ai;
  } catch (e) {
    console.warn('Gemini client init failed:', e);
    return null;
  }
}

/**
 * Recognize tarot cards from natural language input
 */
export async function recognizeCards(input: string): Promise<Array<{ name: string; isReversed: boolean }>> {
  try {
    const client = getAiClient();
    if (!client) return [];

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `识别输入中的塔罗牌及正逆位。映射到官方牌名（如"女教皇"->"女祭司"）。
官方牌名：${TAROT_CARDS.map(c => c.name).join(', ')}。
输入：${input}
仅返回 JSON 数组：[{"name": "牌名", "isReversed": true/false}]。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              isReversed: { type: Type.BOOLEAN },
            },
            required: ["name", "isReversed"],
          },
        },
      },
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("AI Card Recognition Error:", error);
    return [];
  }
}

/**
 * Extract keywords from tarot interpretation
 */
export async function extractKeywords(interpretation: string): Promise<string[]> {
  try {
    const client = getAiClient();
    if (!client) return [];

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `从以下内容提取 5 个关键词（1-3字）。仅返回 JSON 字符串数组。
内容：${interpretation}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const keywords = JSON.parse(response.text || "[]");
    return keywords;
  } catch (error) {
    console.error("AI Keyword Extraction Error:", error);
    return [];
  }
}

/**
 * Check if Gemini AI is available
 */
export function isGeminiAvailable(): boolean {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
}
