import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const getR2Config = () => {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME || '').trim();
  const endpoint =
    (process.env.R2_ENDPOINT || '').trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
};

export const createR2Client = (config = getR2Config()) => {
  if (!config) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    // R2 does not support AWS flexible checksum headers added by recent SDK defaults.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
};

export const createR2UploadUrl = async ({ objectKey, contentType, expiresIn = 600 }) => {
  const config = getR2Config();
  const client = createR2Client(config);
  if (!config || !client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
};

export const createR2DownloadUrl = async ({ objectKey, expiresIn = 3600, fileName }) => {
  const config = getR2Config();
  const client = createR2Client(config);
  if (!config || !client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ...(fileName
      ? {
          ResponseContentDisposition: `inline; filename="${String(fileName).replace(/"/g, '')}"`,
        }
      : {}),
  });

  return getSignedUrl(client, command, { expiresIn });
};

export const downloadR2Object = async (objectKey) => {
  const config = getR2Config();
  const client = createR2Client(config);
  if (!config || !client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  );

  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error('Resume file was empty.');
  }

  return {
    body: Buffer.from(bytes),
    contentType: result.ContentType || 'application/octet-stream',
    contentLength: bytes.byteLength,
  };
};
