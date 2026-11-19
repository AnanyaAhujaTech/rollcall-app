import assert from 'node:assert';
import {
  generateSessionToken,
  verifySessionToken,
  generateSessionPin,
  verifySessionPin,
  calculateHaversineDistance,
} from '../src/lib/utils/antiProxy.ts';

console.log('--- Running Phase 2 Anti-Proxy Engine Tests ---');

const testSessionId = 'session_test_987xyz';
const testSecret = 'test-secret-key-32chars-rollcall';

// Test 1: Dynamic QR Token Generation & Format
const { token, windowIndex, expiresInSeconds } = generateSessionToken(testSessionId, 10, testSecret);
assert.match(
  token,
  new RegExp(`^${testSessionId}\\.\\d+\\.[a-f0-9]{32}$`),
  `Token should match sessionId.windowIndex.hex32 pattern, got: ${token}`
);
assert(expiresInSeconds >= 1 && expiresInSeconds <= 10, 'expiresInSeconds must be between 1 and 10');
console.log('✓ Dynamic QR token format verified:', token);

// Test 2: Token Verification in Current Window
const verifyCurrent = verifySessionToken(token, testSessionId, 10, testSecret);
assert.strictEqual(verifyCurrent.valid, true, 'Current window token must verify as valid');
console.log('✓ Current window token verification passed.');

// Test 3: Token Verification with 1-Window Latency Grace
const prevWindow = windowIndex - 1;
// Construct a simulated token from previous window
import crypto from 'node:crypto';
const prevData = `${testSessionId}:${prevWindow}`;
const prevSig = crypto.createHmac('sha256', testSecret).update(prevData).digest('hex').substring(0, 32);
const prevToken = `${testSessionId}.${prevWindow}.${prevSig}`;
const verifyPrev = verifySessionToken(prevToken, testSessionId, 10, testSecret);
assert.strictEqual(verifyPrev.valid, true, 'Previous window token must be accepted as 1-window latency grace');
console.log('✓ Previous window (latency grace) verification passed.');

// Test 4: Token Rejection for Expired Window (W - 2)
const expiredWindow = windowIndex - 2;
const expiredData = `${testSessionId}:${expiredWindow}`;
const expiredSig = crypto.createHmac('sha256', testSecret).update(expiredData).digest('hex').substring(0, 32);
const expiredToken = `${testSessionId}.${expiredWindow}.${expiredSig}`;
const verifyExpired = verifySessionToken(expiredToken, testSessionId, 10, testSecret);
assert.strictEqual(verifyExpired.valid, false, 'Expired window (W-2) must be rejected');
console.log('✓ Expired window (W-2) rejected as expected:', verifyExpired.reason);

// Test 5: Token Rejection for Tampered Token or Session ID Mismatch
const tamperedToken = `${testSessionId}.${windowIndex}.00000000000000000000000000000000`;
const verifyTampered = verifySessionToken(tamperedToken, testSessionId, 10, testSecret);
assert.strictEqual(verifyTampered.valid, false, 'Tampered signature must be rejected');

const verifyWrongSession = verifySessionToken(token, 'different_session_123', 10, testSecret);
assert.strictEqual(verifyWrongSession.valid, false, 'Wrong session ID must be rejected');
console.log('✓ Tampered tokens and session mismatches safely rejected.');

// Test 6: Rotating PIN Generation & Format
const { pin, windowIndex: pinWindow, expiresInSeconds: pinExpires } = generateSessionPin(testSessionId, 20, testSecret);
assert.strictEqual(pin.length, 6, `PIN must be 6 characters long, got: ${pin}`);
assert.match(pin, /^[A-Z0-9]{6}$/, `PIN must be uppercase alphanumeric, got: ${pin}`);
assert(pinExpires >= 1 && pinExpires <= 20, 'PIN expiresInSeconds must be between 1 and 20');
console.log('✓ Rotating PIN generation verified: 6-char code =', pin);

// Test 6b: Assert pin.length === 6 across 100 different session IDs and windows
for (let i = 0; i < 100; i++) {
  const sampleSessionId = `session_sample_${i}_${Math.random().toString(36).substring(2, 8)}`;
  const res = generateSessionPin(sampleSessionId, 20, testSecret);
  assert.strictEqual(
    res.pin.length,
    6,
    `PIN must always be exactly 6 characters long! Failed on iteration ${i} with PIN "${res.pin}" (length: ${res.pin.length})`
  );
  assert.match(
    res.pin,
    /^[A-Z0-9]{6}$/,
    `PIN must be composed of uppercase alphanumeric characters: ${res.pin}`
  );
  assert.doesNotMatch(
    res.pin,
    /[10IO]/,
    `PIN must not contain ambiguous characters 1, 0, I, O: ${res.pin}`
  );
}
console.log('✓ Asserted pin.length === 6 across 100 different session IDs and windows with 0 ambiguous characters.');

// Test 7: Rotating PIN Verification
const verifyPinCurrent = verifySessionPin(pin, testSessionId, 20, testSecret);
assert.strictEqual(verifyPinCurrent.valid, true, 'Current window PIN must verify as valid');

const verifyPinWrong = verifySessionPin('ZZZZZZ', testSessionId, 20, testSecret);
assert.strictEqual(verifyPinWrong.valid, false, 'Incorrect PIN must be rejected');
console.log('✓ Rotating PIN verification and rejection passed.');

// Test 8: Haversine Geofencing Calculations
// Test 8a: Exact same point -> distance must be 0 meters
const distZero = calculateHaversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
assert.strictEqual(distZero, 0, 'Distance between identical points must be 0');

// Test 8b: Close point (~100m)
// 0.0009 degrees latitude is roughly 100 meters
const distClose = calculateHaversineDistance(37.7749, -122.4194, 37.7758, -122.4194);
assert(distClose >= 90 && distClose <= 110, `Expected ~100m, got: ${distClose}m`);

// Test 8c: Distant points (San Francisco to New York: ~4,130 km)
const distFar = calculateHaversineDistance(37.7749, -122.4194, 40.7128, -74.006);
assert(distFar >= 4100000 && distFar <= 4200000, `Expected ~4,130km, got: ${distFar}m`);
console.log('✓ Haversine distance calculations verified: 0m, ~100m, and ~4,130km accurately computed.');

console.log('--- All Phase 2 Anti-Proxy Engine Tests Passed Successfully! ---');
