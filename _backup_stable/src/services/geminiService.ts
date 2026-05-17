import { GoogleGenAI, Type } from "@google/genai";
import { TAROT_CARDS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Recognize tarot cards from natural language input
 */
export async function recognizeCards(input: string): Promise<Array<{ name: string; isReversed: boolean }>> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
