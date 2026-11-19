import assert from 'node:assert';

console.log('--- Running Phase 3 Analytics, 75% Calculator & Spot-Audit Tests ---');

// 1. Exact 75% Attendance Compliance Functions
function calculateAttendanceMetrics(attended: number, total: number) {
  if (total === 0) {
    return {
      percentage: 100,
      belowThreshold: false,
      canMiss: 0,
      mustAttend: 0,
    };
  }

  const percentage = Math.round((attended / total) * 1000) / 10;
  const belowThreshold = attended / total < 0.75;

  let canMiss = 0;
  let mustAttend = 0;

  if (!belowThreshold) {
    canMiss = Math.max(0, Math.floor((4 * attended - 3 * total) / 3));
    mustAttend = 0;
  } else {
    mustAttend = Math.max(1, Math.ceil(3 * total - 4 * attended));
    canMiss = 0;
  }

  return { percentage, belowThreshold, canMiss, mustAttend };
}

// Test 1: Specified user test cases
console.log('Test 1: Specified 75% attendance scenarios');

// Case 1.1: A = 8, T = 10 (80.0%) -> canMiss = 0, mustAttend = 0
const r1 = calculateAttendanceMetrics(8, 10);
assert.strictEqual(r1.percentage, 80.0);
assert.strictEqual(r1.belowThreshold, false);
assert.strictEqual(r1.canMiss, 0, 'A=8, T=10 canMiss must be 0');
assert.strictEqual(r1.mustAttend, 0);
console.log('✓ A=8, T=10 passed: canMiss = 0, mustAttend = 0');

// Case 1.2: A = 10, T = 10 (100.0%) -> canMiss = 3, mustAttend = 0
const r2 = calculateAttendanceMetrics(10, 10);
assert.strictEqual(r2.percentage, 100.0);
assert.strictEqual(r2.belowThreshold, false);
assert.strictEqual(r2.canMiss, 3, 'A=10, T=10 canMiss must be 3');
assert.strictEqual(r2.mustAttend, 0);
console.log('✓ A=10, T=10 passed: canMiss = 3, mustAttend = 0');

// Case 1.3: A = 6, T = 10 (60.0%) -> canMiss = 0, mustAttend = 6
const r3 = calculateAttendanceMetrics(6, 10);
assert.strictEqual(r3.percentage, 60.0);
assert.strictEqual(r3.belowThreshold, true);
assert.strictEqual(r3.canMiss, 0);
assert.strictEqual(r3.mustAttend, 6, 'A=6, T=10 mustAttend must be 6');
console.log('✓ A=6, T=10 passed: canMiss = 0, mustAttend = 6');

// Case 1.4: A = 4, T = 10 (40.0%) -> canMiss = 0, mustAttend = 14
const r4 = calculateAttendanceMetrics(4, 10);
assert.strictEqual(r4.percentage, 40.0);
assert.strictEqual(r4.belowThreshold, true);
assert.strictEqual(r4.canMiss, 0);
assert.strictEqual(r4.mustAttend, 14, 'A=4, T=10 mustAttend must be 14');
console.log('✓ A=4, T=10 passed: canMiss = 0, mustAttend = 14');

// Case 1.5: T = 0 -> canMiss = 0, mustAttend = 0, percentage = 100
const r5 = calculateAttendanceMetrics(0, 0);
assert.strictEqual(r5.percentage, 100);
assert.strictEqual(r5.belowThreshold, false);
assert.strictEqual(r5.canMiss, 0);
assert.strictEqual(r5.mustAttend, 0);
console.log('✓ T=0 passed: canMiss = 0, mustAttend = 0');

// Test 2: Mathematical Invariance Proof Tests
console.log('Test 2: Mathematical invariance proofs');

// When canMiss > 0:
// Missing `canMiss` classes must leave attendance >= 75%
// Missing `canMiss + 1` classes must drop attendance < 75%
for (let T = 1; T <= 50; T++) {
  for (let A = 0; A <= T; A++) {
    const { belowThreshold, canMiss, mustAttend } = calculateAttendanceMetrics(A, T);
    if (!belowThreshold && canMiss > 0) {
      const allowedPct = A / (T + canMiss);
      assert(
        allowedPct >= 0.75,
        `Invariance violated: A=${A}, T=${T}, canMiss=${canMiss} resulted in ${allowedPct} < 0.75`
      );

      const exceededPct = A / (T + canMiss + 1);
      assert(
        exceededPct < 0.75,
        `Invariance violated: A=${A}, T=${T}, canMiss+1=${canMiss + 1} resulted in ${exceededPct} >= 0.75`
      );
    }

    if (belowThreshold) {
      const recoveredPct = (A + mustAttend) / (T + mustAttend);
      assert(
        recoveredPct >= 0.75,
        `Invariance violated: A=${A}, T=${T}, mustAttend=${mustAttend} resulted in ${recoveredPct} < 0.75`
      );

      if (mustAttend > 1) {
        const notQuitePct = (A + mustAttend - 1) / (T + mustAttend - 1);
        assert(
          notQuitePct < 0.75,
          `Invariance violated: A=${A}, T=${T}, mustAttend-1=${mustAttend - 1} resulted in ${notQuitePct} >= 0.75`
        );
      }
    }
  }
}
console.log('✓ Mathematical invariance verified across 1,275 attendance permutations.');

