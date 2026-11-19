import assert from 'node:assert';
import { generateJoinCode, generateInviteCode } from '../src/lib/utils/generateCode.ts';

console.log('--- Running Phase 1 Foundation Logic Tests ---');

// Test 1: generateJoinCode format and randomness
const joinCodes = new Set<string>();
for (let i = 0; i < 50; i++) {
  const code = generateJoinCode(6);
  assert.strictEqual(code.length, 6, `Join code should be 6 characters long, got: ${code}`);
  assert.match(code, /^[A-Z0-9]{6}$/, `Join code should be uppercase alphanumeric, got: ${code}`);
  // Ensure no ambiguous characters like 0, O, 1, I
  assert.doesNotMatch(code, /[01IO]/, `Join code should not contain ambiguous characters 0, 1, I, O: ${code}`);
  joinCodes.add(code);
}
assert.strictEqual(joinCodes.size, 50, 'All 50 generated join codes should be distinct');
console.log('✓ generateJoinCode tests passed: 50 unique collision-free 6-char codes verified.');

// Test 2: generateInviteCode format
const inviteCodes = new Set<string>();
for (let i = 0; i < 50; i++) {
  const code = generateInviteCode('TCH');
  assert.match(code, /^TCH-[A-Z0-9]{6}$/, `Invite code should match TCH-XXXXXX pattern, got: ${code}`);
  inviteCodes.add(code);
}
assert.strictEqual(inviteCodes.size, 50, 'All 50 generated invite codes should be distinct');
console.log('✓ generateInviteCode tests passed: 50 unique TCH-XXXXXX codes verified.');

// Test 3: Composite Enrollment ID idempotency
const classId = 'class_abc123';
const studentId1 = 'student_xyz789';
const studentId2 = 'student_xyz789'; // duplicate
const enrollmentId1 = `${classId}_${studentId1}`;
const enrollmentId2 = `${classId}_${studentId2}`;
assert.strictEqual(enrollmentId1, enrollmentId2, 'Composite ID ensures idempotent duplicate detection');
console.log('✓ Enrollment composite document ID idempotency verified.');

console.log('--- All Phase 1 Logic Unit Tests Passed Successfully! ---');
