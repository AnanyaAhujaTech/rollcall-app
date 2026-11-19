import crypto from 'node:crypto';

const PIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getSigningSecret(customSecret?: string): string {
  return (
    customSecret ||
    process.env.QR_SIGNING_SECRET ||
    'rollcall-anti-proxy-default-signing-secret-key-32chars'
  );
}

// ============================================================================
// DYNAMIC QR: 10s Windowed Token (sessionId.windowIndex.signature)
// ============================================================================

export function generateSessionToken(
  sessionId: string,
  windowDurationSec: number = 10,
  secret?: string
): { token: string; windowIndex: number; expiresInSeconds: number } {
  const secretKey = getSigningSecret(secret);
  const nowMs = Date.now();
  const windowMs = windowDurationSec * 1000;
  const windowIndex = Math.floor(nowMs / windowMs);

  // Time remaining in current window
  const windowEndMs = (windowIndex + 1) * windowMs;
  const expiresInSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000));

  const data = `${sessionId}:${windowIndex}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('hex')
    .substring(0, 32);

  const token = `${sessionId}.${windowIndex}.${signature}`;
  return { token, windowIndex, expiresInSeconds };
}

export function verifySessionToken(
  token: string,
  sessionId: string,
  windowDurationSec: number = 10,
  secret?: string
): { valid: boolean; reason?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Malformed token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Invalid token format' };
  }

  const [tokenSessionId, tokenWindowStr, tokenSig] = parts;

  if (tokenSessionId !== sessionId) {
    return { valid: false, reason: 'Token belongs to a different session' };
  }

  const tokenWindow = parseInt(tokenWindowStr, 10);
  if (isNaN(tokenWindow)) {
    return { valid: false, reason: 'Invalid window index in token' };
  }

  const secretKey = getSigningSecret(secret);
  const nowMs = Date.now();
  const windowMs = windowDurationSec * 1000;
  const currentWindow = Math.floor(nowMs / windowMs);

  // Allow current window and 1 previous window as latency grace
  const validWindows = [currentWindow, currentWindow - 1];

  if (!validWindows.includes(tokenWindow)) {
    return {
      valid: false,
      reason:
        tokenWindow < currentWindow - 1
          ? 'Token has expired'
          : 'Token timestamp is in the future',
    };
  }

  // Compute expected signature for tokenWindow
  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(`${sessionId}:${tokenWindow}`)
    .digest('hex')
    .substring(0, 32);

  const tokenSigBuf = Buffer.from(tokenSig);
  const expectedSigBuf = Buffer.from(expectedSig);

  if (
    tokenSigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(tokenSigBuf, expectedSigBuf)
  ) {
    return { valid: false, reason: 'Invalid token cryptographic signature' };
  }

  return { valid: true };
}

// ============================================================================
// ROTATING PIN: 20s Windowed Deterministic 6-Char Alphanumeric Code
// ============================================================================

function derivePin(sessionId: string, windowIndex: number, secretKey: string): string {
  const data = `${sessionId}:PIN:${windowIndex}`;
  const digest = crypto.createHmac('sha256', secretKey).update(data).digest();
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += PIN_ALPHABET[digest[i] % PIN_ALPHABET.length];
  }
  return pin;
}

export function generateSessionPin(
  sessionId: string,
  windowDurationSec: number = 20,
  secret?: string
): { pin: string; windowIndex: number; expiresInSeconds: number } {
  const secretKey = getSigningSecret(secret);
  const nowMs = Date.now();
  const windowMs = windowDurationSec * 1000;
  const windowIndex = Math.floor(nowMs / windowMs);

  const windowEndMs = (windowIndex + 1) * windowMs;
  const expiresInSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000));

  const pin = derivePin(sessionId, windowIndex, secretKey);

  return { pin, windowIndex, expiresInSeconds };
}

export function verifySessionPin(
  pin: string,
  sessionId: string,
  windowDurationSec: number = 20,
  secret?: string
): { valid: boolean; reason?: string } {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, reason: 'Missing PIN' };
  }

  const normalizedPin = pin.trim().toUpperCase();
  if (normalizedPin.length !== 6) {
    return { valid: false, reason: 'PIN must be exactly 6 characters' };
  }

  const secretKey = getSigningSecret(secret);
  const nowMs = Date.now();
  const windowMs = windowDurationSec * 1000;
  const currentWindow = Math.floor(nowMs / windowMs);

  // Check current window and 1 previous window as latency grace
  const candidateWindows = [currentWindow, currentWindow - 1];

  for (const win of candidateWindows) {
    const expectedPin = derivePin(sessionId, win, secretKey);

    if (normalizedPin === expectedPin) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'Invalid or expired PIN code' };
}

// ============================================================================
// GEOFENCING: Haversine Distance (Meters)
// ============================================================================

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in meters
}
