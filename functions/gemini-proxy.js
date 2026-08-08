import { handleGeminiProxyRequest } from './_shared/geminiProxy.js';

export async function onRequest({ request, env }) {
  return handleGeminiProxyRequest(request, env);
}
