const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

function getYouTubeConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || '';

  return { clientId, clientSecret, refreshToken };
}

export function assertYouTubeUploadConfig() {
  const { clientId, clientSecret, refreshToken } = getYouTubeConfig();
  const missing = [];
  if (!clientId) missing.push('YOUTUBE_CLIENT_ID');
  if (!clientSecret) missing.push('YOUTUBE_CLIENT_SECRET');
  if (!refreshToken) missing.push('YOUTUBE_REFRESH_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `Missing YouTube OAuth env: ${missing.join(', ')}. Run npm run youtube:oauth-setup once.`,
    );
  }
}

export async function getYouTubeAccessToken() {
  assertYouTubeUploadConfig();
  const { clientId, clientSecret, refreshToken } = getYouTubeConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `Token refresh failed (${res.status})`);
  }

  if (!data.access_token) {
    throw new Error('YouTube token refresh returned no access_token.');
  }

  return data.access_token;
}

async function youtubeGet(accessToken, path, params = {}) {
  const url = new URL(`${YOUTUBE_API}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `YouTube API GET ${path} failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export async function getAuthenticatedChannel(accessToken) {
  const data = await youtubeGet(accessToken, 'channels', {
    part: 'snippet,contentDetails',
    mine: 'true',
  });

  const channel = data.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for the authenticated Google account.');
  }

  return {
    channelId: channel.id,
    title: channel.snippet?.title || 'YouTube channel',
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || '',
  };
}

async function findRecentShortByDescriptionNeedle(accessToken, uploadsPlaylistId, needle, maxResults = 25) {
  if (!uploadsPlaylistId || !needle) {
    return null;
  }

  const data = await youtubeGet(accessToken, 'playlistItems', {
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults,
  });

  const match = (data.items || []).find((item) => {
    const description = item.snippet?.description || '';
    return description.includes(needle);
  });

  if (!match) {
    return null;
  }

  return {
    videoId: match.snippet?.resourceId?.videoId || null,
    title: match.snippet?.title || '',
    url: match.snippet?.resourceId?.videoId
      ? `https://www.youtube.com/shorts/${match.snippet.resourceId.videoId}`
      : null,
  };
}

export async function findRecentShortByMarker(accessToken, uploadsPlaylistId, marker) {
  return findRecentShortByDescriptionNeedle(
    accessToken,
    uploadsPlaylistId,
    `vizag-jobs-short:${marker}`,
    10,
  );
}

export async function findRecentShortByDriveFileId(accessToken, uploadsPlaylistId, driveFileId) {
  return findRecentShortByDescriptionNeedle(
    accessToken,
    uploadsPlaylistId,
    `drive-file:${driveFileId}`,
    25,
  );
}

export async function uploadYouTubeShort({
  accessToken,
  videoPath,
  title,
  description,
  tags = [],
  privacyStatus = 'public',
}) {
  const metadata = {
    snippet: {
      title,
      description,
      tags,
      categoryId: '22',
      defaultLanguage: 'en',
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`YouTube upload init failed (${initRes.status}): ${text.slice(0, 400)}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube upload init did not return a resumable upload URL.');
  }

  const videoBytes = await (await import('node:fs/promises')).readFile(videoPath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBytes.byteLength),
    },
    body: videoBytes,
  });

  const uploadText = await uploadRes.text();
  let uploadData;
  try {
    uploadData = uploadText ? JSON.parse(uploadText) : {};
  } catch {
    throw new Error(`YouTube upload returned non-JSON (${uploadRes.status}): ${uploadText.slice(0, 400)}`);
  }

  if (!uploadRes.ok) {
    throw new Error(uploadData?.error?.message || `YouTube upload failed (${uploadRes.status})`);
  }

  return {
    videoId: uploadData.id,
    title: uploadData.snippet?.title || title,
    url: uploadData.id ? `https://www.youtube.com/shorts/${uploadData.id}` : null,
  };
}

export async function exchangeAuthorizationCode({ clientId, clientSecret, code, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `OAuth exchange failed (${res.status})`);
  }

  return data;
}

export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

export const DRIVE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/drive';

export function buildYouTubeOAuthUrl({ clientId, redirectUri }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function buildDriveOAuthUrl({ clientId, redirectUri }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function getGoogleAccessToken({ clientId, clientSecret, refreshToken, label = 'Google' }) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `${label} token refresh failed (${res.status})`);
  }

  if (!data.access_token) {
    throw new Error(`${label} token refresh returned no access_token.`);
  }

  return data.access_token;
}

export function getDriveOAuthConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
  const refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.YOUTUBE_REFRESH_TOKEN ||
    '';

  return { clientId, clientSecret, refreshToken };
}

export function assertDriveOAuthConfig() {
  const { clientId, clientSecret, refreshToken } = getDriveOAuthConfig();
  const missing = [];
  if (!clientId) missing.push('YOUTUBE_CLIENT_ID');
  if (!clientSecret) missing.push('YOUTUBE_CLIENT_SECRET');
  if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN) missing.push('GOOGLE_DRIVE_REFRESH_TOKEN');
  if (!refreshToken) missing.push('GOOGLE_DRIVE_REFRESH_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `Missing Drive OAuth env: ${[...new Set(missing)].join(', ')}. Run npm run drive:oauth-setup once with your normal Gmail (not Brand Account).`,
    );
  }
}

export async function getDriveAccessToken() {
  assertDriveOAuthConfig();
  const { clientId, clientSecret, refreshToken } = getDriveOAuthConfig();
  return getGoogleAccessToken({
    clientId,
    clientSecret,
    refreshToken,
    label: 'Drive',
  });
}
