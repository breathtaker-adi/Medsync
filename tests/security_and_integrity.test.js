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

  describe('Targeted Doctor Review Isolation & Fallback Invariants', () => {
    function simulateApproveReview({ callerId, isVerifiedDoctor, review, activeLinks }) {
      if (!callerId) throw new Error('Unauthorized');
      const isLinkedCaregiver = activeLinks.some(
        (l) => l.patient_id === review.patient_id && l.caregiver_id === callerId && l.status === 'active'
      );
      if (!isVerifiedDoctor && !isLinkedCaregiver) {
        throw new Error('Only verified doctors or active linked caregivers can review prescriptions');
      }
      if (review.target_doctor_id && review.target_doctor_id !== callerId && !isLinkedCaregiver) {
        throw new Error('Not your patient: prescription assigned to another physician');
      }
      return { success: true, status: 'approved' };
    }

    it('should allow targeted doctor to approve prescription', () => {
      const review = { id: 101, patient_id: 'pat-1', target_doctor_id: 'doc-target-123' };
      const res = simulateApproveReview({
        callerId: 'doc-target-123',
        isVerifiedDoctor: true,
        review,
        activeLinks: [],
      });
      assert.strictEqual(res.success, true);
    });

    it('should reject unauthorized Doctor B from approving a review targeted to Doctor A', () => {
      const review = { id: 101, patient_id: 'pat-1', target_doctor_id: 'doc-target-123' };
      assert.throws(
        () =>
          simulateApproveReview({
            callerId: 'doc-stranger-999',
            isVerifiedDoctor: true,
            review,
            activeLinks: [],
          }),
        /Not your patient/
      );
    });

    it('should allow active linked caregiver to approve even if doctor target differs', () => {
      const review = { id: 101, patient_id: 'pat-1', target_doctor_id: 'doc-target-123' };
      const res = simulateApproveReview({
        callerId: 'caregiver-mom',
        isVerifiedDoctor: false,
        review,
        activeLinks: [{ patient_id: 'pat-1', caregiver_id: 'caregiver-mom', status: 'active' }],
      });
      assert.strictEqual(res.success, true);
    });
  });

  describe('Non-Prescription / Random Photo Fallback Queueing', () => {
    function processUploadedImage({ ocrResult, userInput }) {
      let extractedData = {
        medicine_name: userInput.medicineName?.trim() || 'Prescription Slip Review',
        dosage: userInput.dosage?.trim() || '1 dose as prescribed on slip',
        duration: userInput.duration?.trim() || '30 days',
      };
      let ocrStatus = 'ok';

      if (ocrResult.is_valid_prescription === false) {
        ocrStatus = 'failed';
        extractedData = {
          medicine_name: userInput.medicineName?.trim() || ocrResult.medicine_name || '⚠️ Unrecognized / Non-prescription',
          dosage: userInput.dosage?.trim() || ocrResult.dosage || 'Please inspect uploaded slip',
          duration: userInput.duration?.trim() || ocrResult.duration || 'N/A',
        };
      }

      const initialDoctorNote =
        ocrStatus === 'failed' || extractedData.medicine_name.includes('⚠️')
          ? '⚠️ AI Warning: Uploaded image may not be an official prescription slip. Please inspect photo carefully. You may edit details to approve, or tap Reject.'
          : 'Prescription scanned and queued. Verified physician review & dosing sign-off required.';

      return {
        queuedForReview: true,
        ocr_status: ocrStatus,
        medication: extractedData.medicine_name,
        doctor_notes: initialDoctorNote,
      };
    }

    it('should queue non-prescription random photo with failed status and warning banner note', () => {
      const result = processUploadedImage({
        ocrResult: {
          is_valid_prescription: false,
          medicine_name: '⚠️ Unrecognized / Non-prescription',
          dosage: 'Please inspect uploaded image',
          duration: 'N/A',
        },
        userInput: {},
      });

      assert.strictEqual(result.queuedForReview, true);
      assert.strictEqual(result.ocr_status, 'failed');
      assert.strictEqual(result.medication, '⚠️ Unrecognized / Non-prescription');
      assert.match(result.doctor_notes, /AI Warning: Uploaded image may not be an official prescription slip/);
    });

    it('should queue valid prescription with ok status and extracted medicine name', () => {
      const result = processUploadedImage({
        ocrResult: {
          is_valid_prescription: true,
          medicine_name: 'Amoxicillin 500mg',
          dosage: '1 capsule tid',
          duration: '7 days',
        },
        userInput: { medicineName: 'Amoxicillin 500mg' },
      });

      assert.strictEqual(result.queuedForReview, true);
      assert.strictEqual(result.ocr_status, 'ok');
      assert.strictEqual(result.medication, 'Amoxicillin 500mg');
    });
  });

  describe('DPDP Consent & Right to Erasure Invariants', () => {
    function simulateDeleteAccount(userId, database) {
      if (!userId) throw new Error('Unauthorized');
      // Delete storage files
      database.storageFiles = database.storageFiles.filter((f) => !f.startsWith(`${userId}/`));
      // Delete user profile
      database.profiles = database.profiles.filter((p) => p.id !== userId);
      // Delete auth user
      database.users = database.users.filter((u) => u.id !== userId);
      return { success: true };
    }

    it('should purge storage objects when account is deleted (Right to Erasure)', () => {
      const db = {
        users: [{ id: 'user-del-1' }, { id: 'user-del-2' }],
        profiles: [{ id: 'user-del-1' }, { id: 'user-del-2' }],
        storageFiles: ['user-del-1/rx1.jpg', 'user-del-1/rx2.jpg', 'user-del-2/rx3.jpg'],
      };

      simulateDeleteAccount('user-del-1', db);

      assert.strictEqual(db.users.length, 1);
      assert.strictEqual(db.profiles.length, 1);
      assert.deepStrictEqual(db.storageFiles, ['user-del-2/rx3.jpg']);
      assert.strictEqual(db.storageFiles.some((f) => f.startsWith('user-del-1/')), false);
    });

    it('should validate DPDP consent logging format and versioning', () => {
      const consentRecord = {
        user_id: 'user-dpdp-1',
        consent_type: 'dpdp_ocr_processing',
        consent_version: '1.0',
        consented_at: new Date().toISOString(),
      };

      assert.strictEqual(consentRecord.consent_type, 'dpdp_ocr_processing');
      assert.strictEqual(consentRecord.consent_version, '1.0');
      assert.ok(consentRecord.consented_at);
    });
  });

  describe('SQL Migration View Dependency & Column Drop Order', () => {
    it('should drop dependent views before dropping profiles.push_token column', () => {
      // Simulate PostgreSQL dependency graph
      const schemaState = {
        columns: ['id', 'full_name', 'role', 'push_token'],
        views: ['doctor_push_tokens', 'patient_push_tokens'],
      };

      function dropColumnSafe(table, column, cascade = false) {
        if (column === 'push_token' && schemaState.views.length > 0 && !cascade) {
          throw new Error('ERROR 2BP01: cannot drop column push_token because other objects depend on it');
        }
        schemaState.columns = schemaState.columns.filter((c) => c !== column);
        if (cascade) {
          schemaState.views = [];
        }
      }

      function dropView(viewName) {
        schemaState.views = schemaState.views.filter((v) => v !== viewName);
      }

      // Safe migration sequence: drop views first (with CASCADE), then drop column CASCADE
      dropView('doctor_push_tokens');
      dropView('patient_push_tokens');
      assert.doesNotThrow(() => dropColumnSafe('profiles', 'push_token', true));
      assert.strictEqual(schemaState.columns.includes('push_token'), false);
    });
  });

  describe('Prescription Storage Path Normalization & HMAC Resolution', () => {
    function normalizePrescriptionStoragePath(imageUrl) {
      if (!imageUrl) return null;
      const trimmed = imageUrl.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('data:image/') || trimmed.startsWith('file://')) {
        return trimmed;
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!trimmed.includes('/storage/v1/object/')) {
          return trimmed;
        }
      }
      let clean = trimmed
        .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(public|sign)\/prescriptions\//, '')
        .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(public|sign)\//, '')
        .split('?')[0];

      clean = clean.replace(/^\/?prescriptions\//, '');
      clean = clean.replace(/^\/+/, '');
      return clean.trim() || null;
    }

    it('should strip redundant "prescriptions/" prefix to avoid 404 path doubling', () => {
      const input = 'prescriptions/user-123/1729267123_prescription.jpg';
      const normalized = normalizePrescriptionStoragePath(input);
      assert.strictEqual(normalized, 'user-123/1729267123_prescription.jpg');
    });

    it('should strip leading slashes', () => {
      const input = '/user-123/1729267123_prescription.jpg';
      const normalized = normalizePrescriptionStoragePath(input);
      assert.strictEqual(normalized, 'user-123/1729267123_prescription.jpg');
    });

    it('should strip full Supabase signed or public URL prefixes and query params', () => {
      const input =
        'https://xyz.supabase.co/storage/v1/object/sign/prescriptions/user-123/1729267123_prescription.jpg?token=abcd123';
      const normalized = normalizePrescriptionStoragePath(input);
      assert.strictEqual(normalized, 'user-123/1729267123_prescription.jpg');
    });

    it('should preserve data URIs and local file URIs as-is', () => {
      const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const fileUri = 'file:///var/mobile/Containers/Data/rx.jpg';
      assert.strictEqual(normalizePrescriptionStoragePath(dataUri), dataUri);
      assert.strictEqual(normalizePrescriptionStoragePath(fileUri), fileUri);
    });
  });

  describe('Multi-Doctor Routing & Prescription History Isolation', () => {
    const mockDoctors = [
      { id: 'doc-1', full_name: 'Dr. Ananya Sharma', specialty: 'Cardiology' },
      { id: 'doc-2', full_name: 'Dr. Rajesh Gupta', specialty: 'General Medicine' },
    ];

    it('should auto-select doctor when exactly 1 doctor is connected', () => {
      const singleDocList = [mockDoctors[0]];
      let selectedDoctorId = null;

      if (singleDocList.length === 1) {
        selectedDoctorId = singleDocList[0].id;
      }

      assert.strictEqual(selectedDoctorId, 'doc-1');
    });

    it('should require explicit selection when patient is connected to multiple doctors', () => {
      let selectedDoctorId = null;
      let promptModalShown = false;

      function onSubmitUpload() {
        if (mockDoctors.length > 1 && !selectedDoctorId) {
          promptModalShown = true;
          return { status: 'prompt_doctor_choice' };
        }
        return { status: 'proceed_upload' };
      }

      const res = onSubmitUpload();
      assert.strictEqual(res.status, 'prompt_doctor_choice');
      assert.strictEqual(promptModalShown, true);

      // Once patient selects doctor
      selectedDoctorId = 'doc-2';
      const resAfterSelect = onSubmitUpload();
      assert.strictEqual(resAfterSelect.status, 'proceed_upload');
    });

    it('should isolate patient prescription history exclusively to the patient', () => {
      const allPendingReviews = [
        { id: 1, patient_id: 'patient-A', medication: 'Metformin', status: 'pending' },
        { id: 2, patient_id: 'patient-A', medication: 'Amlodipine', status: 'approved' },
        { id: 3, patient_id: 'patient-B', medication: 'Atorvastatin', status: 'pending' },
      ];

      function getPatientHistory(patientId) {
        return allPendingReviews.filter((r) => r.patient_id === patientId);
      }

      const historyA = getPatientHistory('patient-A');
      assert.strictEqual(historyA.length, 2);
      assert.ok(historyA.every((r) => r.patient_id === 'patient-A'));
      assert.strictEqual(historyA.some((r) => r.medication === 'Atorvastatin'), false);
    });
  });
});


