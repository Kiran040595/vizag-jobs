#!/usr/bin/env node
/**
 * One-time helper to obtain a YouTube refresh token for Short uploads.
 *
 * For Brand Account channels (e.g. Student Needs), sign in with the manager
 * Gmail and choose the Brand Account when Google asks which channel to use.
 *
 * Drive uses a separate token: npm run drive:oauth-setup
 */

import http from 'node:http';
import { URL } from 'node:url';

import { buildYouTubeOAuthUrl, exchangeAuthorizationCode } from './lib/youtube-upload.mjs';
import { loadEnvFile } from './lib/youtube-oauth-env.mjs';

const env = loadEnvFile();
const clientId = env.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '';
const clientSecret = env.YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '';
const redirectUri = env.YOUTUBE_REDIRECT_URI || process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:8765/oauth2callback';
const port = Number(new URL(redirectUri).port || 8765);

if (!clientId || !clientSecret) {
  console.error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const authUrl = buildYouTubeOAuthUrl({ clientId, redirectUri });

console.log('\nYouTube OAuth setup\n');
console.log('1. Open this URL and sign in with the account that manages your channel:\n');
console.log(authUrl);
console.log('\n2. If asked, choose the Brand Account / channel (e.g. Student Needs).');
console.log('3. Approve YouTube access. You will be redirected to localhost.\n');
console.log('Note: Drive needs a separate login: npm run drive:oauth-setup\n');

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://localhost:${port}`);
    if (requestUrl.pathname !== new URL(redirectUri).pathname) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`OAuth error: ${error}`);
      console.error(`OAuth error: ${error}`);
      server.close();
      process.exit(1);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Missing authorization code.');
      return;
    }

    const tokens = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>YouTube connected</h1><p>You can close this tab and return to the terminal.</p>');

    console.log('\nSuccess. Add these to .env.local and GitHub Actions secrets:\n');
    console.log(`YOUTUBE_CLIENT_ID=${clientId}`);
    console.log(`YOUTUBE_CLIENT_SECRET=${clientSecret}`);
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token || '(missing — revoke app access and run again with prompt=consent)'}`);
    if (tokens.access_token) {
      console.log('\n(access token expires quickly; keep the refresh token)');
    }
    console.log('\nThen test with:');
    console.log('  AUTO_YOUTUBE_SHORT_DRY_RUN=true npm run auto:youtube-short');
    console.log('  npm run auto:youtube-short');
    console.log('\nFor Drive → Shorts, also run: npm run drive:oauth-setup\n');

    server.close();
    process.exit(0);
  } catch (setupError) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OAuth setup failed. Check the terminal.');
    console.error(setupError instanceof Error ? setupError.message : setupError);
    server.close();
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log(`Waiting for OAuth redirect on ${redirectUri} ...`);
});
