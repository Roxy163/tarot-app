const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://tarot-pavilion.pages.dev',
  'https://tarot-pavilion.netlify.app',
  'https://www.tarot-pavilion.com',
  'https://tarot-pavilion.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

function normalizeOrigin(value) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return String(value).replace(/\/+$/, '');
  }
}

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeOrigin(item.trim()))
    .filter(Boolean);
}

function getAllowedOrigins(env = {}) {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS);

  for (const origin of parseOriginList(env.ALLOWED_ORIGINS)) {
    origins.add(origin);
  }

  const currentPagesUrl = normalizeOrigin(env.CF_PAGES_URL);
  if (currentPagesUrl) {
    origins.add(currentPagesUrl);

    try {
      const hostnameParts = new URL(currentPagesUrl).hostname.split('.');
      if (hostnameParts.length > 3 && hostnameParts.slice(-2).join('.') === 'pages.dev') {
        origins.add(`https://${hostnameParts.slice(1).join('.')}`);
      }
    } catch {
      // Ignore invalid system URLs and fall back to the explicit allow-list.
    }
  }

  return origins;
}

function isOriginAllowed(origin, env) {
  if (!origin) return true;
  return getAllowedOrigins(env).has(normalizeOrigin(origin));
}

function getCorsHeaders(origin, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };

  if (origin && isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = normalizeOrigin(origin);
  }

  return headers;
}

function jsonResponse(origin, env, status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(origin, env),
      'Content-Type': 'application/json'
    }
  });
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(clientIp) {
  const now = Date.now();

  for (const [ip, record] of rateLimitMap) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }

  const record = rateLimitMap.get(clientIp);
  if (!record) {
    rateLimitMap.set(clientIp, { startTime: now, count: 1 });
    return false;
  }

  if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(clientIp, { startTime: now, count: 1 });
    return false;
  }

  record.count += 1;
  return record.count > RATE_LIMIT_MAX;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function readGeminiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return { error: await response.text() };
}

export async function handleGeminiProxyRequest(request, env = {}) {
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin, env)
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(origin, env, 405, { error: 'Method Not Allowed' });
  }

  if (!isOriginAllowed(origin, env)) {
    return jsonResponse(origin, env, 403, { error: 'Forbidden' });
  }

  if (isRateLimited(getClientIp(request))) {
    return jsonResponse(origin, env, 429, { error: '请求过于频繁，请稍后再试' });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(origin, env, 500, { error: '服务暂不可用' });
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse(origin, env, 401, { error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  if (!token || token.length < 20) {
    return jsonResponse(origin, env, 401, { error: '请先登录后再使用 AI 灵感。' });
  }

  const payload = await readJson(request);
  if (!payload) {
    return jsonResponse(origin, env, 400, { error: 'Invalid JSON' });
  }

  const { prompt, imageBase64, model = 'gemini-2.0-flash' } = payload;
  if (!prompt) {
    return jsonResponse(origin, env, 400, { error: 'Missing prompt' });
  }

  const sanitizedPrompt = String(prompt).trim();
  if (sanitizedPrompt.length > 5000) {
    return jsonResponse(origin, env, 400, { error: 'Prompt too long' });
  }

  if (imageBase64 && imageBase64.length > 2000000) {
    return jsonResponse(origin, env, 400, { error: 'Image too large' });
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = { contents: [{ parts: [{ text: sanitizedPrompt }] }] };

    if (imageBase64) {
      requestBody.contents[0].parts.push({
        inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
      });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    return jsonResponse(origin, env, response.status, await readGeminiResponse(response));
  } catch {
    return jsonResponse(origin, env, 500, { error: '服务暂不可用' });
  }
}
