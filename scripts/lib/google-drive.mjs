import fs from 'node:fs/promises';
import path from 'node:path';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/mpeg',
]);

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.mpeg', '.mpg']);

function driveHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

async function driveJson(accessToken, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: driveHeaders(accessToken, options.headers),
  });

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Drive API returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || `Drive API failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

function isVideoFile(file) {
  const mime = String(file.mimeType || '').toLowerCase();
  if (VIDEO_MIME_TYPES.has(mime) || mime.startsWith('video/')) {
    return true;
  }
  const ext = path.extname(file.name || '').toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

/**
 * List video files directly in the watch folder (not nested, not trashed).
 * Oldest first so uploads stay FIFO.
 */
export async function listWatchFolderVideos(accessToken, folderId) {
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_WATCH_FOLDER_ID is required.');
  }

  const q = [
    `'${folderId}' in parents`,
    'trashed = false',
    "mimeType != 'application/vnd.google-apps.folder'",
  ].join(' and ');

  const files = [];
  let pageToken = '';

  do {
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('q', q);
    url.searchParams.set('spaces', 'drive');
    url.searchParams.set(
      'fields',
      'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents)',
    );
    url.searchParams.set('orderBy', 'createdTime');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const data = await driveJson(accessToken, url.toString());
    for (const file of data.files || []) {
      if (isVideoFile(file)) {
        files.push(file);
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return files;
}

export async function downloadDriveFile(accessToken, fileId, destPath) {
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('alt', 'media');
  url.searchParams.set('supportsAllDrives', 'true');

  const res = await fetch(url, {
    headers: driveHeaders(accessToken),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive download failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength < 1000) {
    throw new Error('Downloaded Drive file is empty or too small to be a video.');
  }

  await fs.writeFile(destPath, buffer);
  return {
    path: destPath,
    bytes: buffer.byteLength,
  };
}

export async function ensureUploadedFolder(accessToken, parentFolderId) {
  const q = [
    `'${parentFolderId}' in parents`,
    "name = 'Uploaded'",
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');

  const listUrl = new URL(`${DRIVE_API}/files`);
  listUrl.searchParams.set('q', q);
  listUrl.searchParams.set('fields', 'files(id,name)');
  listUrl.searchParams.set('pageSize', '5');
  listUrl.searchParams.set('supportsAllDrives', 'true');
  listUrl.searchParams.set('includeItemsFromAllDrives', 'true');

  const existing = await driveJson(accessToken, listUrl.toString());
  if (existing.files?.[0]?.id) {
    return existing.files[0].id;
  }

  const created = await driveJson(accessToken, `${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Uploaded',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  if (!created.id) {
    throw new Error('Failed to create Drive Uploaded folder.');
  }

  return created.id;
}

export async function moveDriveFile(accessToken, fileId, newParentId, oldParentId) {
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('addParents', newParentId);
  if (oldParentId) {
    url.searchParams.set('removeParents', oldParentId);
  }
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('fields', 'id,name,parents');

  return driveJson(accessToken, url.toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function getDriveFileMetadata(accessToken, fileId) {
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', 'id,name,mimeType,size,createdTime,parents');
  url.searchParams.set('supportsAllDrives', 'true');
  return driveJson(accessToken, url.toString());
}
