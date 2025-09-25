import crypto from 'crypto';

const DEFAULT_SECRET = 'video-downloader-default-secret-change-me';

function getSecret() {
  const secret = process.env.APP_SECRET || DEFAULT_SECRET;
  if (secret === DEFAULT_SECRET) {
    console.warn('APP_SECRET not set. Using default secret. Set APP_SECRET for production.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

const secretKey = getSecret();

export function createHmacSignature(payload) {
  const secret = process.env.APP_SECRET || DEFAULT_SECRET;
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
}

export function verifyHmacSignature(payload, signature) {
  const expected = createHmacSignature(payload);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createEncryptedPayload(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  const serialized = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
    tag: authTag.toString('hex'),
  };
}

export function decryptPayload(payload) {
  const { iv, content, tag } = payload;
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(content, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function createSignedToken(id, expiresAt) {
  const payload = `${id}:${expiresAt}`;
  const signature = createHmacSignature(payload);
  return { payload, signature };
}

export function validateSignedToken(id, expiresAt, signature) {
  const payload = `${id}:${expiresAt}`;
  return verifyHmacSignature(payload, signature);
}
