// 简单的内存速率限制器
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 15; // 每分钟最多15次请求

function isRateLimited(clientIp) {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientIp, { startTime: now, count: 1 });
    return false;
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// 清理过期的速率限制记录（每5分钟）
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now - record.startTime > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const ALLOWED_ORIGINS = [
  'https://tarot-pavilion.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

export const handler = async (event) => {
  // 处理 CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    const origin = event.headers.origin || '';
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // CORS 检查
  const origin = event.headers.origin || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // 速率限制
  const clientIp = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  if (isRateLimited(clientIp)) {
    return { statusCode: 429, body: JSON.stringify({ error: '请求过于频繁，请稍后再试' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: '服务暂不可用' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const token = authHeader.substring(7);
  if (!token || token.length < 20) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { prompt, imageBase64, model = 'gemini-2.0-flash' } = JSON.parse(event.body || '{}');
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing prompt' }) };
    }

    const sanitizedPrompt = prompt.trim();
    if (sanitizedPrompt.length > 5000) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt too long' }) };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = { contents: [{ parts: [{ text: sanitizedPrompt }] }] };
    if (imageBase64) {
      if (imageBase64.length > 2000000) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Image too large' }) };
      }
      requestBody.contents[0].parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(await response.json())
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: '服务暂不可用' }) };
  }
};
