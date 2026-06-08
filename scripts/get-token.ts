const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:9999';
const SCOPE = 'https://www.googleapis.com/auth/documents.readonly';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running.'
  );
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('scope', SCOPE);

console.log('Prerequisites:');
console.log('  • Google Docs API enabled in your GCP project');
console.log(
  `  • "${REDIRECT_URI}" added as an Authorized redirect URI on your OAuth client\n`
);
console.log('Open this URL in your browser:\n');
console.log(authUrl.toString());
console.log('\nWaiting for callback on http://localhost:9999 ...\n');

const code = await new Promise<string>((resolve, reject) => {
  const server = Bun.serve({
    port: 9999,
    fetch(req) {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        server.stop();
        reject(new Error(`OAuth error: ${error}`));
        return new Response(`<h1>Error: ${error}</h1>`, {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      if (code) {
        server.stop();
        resolve(code);
        return new Response('<h1>Done. You can close this tab.</h1>', {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      return new Response('Waiting...', { status: 200 });
    }
  });
});

console.log('Code received. Exchanging for tokens...\n');

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  })
});

const tokens = (await tokenResponse.json()) as {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

if (tokens.error || !tokens.refresh_token) {
  console.error('Token exchange failed:', tokens);
  process.exit(1);
}

console.log('Add this to your .env:\n');
console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
