export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const farmId = searchParams.get('farmId') || '1';

  // Retrieve the secret API key saved in Cloudflare Pages Environment Variables
  const apiKey = context.env.SFL_API_KEY || '';

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'CloudflarePagesWorker/1.0'
  };

  // Attach API Key if present
  if (apiKey.trim() !== '') {
    headers['x-api-key'] = apiKey.trim();
  }

  try {
    const sflResponse = await fetch(`https://api.sunflower-land.com/community/farms/${encodeURIComponent(farmId)}`, {
      headers: headers
    });

    if (!sflResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: `SFL API error: Received status ${sflResponse.status}`,
          status: sflResponse.status 
        }), 
        { 
          status: sflResponse.status, 
          headers: { 'Content-Type': 'application/json' } 
        }
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
    return new Response(
      JSON.stringify({ error: 'Failed to fetch SFL data', details: err.message }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