// Test 3: Random Spot-Audit Sampling Logic
console.log('Test 3: Random Spot-Audit sampling logic');

interface StudentRecord {
  studentId: string;
  studentName: string;
  status: 'present' | 'late' | 'absent' | 'flagged';
}

function sampleSpotAuditCandidates(records: StudentRecord[], maxSamples = 5): StudentRecord[] {
  // Must only sample from students marked present or late
  const eligible = records.filter((r) => r.status === 'present' || r.status === 'late');
  if (eligible.length <= maxSamples) {
    return [...eligible];
  }

  // Shuffle copy using Fisher-Yates and slice
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxSamples);
}

// 3.1: Empty roster
assert.deepStrictEqual(sampleSpotAuditCandidates([]), []);

// 3.2: 3 present, 2 absent
const testRoster1: StudentRecord[] = [
  { studentId: 's1', studentName: 'Alice', status: 'present' },
  { studentId: 's2', studentName: 'Bob', status: 'late' },
  { studentId: 's3', studentName: 'Charlie', status: 'present' },
  { studentId: 's4', studentName: 'Dave', status: 'absent' },
  { studentId: 's5', studentName: 'Eve', status: 'flagged' },
];
const sampled1 = sampleSpotAuditCandidates(testRoster1);
assert.strictEqual(sampled1.length, 3, 'Should select all 3 present/late students');
assert(!sampled1.some((s) => s.status === 'absent' || s.status === 'flagged'), 'Must never select absent or flagged students');

// 3.3: 20 present students
const testRoster2: StudentRecord[] = Array.from({ length: 20 }, (_, i) => ({
  studentId: `s_${i}`,
  studentName: `Student ${i}`,
  status: i % 2 === 0 ? 'present' : 'late',
}));
const sampled2 = sampleSpotAuditCandidates(testRoster2, 5);
assert.strictEqual(sampled2.length, 5, 'Should select exactly 5 candidates');
const uniqueIds = new Set(sampled2.map((s) => s.studentId));
assert.strictEqual(uniqueIds.size, 5, 'Selected students must all be unique');
console.log('✓ Spot-audit sampling passed: exact pool filtering and uniqueness verified.');

// Test 4: Counter transitions & flaggedCount ?? 0 safety
console.log('Test 4: Counter transition safety');

interface SessionCounters {
  presentCount?: number;
  lateCount?: number;
  absentCount?: number;
  flaggedCount?: number;
}

function applySpotAuditFlag(session: SessionCounters, currentRecordStatus: 'present' | 'late'): SessionCounters {
  const updated: SessionCounters = { ...session };
  if (currentRecordStatus === 'present') {
    updated.presentCount = Math.max(0, (session.presentCount || 0) - 1);
  } else if (currentRecordStatus === 'late') {
    updated.lateCount = Math.max(0, (session.lateCount || 0) - 1);
  }
  // Safe default ?? 0 prevents NaN on older sessions lacking flaggedCount
  updated.flaggedCount = (session.flaggedCount ?? 0) + 1;
  return updated;
}

// Session from Phase 2 without flaggedCount field
const legacySession: SessionCounters = {
  presentCount: 15,
  lateCount: 2,
  absentCount: 3,
};

const updatedLegacy = applySpotAuditFlag(legacySession, 'present');
assert.strictEqual(updatedLegacy.presentCount, 14);
assert.strictEqual(updatedLegacy.flaggedCount, 1);
assert(!Number.isNaN(updatedLegacy.flaggedCount), 'flaggedCount must never be NaN');
console.log('✓ Counter transition passed: legacy session handled safely without NaN.');

// Test 5: CSV Line Formatting & Escaping
console.log('Test 5: Attendance CSV Export Formatting');

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function generateCsvRow(fields: any[]): string {
  return fields.map(escapeCsvCell).join(',');
}

const headerRow = generateCsvRow([
  'Roll Number',
  'Student Name',
  'Email',
  'Attended Sessions',
  'Total Sessions',
  'Attendance %',
  'Compliance Status',
]);

assert.strictEqual(
  headerRow,
  '"Roll Number","Student Name","Email","Attended Sessions","Total Sessions","Attendance %","Compliance Status"'
);

const studentRow = generateCsvRow([
  'CS-2024-042',
  'Doe, Jane "JD"',
  'jane.doe@university.edu',
  18,
  20,
  '90.0%',
  'Eligible (>=75%)',
]);

assert.strictEqual(
  studentRow,
  '"CS-2024-042","Doe, Jane ""JD""","jane.doe@university.edu","18","20","90.0%","Eligible (>=75%)"'
);
console.log('✓ CSV escaping and row generation verified.');

console.log('--- All Phase 3 Unit & Algorithm Tests Passed! ---');
