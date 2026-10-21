// Preserve older clients while new Netlify builds call the shared mail service directly.
export const handler = async () => ({
  statusCode: 307,
  headers: {
    Location: 'https://tarot-pavilion.pages.dev/api/feedback',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  },
  body: '',
});
