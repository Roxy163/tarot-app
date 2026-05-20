interface GeminiRequest {
  prompt: string;
  imageBase64?: string;
  model?: string;
}

export async function callGemini({ prompt, imageBase64, model = 'gemini-2.0-flash' }: GeminiRequest) {
  const response = await fetch('/api/gemini-proxy', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('tarot_auth_token') || 'local-dev-token'}`
    },
    body: JSON.stringify({ prompt, imageBase64, model })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
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

  const response = await fetch('/api/gemini-proxy', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('tarot_auth_token') || 'local-dev-token'}`
    },
    body: JSON.stringify({ prompt, imageBase64 })
  });
  if (!response.ok) throw new Error('Card recognition failed');
  const data = await response.json();
  return extractTextFromResponse(data);
}
