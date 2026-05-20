export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized - Missing or invalid token' }) };
  }

  const token = authHeader.substring(7);
  
  if (!token || token.length < 20) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized - Invalid token' }) };
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
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(await response.json())
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
