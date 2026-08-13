export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const farmId = searchParams.get('farmId') || '1';

  // Retrieve secret API key from Cloudflare Pages Environment Variables
  const apiKey = context.env.SFL_API_KEY || '';

  // Full browser-like headers to prevent SFL API drops / 522 Host Errors
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://sunflower-land.com/',
    'Origin': 'https://sunflower-land.com'
  };

  if (apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  try {
    // Add a 10-second timeout to prevent connection hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const sflResponse = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, {
      method: 'GET',
      headers: headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!sflResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: `SFL API status ${sflResponse.status}`,
          status: sflResponse.status 
        }), 
        { status: sflResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rawData = await sflResponse.json();

    return new Response(JSON.stringify(rawData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    const isAbort = err.name === 'AbortError';
    return new Response(
      JSON.stringify({ 
        error: isAbort ? 'SFL API request timed out (10s)' : 'Failed to fetch SFL data', 
        details: err.message 
      }), 
      { 
        status: 504, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
