const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < buffer.length; i += 1) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(sig);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const okm = new Uint8Array(length);
  let previous = new Uint8Array(0);
  let offset = 0;
  let counter = 1;
  while (offset < length) {
    const block = await hmacSha256(prk, concat(previous, info, new Uint8Array([counter])));
    const take = Math.min(block.length, length - offset);
    okm.set(block.subarray(0, take), offset);
    previous = block;
    offset += take;
    counter += 1;
  }
  return okm;
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) {
  const prk = await hmacSha256(salt, ikm);
  return hkdfExpand(prk, info, length);
}

function vapidPublicUncompressed(publicKeyB64: string): Uint8Array {
  const raw = fromBase64Url(publicKeyB64);
  if (raw.length === 65 && raw[0] === 0x04) return raw;
  throw new Error('VAPID public key must be an uncompressed P-256 key.');
}

async function importVapidPrivateKey(privateKeyB64: string, publicKeyB64: string) {
  const d = fromBase64Url(privateKeyB64);
  const pub = vapidPublicUncompressed(publicKeyB64);
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: toBase64Url(d),
    x: toBase64Url(x),
    y: toBase64Url(y),
    ext: true,
    key_ops: ['sign'],
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function createVapidJwt(audience: string, subject: string, publicKeyB64: string, privateKeyB64: string) {
  const privateKey = await importVapidPrivateKey(privateKeyB64, publicKeyB64);
  const header = toBase64Url(textEncoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = toBase64Url(
    textEncoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    textEncoder.encode(unsigned),
  );
  return `${unsigned}.${toBase64Url(signature)}`;
}

async function importUncompressedPublicKey(raw: Uint8Array) {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error('Invalid uncompressed P-256 public key.');
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(raw.slice(1, 33)),
    y: toBase64Url(raw.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function encryptPayload(userPublicKey: Uint8Array, userAuth: Uint8Array, payload: Uint8Array) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const localKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicJwk = await crypto.subtle.exportKey('jwk', localKeys.publicKey);
  const localPublic = concat(
    new Uint8Array([0x04]),
    fromBase64Url(localPublicJwk.x || ''),
    fromBase64Url(localPublicJwk.y || ''),
  );

  const userKey = await importUncompressedPublicKey(userPublicKey);
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, localKeys.privateKey, 256),
  );

  const authInfo = concat(
    textEncoder.encode('WebPush: info\0'),
    userPublicKey,
    localPublic,
  );
  const ikm = await hkdf(sharedSecret, userAuth, authInfo, 32);
  const cek = await hkdf(ikm, salt, textEncoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, textEncoder.encode('Content-Encoding: nonce\0'), 12);

  const padded = concat(payload, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([localPublic.length]), localPublic, ciphertext);
}

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: Record<string, unknown>,
  options: { vapidPublicKey: string; vapidPrivateKey: string; subject: string },
) {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  const jwt = await createVapidJwt(
    audience,
    options.subject,
    options.vapidPublicKey,
    options.vapidPrivateKey,
  );

  const body = await encryptPayload(
    fromBase64Url(subscription.p256dh),
    fromBase64Url(subscription.auth),
    textEncoder.encode(JSON.stringify(payload)),
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'high',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: `vapid t=${jwt}, k=${options.vapidPublicKey}`,
    },
    body,
  });

  return {
    ok: response.ok,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  };
}
