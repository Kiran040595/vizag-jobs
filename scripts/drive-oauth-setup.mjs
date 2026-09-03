#!/usr/bin/env node
/**
 * One-time helper to obtain a Google Drive refresh token.
 *
 * Use your normal Gmail account that owns the Drive watch folder
 * (NOT a YouTube Brand Account — Brand Accounts have no Drive).
 *
 * Usage:
 *   1. Enable Google Drive API in Google Cloud
 *   2. Same OAuth client as YouTube is fine
 *   3. Run: npm run drive:oauth-setup
 */

import http from 'node:http';
import { URL } from 'node:url';

import { buildDriveOAuthUrl, exchangeAuthorizationCode } from './lib/youtube-upload.mjs';
import { loadEnvFile } from './lib/youtube-oauth-env.mjs';

const env = loadEnvFile();
const clientId = env.YOUTUBE_CLIENT_ID || env.GOOGLE_DRIVE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '';
const clientSecret =
  env.YOUTUBE_CLIENT_SECRET || env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '';
const redirectUri =
  env.GOOGLE_DRIVE_REDIRECT_URI ||
  env.YOUTUBE_REDIRECT_URI ||
  process.env.YOUTUBE_REDIRECT_URI ||
  'http://localhost:8765/oauth2callback';
const port = Number(new URL(redirectUri).port || 8765);

if (!clientId || !clientSecret) {
  console.error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const authUrl = buildDriveOAuthUrl({ clientId, redirectUri });

console.log('\nGoogle Drive OAuth setup (separate from YouTube)\n');
console.log('IMPORTANT: Sign in with your normal Gmail that owns the Drive folder.');
console.log('Do NOT pick the YouTube Brand Account (Student Needs) — Brand Accounts have no Drive.\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Approve Drive access. You will be redirected to localhost.\n');

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
    res.end('<h1>Google Drive connected</h1><p>You can close this tab and return to the terminal.</p>');

    console.log('\nSuccess. Add this to .env.local and GitHub Actions secrets:\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token || '(missing — revoke app access and run again)'}`);
    if (tokens.access_token) {
      console.log('\n(access token expires quickly; keep the refresh token)');
    }
    console.log('\nKeep your existing YOUTUBE_REFRESH_TOKEN for the Brand Account / channel.');
    console.log('\nThen test with:');
    console.log('  AUTO_DRIVE_YT_DRY_RUN=true npm run auto:drive-youtube-short');
    console.log('  npm run auto:drive-youtube-short\n');

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
