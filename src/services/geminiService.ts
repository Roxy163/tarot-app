const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface GeminiRequest {
  prompt: string;
  imageBase64?: string;
  model?: string;
}

export async function callGemini({ prompt, imageBase64, model = 'gemini-2.0-flash' }: GeminiRequest) {
  const isProduction = import.meta.env.PROD;
  
  if (isProduction) {
    // 线上：走 Netlify Function
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, imageBase64, model })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    return response.json();
  } else {
    // 本地：直连 Gemini
    if (!API_KEY) {
      throw new Error('请在 .env.local 中配置 VITE_GEMINI_API_KEY');
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const requestBody: any = { contents: [{ parts: [{ text: prompt }] }] };
    if (imageBase64) {
      requestBody.contents[0].parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }
    return response.json();
  }
}

export function extractTextFromResponse(response: any): string {
  try {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch {
    return '';
  }
}


export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      keywords.push(trimmed.replace(/^[-•*]\s*/, '').trim());
    }
  }
  return keywords;
}


export async function recognizeCards(imageBase64: string): Promise<string> {
  const prompt = '请识别这张图片中的塔罗牌，告诉我牌名和正逆位。只返回牌名，每行一张，格式如：愚者(正位)';

  const isProduction = import.meta.env.PROD;

  if (isProduction) {
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, imageBase64 })
    });
    if (!response.ok) throw new Error('Card recognition failed');
    const data = await response.json();
    return extractTextFromResponse(data);
  } else {
    if (!API_KEY) throw new Error('请在 .env.local 中配置 VITE_GEMINI_API_KEY');
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const requestBody = {
      contents: [{ parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
      ]}]
    };
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) throw new Error('Card recognition failed');
    const data = await response.json();
    return extractTextFromResponse(data);
  }
}