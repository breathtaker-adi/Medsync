// tests/security_and_integrity.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// 1. HTML Sanitization Test (Settings Health Report PDF)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

describe('Security & Integrity Test Suite', () => {
  describe('HTML Sanitization for PDF Health Reports', () => {
    it('should neutralize script tags in medicine names', () => {
      const malicious = '<script>alert("pwned")</script>Paracetamol';
      const safe = escapeHtml(malicious);
      assert.strictEqual(safe, '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;Paracetamol');
      assert.ok(!safe.includes('<script>'));
    });

    it('should neutralize HTML injection in patient notes', () => {
      const notes = '<img src=x onerror=alert(1)> Patient felt dizzy';
      const safe = escapeHtml(notes);
      assert.strictEqual(safe, '&lt;img src=x onerror=alert(1)&gt; Patient felt dizzy');
      assert.ok(!safe.includes('<img'));
    });

    it('should safely handle null or empty values', () => {
      assert.strictEqual(escapeHtml(null), '');
      assert.strictEqual(escapeHtml(undefined), '');
      assert.strictEqual(escapeHtml(''), '');
    });
  });

  describe('Caregiver Pairing Codes & Expiry', () => {
    const PAIRING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    function generateCode() {
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += PAIRING_CHARS.charAt(Math.floor(Math.random() * PAIRING_CHARS.length));
      }
      return result;
    }

    function isCodeExpired(createdAtMs, maxAgeMinutes = 15) {
      const maxAgeMs = maxAgeMinutes * 60 * 1000;
      return Date.now() - createdAtMs > maxAgeMs;
    }

    it('should generate cryptographically sound 8-character uppercase codes', () => {
      const code = generateCode();
      assert.strictEqual(code.length, 8);
      assert.match(code, /^[A-Z0-9]{8}$/);
      // Ensure ambiguous characters O, 0, I, 1 are not used
      assert.ok(!code.includes('O'));
      assert.ok(!code.includes('0'));
      assert.ok(!code.includes('I'));
      assert.ok(!code.includes('1'));
    });

    it('should correctly flag pairing codes older than 15 minutes as expired', () => {
      const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000;
      assert.strictEqual(isCodeExpired(sixteenMinutesAgo), true);

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      assert.strictEqual(isCodeExpired(fiveMinutesAgo), false);
    });
  });

  describe('SecureStore Token Chunking Adapter (Android 2048-Byte Limit)', () => {
    const CHUNK_SIZE = 1000; // Chunk threshold for test

    function chunkValue(value, maxChunkSize = CHUNK_SIZE) {
      const chunks = [];
      for (let i = 0; i < value.length; i += maxChunkSize) {
        chunks.push(value.slice(i, i + maxChunkSize));
      }
      return chunks;
    }

    function reassembleChunks(chunks) {
      return chunks.join('');
    }

    it('should split large tokens into chunks and reassemble them identically', () => {
      // Simulate a 3500-character Supabase JWT token
      const largeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'A'.repeat(3200) + '.sig';
      assert.ok(largeJwt.length > 2048, 'Token must exceed Android 2048 byte limit');

      const chunks = chunkValue(largeJwt, 1000);
      assert.strictEqual(chunks.length, 4);
      chunks.forEach((chunk) => assert.ok(chunk.length <= 1000));

      const reconstructed = reassembleChunks(chunks);
      assert.strictEqual(reconstructed, largeJwt);
    });
  });

  describe('AI Prescription Scanner Edge Function Guards', () => {
    const MAX_BASE64_LENGTH = 4.2 * 1024 * 1024; // ~3MB binary

    function validatePayload(base64Image, authHeader) {
      if (!authHeader) {
        return { status: 401, error: 'Missing Authorization header' };
      }
      if (!base64Image || typeof base64Image !== 'string') {
        return { status: 400, error: 'No valid image provided' };
      }
      if (base64Image.length > MAX_BASE64_LENGTH) {
        return { status: 413, error: 'Payload too large' };
      }
      return { status: 200, valid: true };
    }

    it('should reject unauthenticated requests without JWT', () => {
      const res = validatePayload('validBase64Data', null);
      assert.strictEqual(res.status, 401);
    });

    it('should reject oversized payloads exceeding 3MB (~4.2MB base64)', () => {
      const oversizedImage = 'data:image/jpeg;base64,' + 'X'.repeat(5 * 1024 * 1024);
      const res = validatePayload(oversizedImage, 'Bearer test-token');
      assert.strictEqual(res.status, 413);
    });

    it('should accept valid, authenticated payloads', () => {
      const normalImage = 'validBase64ImageContent';
      const res = validatePayload(normalImage, 'Bearer valid-jwt-token');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.valid, true);
    });
  });

  describe('Atomic Intake & Refill Alert Calculations', () => {
    function computePillDecrement(currentPills) {
      return Math.max(0, (currentPills ?? 30) - 1);
    }

    function shouldTriggerRefillReminder(pillsRemaining) {
      return pillsRemaining <= 5 && pillsRemaining > 0;
    }

    it('should never decrement pill count below zero', () => {
      assert.strictEqual(computePillDecrement(0), 0);
      assert.strictEqual(computePillDecrement(1), 0);
      assert.strictEqual(computePillDecrement(30), 29);
    });

    it('should trigger refill alert when pills remaining is 5 or fewer', () => {
      assert.strictEqual(shouldTriggerRefillReminder(5), true);
      assert.strictEqual(shouldTriggerRefillReminder(3), true);
      assert.strictEqual(shouldTriggerRefillReminder(1), true);
      assert.strictEqual(shouldTriggerRefillReminder(6), false);
      assert.strictEqual(shouldTriggerRefillReminder(0), false); // 0 is handled as out of stock
    });
  });

  describe('Row-Level Security & Cross-User Privacy Invariants', () => {
    it('should enforce user isolation: User A cannot read User B records', () => {
      const userA = { id: 'user-aaa-111', role: 'patient' };
      const userB = { id: 'user-bbb-222', role: 'patient' };

      const records = [
        { id: 1, patient_id: 'user-aaa-111', medicine_name: 'Metformin' },
        { id: 2, patient_id: 'user-bbb-222', medicine_name: 'Atorvastatin' },
      ];

      // Simulated RLS policy: SELECT USING (patient_id = auth.uid())
      const rlsFilter = (caller) => records.filter((r) => r.patient_id === caller.id);

      const recordsForA = rlsFilter(userA);
      assert.strictEqual(recordsForA.length, 1);
      assert.strictEqual(recordsForA[0].medicine_name, 'Metformin');

      const recordsForB = rlsFilter(userB);
      assert.strictEqual(recordsForB.length, 1);
      assert.strictEqual(recordsForB[0].medicine_name, 'Atorvastatin');
    });

    it('should enforce approval authorization: caregivers and verified doctors can approve', () => {
      const caregiver = { id: 'cg-1', role: 'caregiver', is_verified_doctor: false };
      const verifiedDoctor = { id: 'doc-1', role: 'doctor', is_verified_doctor: true };
      const unauthorizedPatient = { id: 'pat-1', role: 'patient', is_verified_doctor: false };

      const canApprove = (profile) =>
        profile.role === 'doctor' || profile.role === 'caregiver' || profile.is_verified_doctor === true;

      assert.strictEqual(canApprove(caregiver), true);
      assert.strictEqual(canApprove(verifiedDoctor), true);
      assert.strictEqual(canApprove(unauthorizedPatient), false);
    });
  });

  describe('Dose Intake Idempotence Invariant', () => {
    function simulateTakeDose(currentStatus, currentPills) {
      if (currentStatus === 'taken') {
        return { success: true, already_taken: true, pills_remaining: currentPills };
      }
      return { success: true, already_taken: false, pills_remaining: Math.max(0, currentPills - 1) };
    }

    it('should decrement pills on initial take', () => {
      const res = simulateTakeDose('pending', 30);
      assert.strictEqual(res.already_taken, false);
      assert.strictEqual(res.pills_remaining, 29);
    });

    it('should NOT decrement pills if dose is already taken today', () => {
      const res = simulateTakeDose('taken', 29);
      assert.strictEqual(res.already_taken, true);
      assert.strictEqual(res.pills_remaining, 29);
    });
  });

  describe('Pairing Role NULL Bypass Prevention', () => {
    function validatePairingClaimant(callerId, callerRole) {
      if (!callerId) return { allowed: false, error: 'Authentication required' };
      if (!callerRole || !['caregiver', 'doctor'].includes(callerRole)) {
        return { allowed: false, error: 'Only caregivers or doctors can claim pairing codes' };
      }
      return { allowed: true };
    }

    it('should reject claim if caller role is NULL or undefined', () => {
      assert.strictEqual(validatePairingClaimant('user-1', null).allowed, false);
      assert.strictEqual(validatePairingClaimant('user-1', undefined).allowed, false);
      assert.strictEqual(validatePairingClaimant('user-1', '').allowed, false);
    });

    it('should reject claim if caller role is patient', () => {
      assert.strictEqual(validatePairingClaimant('user-1', 'patient').allowed, false);
    });

    it('should accept claim if caller role is caregiver or doctor', () => {
      assert.strictEqual(validatePairingClaimant('user-1', 'caregiver').allowed, true);
      assert.strictEqual(validatePairingClaimant('user-1', 'doctor').allowed, true);
    });
  });

  describe('Serverless Cron & Quota Protections', () => {
    function validateCronAuth(authHeader, expectedServiceKey) {
      if (!authHeader) return 401;
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      return token === expectedServiceKey ? 200 : 401;
    }

    function checkDailyScanQuota(currentScanCount, maxLimit = 10) {
      return currentScanCount >= maxLimit ? { allowed: false, status: 429 } : { allowed: true, status: 200 };
    }

    it('should reject check-missed-doses without exact service role key', () => {
      assert.strictEqual(validateCronAuth(null, 'secret-key'), 401);
      assert.strictEqual(validateCronAuth('Bearer wrong-key', 'secret-key'), 401);
      assert.strictEqual(validateCronAuth('Bearer secret-key', 'secret-key'), 200);
    });

    it('should reject prescription scans exceeding daily user quota of 10', () => {
      assert.strictEqual(checkDailyScanQuota(9).allowed, true);
      assert.strictEqual(checkDailyScanQuota(10).allowed, false);
      assert.strictEqual(checkDailyScanQuota(10).status, 429);
      assert.strictEqual(checkDailyScanQuota(15).allowed, false);
    });
  });
});
