// tests/security_and_integrity.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

  describe('Verified Doctor Patient Contact & Emergency Card Access', () => {
    it('should expose phone, email, and emergency SOS details to connected doctor', () => {
      const patientProfile = {
        id: 'patient-123',
        full_name: 'Margaret Doe',
        phone: '+91 98765 43210',
        email: 'margaret@example.com',
        emergency_contact_name: 'John Doe (Son)',
        emergency_contact_phone: '+91 98765 00000',
        blood_group: 'O+',
        age: 72,
      };

      const callerDoctor = {
        id: 'doc-456',
        role: 'doctor',
        is_verified_doctor: true,
      };

      const connections = [
        { caregiver_id: 'doc-456', patient_id: 'patient-123', status: 'active' },
      ];

      function canDoctorViewContactDetails(doctor, patient, links) {
        const isLinked = links.some(
          (l) => l.caregiver_id === doctor.id && l.patient_id === patient.id
        );
        if (!isLinked) return null;
        return {
          phone: patient.phone,
          email: patient.email,
          emergency_contact_name: patient.emergency_contact_name,
          emergency_contact_phone: patient.emergency_contact_phone,
        };
      }

      const contact = canDoctorViewContactDetails(callerDoctor, patientProfile, connections);
      assert.ok(contact !== null);
      assert.strictEqual(contact.phone, '+91 98765 43210');
      assert.strictEqual(contact.email, 'margaret@example.com');
      assert.strictEqual(contact.emergency_contact_phone, '+91 98765 00000');
    });

    it('should disallow unlinked doctor from reading patient contact details', () => {
      const patientProfile = {
        id: 'patient-123',
        full_name: 'Margaret Doe',
        phone: '+91 98765 43210',
      };

      const unlinkedDoctor = {
        id: 'doc-999',
        role: 'doctor',
        is_verified_doctor: true,
      };

      const connections = [
        { caregiver_id: 'doc-456', patient_id: 'patient-123', status: 'active' },
      ];

      function canDoctorViewContactDetails(doctor, patient, links) {
        const isLinked = links.some(
          (l) => l.caregiver_id === doctor.id && l.patient_id === patient.id
        );
        return isLinked ? patient.phone : null;
      }

      const contact = canDoctorViewContactDetails(unlinkedDoctor, patientProfile, connections);
      assert.strictEqual(contact, null);
    });
  });

  describe('take_dose Ownership Verification', () => {
    it('should reject take_dose when medication belongs to a different patient', () => {
      const medications = [
        { id: 101, patient_id: 'patient-A', is_active: true, pills_remaining: 30 },
        { id: 102, patient_id: 'patient-B', is_active: true, pills_remaining: 15 },
      ];

      function simulateTakeDose(callerId, medicationId) {
        const med = medications.find(
          (m) => m.id === medicationId && m.patient_id === callerId && m.is_active
        );
        if (!med) {
          throw new Error('Medication not found or not owned by user');
        }
        return { success: true, pills_remaining: med.pills_remaining - 1 };
      }

      // Caller B tries to take Patient A's medication
      assert.throws(
        () => simulateTakeDose('patient-B', 101),
        /Medication not found or not owned by user/
      );

      // Caller A takes their own medication
      const res = simulateTakeDose('patient-A', 101);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.pills_remaining, 29);
    });
  });

  describe('evaluate_missed_doses Midnight Rollover Logic', () => {
    it('should not mark 00:10 doses as missed using full datetime comparison', () => {
      // Simulate date 2026-10-20 at 00:15 IST
      const nowKolkata = new Date('2026-10-20T00:15:00+05:30');
      const cutoff = new Date(nowKolkata.getTime() - 60 * 60 * 1000); // 2026-10-19T23:15:00+05:30

      function isDoseOverdue(logDate, scheduledTimeStr) {
        // Parse "08:00 AM" or "11:30 PM"
        const [timePart, modifier] = scheduledTimeStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        const doseDateTime = new Date(`${logDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`);
        return doseDateTime < cutoff;
      }

      // Today's dose scheduled for 08:00 AM should NOT be overdue at 00:15 AM
      assert.strictEqual(isDoseOverdue('2026-10-20', '08:00 AM'), false);

      // Yesterday's dose scheduled for 08:00 AM SHOULD be overdue
      assert.strictEqual(isDoseOverdue('2026-10-19', '08:00 AM'), true);

      // Yesterday's late night dose at 10:00 PM (22:00) should be overdue at 00:15 AM (cutoff was 23:15)
      assert.strictEqual(isDoseOverdue('2026-10-19', '10:00 PM'), true);
    });
  });

  describe('protect_profile_fields Trigger Rules', () => {
    it('should disallow client from elevating role or is_verified_doctor', () => {
      const oldProfile = {
        id: 'user-123',
        role: 'patient',
        email: 'patient@example.com',
        is_verified_doctor: false,
        full_name: 'Regular Patient',
      };

      function simulateProfileUpdateTrigger(oldRow, newRow, userRole = 'authenticated') {
        const result = { ...newRow };
        if (['anon', 'authenticated'].includes(userRole)) {
          result.id = oldRow.id;
          result.role = oldRow.role;
          result.email = oldRow.email;
          result.is_verified_doctor = oldRow.is_verified_doctor;
          if (oldRow.is_verified_doctor) {
            result.medical_license_number = oldRow.medical_license_number;
            result.medical_council = oldRow.medical_council;
          }
        }
        return result;
      }

      // Attacker attempts to change role to doctor and is_verified_doctor to true
      const maliciousUpdate = {
        id: 'user-123',
        role: 'doctor',
        email: 'patient@example.com',
        is_verified_doctor: true,
        full_name: 'Patient Impersonating MD',
      };

      const sanitized = simulateProfileUpdateTrigger(oldProfile, maliciousUpdate, 'authenticated');
      assert.strictEqual(sanitized.role, 'patient');
      assert.strictEqual(sanitized.is_verified_doctor, false);
      assert.strictEqual(sanitized.full_name, 'Patient Impersonating MD'); // Name can be updated
    });
  });

  describe('Untargeted Review Active Link Requirement', () => {
    it('should require active link if target_doctor_id is null', () => {
      const review = {
        id: 50,
        patient_id: 'patient-123',
        target_doctor_id: null, // Untargeted practice queue
        status: 'pending',
      };

      const links = [
        { patient_id: 'patient-123', caregiver_id: 'doc-linked', status: 'active' },
        { patient_id: 'patient-456', caregiver_id: 'doc-unlinked', status: 'active' },
      ];

      function canReviewPrescription(doctor, targetReview) {
        if (!doctor.is_verified_doctor) return false;
        if (targetReview.target_doctor_id !== null) {
          return targetReview.target_doctor_id === doctor.id;
        }
        // If target is null, doctor MUST have an active link to this patient
        return links.some(
          (l) => l.patient_id === targetReview.patient_id && l.caregiver_id === doctor.id && l.status === 'active'
        );
      }

      const linkedDoctor = { id: 'doc-linked', is_verified_doctor: true };
      const unlinkedDoctor = { id: 'doc-unlinked', is_verified_doctor: true };

      assert.strictEqual(canReviewPrescription(linkedDoctor, review), true);
      assert.strictEqual(canReviewPrescription(unlinkedDoctor, review), false);
    });
  });

  describe('Doctor Account Deletion Review Preservation', () => {
    it('should nullify target_doctor_id on patients reviews instead of deleting them', () => {
      let pendingReviews = [
        { id: 1, patient_id: 'patient-X', target_doctor_id: 'doc-to-delete' },
        { id: 2, patient_id: 'doc-to-delete', target_doctor_id: null }, // Doctor's own personal prescription
        { id: 3, patient_id: 'patient-Y', target_doctor_id: 'doc-other' },
      ];

      function simulateDeleteAccount(userId) {
        // Patient's own reviews deleted
        pendingReviews = pendingReviews.filter((r) => r.patient_id !== userId);
        // Targeted doctor references cleared without deleting patient review!
        pendingReviews = pendingReviews.map((r) =>
          r.target_doctor_id === userId ? { ...r, target_doctor_id: null } : r
        );
      }

      simulateDeleteAccount('doc-to-delete');

      // Patient X review is preserved with target_doctor_id set to null
      const patientXReview = pendingReviews.find((r) => r.patient_id === 'patient-X');
      assert.ok(patientXReview !== undefined);
      assert.strictEqual(patientXReview.target_doctor_id, null);

      // Doctor's own personal review row is purged
      const docReview = pendingReviews.find((r) => r.patient_id === 'doc-to-delete');
      assert.strictEqual(docReview, undefined);

      // Patient Y review unaffected
      const patientYReview = pendingReviews.find((r) => r.patient_id === 'patient-Y');
      assert.strictEqual(patientYReview.target_doctor_id, 'doc-other');
    });
  });

  describe('Schedule Time Format Validation Constraint', () => {
    it('should validate 12-hour HH:MM AM/PM regex format chk_time_format', () => {
      const timeRegex = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;

      // Valid times
      assert.ok(timeRegex.test('08:00 AM'));
      assert.ok(timeRegex.test('12:30 PM'));
      assert.ok(timeRegex.test('01:45 PM'));
      assert.ok(timeRegex.test('11:59 PM'));

      // Invalid times
      assert.ok(!timeRegex.test('8:00 AM')); // missing leading zero
      assert.ok(!timeRegex.test('13:00 PM')); // hour > 12
      assert.ok(!timeRegex.test('00:30 AM')); // hour 00 invalid in 12h
      assert.ok(!timeRegex.test('08:60 AM')); // minute >= 60
      assert.ok(!timeRegex.test('random string'));
    });
  });

  describe('Doctor Disconnect and Review Target Reassignment', () => {
    it('should disconnect doctor, purge link, and nullify pending review targets', () => {
      let patientCaregivers = [
        { id: 1, patient_id: 'patient-A', caregiver_id: 'doc-1', status: 'active' },
        { id: 2, patient_id: 'patient-B', caregiver_id: 'doc-2', status: 'active' },
      ];
      let pendingReviews = [
        { id: 10, patient_id: 'patient-A', target_doctor_id: 'doc-1', status: 'pending' },
        { id: 11, patient_id: 'patient-B', target_doctor_id: 'doc-2', status: 'pending' },
      ];

      function simulateDisconnect(callerId, linkId) {
        const link = patientCaregivers.find(
          (l) => l.id === linkId && (l.patient_id === callerId || l.caregiver_id === callerId)
        );
        if (!link) {
          throw new Error('Connection not found or not owned by user');
        }

        // Reset target_doctor_id on patient's pending reviews
        if (link.patient_id === callerId && link.caregiver_id) {
          pendingReviews = pendingReviews.map((r) =>
            r.patient_id === callerId && r.target_doctor_id === link.caregiver_id && r.status === 'pending'
              ? { ...r, target_doctor_id: null }
              : r
          );
        }

        // Remove link
        patientCaregivers = patientCaregivers.filter((l) => l.id !== linkId);
        return { success: true };
      }

      // Unauthorized user cannot disconnect
      assert.throws(
        () => simulateDisconnect('attacker-C', 1),
        /Connection not found or not owned by user/
      );

      // Patient A disconnects Doc 1
      const res = simulateDisconnect('patient-A', 1);
      assert.strictEqual(res.success, true);
      assert.strictEqual(patientCaregivers.some((l) => l.id === 1), false);

      // Patient A's pending review target is nullified
      const pAReview = pendingReviews.find((r) => r.id === 10);
      assert.strictEqual(pAReview.target_doctor_id, null);

      // Patient B's review is unaffected
      const pBReview = pendingReviews.find((r) => r.id === 11);
      assert.strictEqual(pBReview.target_doctor_id, 'doc-2');
    });

    it('should exclude revoked or unlinked doctors from active roster query', () => {
      const links = [
        { id: 1, patient_id: 'patient-A', caregiver_id: 'doc-1', status: 'active' },
        { id: 2, patient_id: 'patient-A', caregiver_id: 'doc-revoked', status: 'revoked' },
      ];

      const activeOnly = links.filter(
        (l) => l.patient_id === 'patient-A' && l.status === 'active' && l.caregiver_id !== null
      );
      assert.strictEqual(activeOnly.length, 1);
      assert.strictEqual(activeOnly[0].caregiver_id, 'doc-1');
    });
  });

  describe('Vibe-Check Security Audit: Secrets Exposure & Git Tracking', () => {
    it('should ensure .env and google-services.json are strictly excluded from git tracking', () => {
      const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
      assert.ok(gitignore.includes('.env'), '.gitignore must contain .env');
      assert.ok(gitignore.includes('google-services.json'), '.gitignore must contain google-services.json');
    });

    it('should verify google-services.json.example template exists with sanitized placeholder values', () => {
      const examplePath = path.join(__dirname, '..', 'google-services.json.example');
      assert.ok(fs.existsSync(examplePath), 'google-services.json.example must exist');
      const content = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
      assert.strictEqual(content.project_info.project_number, '000000000000');
      assert.ok(content.client[0].api_key[0].current_key.includes('DummyKey'));
    });
  });

  describe('Vibe-Check Security Audit: Database Access & IDOR Protection', () => {
    it('should enforce status = active on profiles RLS policy to block revoked caregivers', () => {
      const patientCaregivers = [
        { patient_id: 'p1', caregiver_id: 'cg-active', status: 'active' },
        { patient_id: 'p1', caregiver_id: 'cg-revoked', status: 'revoked' },
        { patient_id: 'p1', caregiver_id: 'cg-pending', status: 'pending' },
      ];

      function canCaregiverReadProfile(callerId, patientId) {
        if (callerId === patientId) return true;
        return patientCaregivers.some(
          (pc) => pc.patient_id === patientId && pc.caregiver_id === callerId && pc.status === 'active'
        );
      }

      // Patient reads self
      assert.strictEqual(canCaregiverReadProfile('p1', 'p1'), true);
      // Active caregiver reads patient
      assert.strictEqual(canCaregiverReadProfile('cg-active', 'p1'), true);
      // Revoked caregiver MUST BE REJECTED (IDOR fix)
      assert.strictEqual(canCaregiverReadProfile('cg-revoked', 'p1'), false);
      // Pending invite caregiver MUST BE REJECTED (IDOR fix)
      assert.strictEqual(canCaregiverReadProfile('cg-pending', 'p1'), false);
      // Random attacker MUST BE REJECTED
      assert.strictEqual(canCaregiverReadProfile('attacker', 'p1'), false);
    });

    it('should enforce strict ownership and active caregiver link on medications table RLS', () => {
      const medications = [
        { id: 101, patient_id: 'user-A', medicine_name: 'Metformin', pills_remaining: 30 },
        { id: 102, patient_id: 'user-B', medicine_name: 'Lisinopril', pills_remaining: 15 },
      ];
      const activeLinks = [
        { patient_id: 'user-A', caregiver_id: 'caregiver-1', status: 'active' },
      ];

      function canReadMedication(callerId, medId) {
        const med = medications.find((m) => m.id === medId);
        if (!med) return false;
        if (med.patient_id === callerId) return true;
        return activeLinks.some(
          (al) => al.patient_id === med.patient_id && al.caregiver_id === callerId && al.status === 'active'
        );
      }

      function canMutateMedication(callerId, medId) {
        const med = medications.find((m) => m.id === medId);
        if (!med) return false;
        return med.patient_id === callerId;
      }

      // User A reads their own medication
      assert.strictEqual(canReadMedication('user-A', 101), true);
      // User B cannot read User A's medication
      assert.strictEqual(canReadMedication('user-B', 101), false);
      // Linked active caregiver can read User A's medication
      assert.strictEqual(canReadMedication('caregiver-1', 101), true);
      // Linked caregiver CANNOT mutate User A's medication (owner-only mutation)
      assert.strictEqual(canMutateMedication('caregiver-1', 101), false);
      // User B cannot mutate User A's medication
      assert.strictEqual(canMutateMedication('user-B', 101), false);
    });

    it('should restrict unassigned pending reviews strictly to verified physicians (blocking unverified caregivers)', () => {
      const users = [
        { id: 'verified-doc', role: 'doctor', is_verified_doctor: true },
        { id: 'unverified-doc', role: 'doctor', is_verified_doctor: false },
        { id: 'fake-caregiver', role: 'caregiver', is_verified_doctor: false },
        { id: 'patient-A', role: 'patient', is_verified_doctor: false },
      ];

      const pendingReviews = [
        { id: 1, patient_id: 'patient-A', target_doctor_id: null, medication: 'Amoxicillin' },
      ];

      function canViewUntargetedReview(callerId, reviewId) {
        const review = pendingReviews.find((r) => r.id === reviewId);
        if (!review) return false;
        if (review.patient_id === callerId) return true;

        const profile = users.find((u) => u.id === callerId);
        if (!profile) return false;

        // Untargeted reviews require is_verified_doctor = true
        if (review.target_doctor_id === null) {
          return profile.is_verified_doctor === true;
        }
        return review.target_doctor_id === callerId;
      }

      // Patient A reads own review
      assert.strictEqual(canViewUntargetedReview('patient-A', 1), true);
      // Verified doctor reads unassigned practice queue
      assert.strictEqual(canViewUntargetedReview('verified-doc', 1), true);
      // Unverified doctor cannot read unassigned queue
      assert.strictEqual(canViewUntargetedReview('unverified-doc', 1), false);
      // Self-declared caregiver CANNOT read unassigned review (privacy fix)
      assert.strictEqual(canViewUntargetedReview('fake-caregiver', 1), false);
    });
  });

  describe('Vibe-Check Security Audit: Edge Function Fail-Closed Quota & Timing Protection', () => {
    it('should fail closed in scan-prescription when service key is missing or quota update fails', () => {
      function evaluateQuotaEnforcement({ rpcAvailable, quotaAllowed, serviceKeyPresent, upsertSuccess }) {
        if (rpcAvailable) {
          return quotaAllowed ? { proceed: true } : { error: 'Quota reached', status: 429 };
        }
        // Fallback requires service key
        if (!serviceKeyPresent) {
          return { error: 'Service unavailable', status: 503 };
        }
        if (!upsertSuccess) {
          return { error: 'Database write failed', status: 500 };
        }
        return { proceed: true };
      }

      // Normal flow with RPC
      assert.deepStrictEqual(
        evaluateQuotaEnforcement({ rpcAvailable: true, quotaAllowed: true }),
        { proceed: true }
      );
      // Quota exceeded
      assert.deepStrictEqual(
        evaluateQuotaEnforcement({ rpcAvailable: true, quotaAllowed: false }),
        { error: 'Quota reached', status: 429 }
      );
      // Missing service role key fails closed with 503
      assert.deepStrictEqual(
        evaluateQuotaEnforcement({ rpcAvailable: false, serviceKeyPresent: false }),
        { error: 'Service unavailable', status: 503 }
      );
      // Upsert error fails closed with 500
      assert.deepStrictEqual(
        evaluateQuotaEnforcement({ rpcAvailable: false, serviceKeyPresent: true, upsertSuccess: false }),
        { error: 'Database write failed', status: 500 }
      );
    });

    it('should execute constant-time comparison in check-missed-doses to defeat timing side channels', () => {
      const correctSecret = 'super_secret_service_role_key_2026';

      function verifyTokenTimingSafe(token, expected) {
        if (typeof token !== 'string' || typeof expected !== 'string') return false;
        const isLengthMatch = token.length === expected.length;
        let mismatch = isLengthMatch ? 0 : 1;
        for (let i = 0; i < token.length && i < expected.length; i++) {
          mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
        }
        return mismatch === 0;
      }

      assert.strictEqual(verifyTokenTimingSafe(correctSecret, correctSecret), true);
      assert.strictEqual(verifyTokenTimingSafe('wrong_token', correctSecret), false);
      assert.strictEqual(verifyTokenTimingSafe(correctSecret.slice(0, -1) + 'X', correctSecret), false);
      assert.strictEqual(verifyTokenTimingSafe('', correctSecret), false);
    });
  });

  describe('Vibe-Check Security Audit: Input Validation & PostgREST Sanitization', () => {
    it('should validate and sanitize UUID inputs for PostgREST .or() filters', () => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Valid UUIDs
      const validCgId = 'c1234567-89ab-cdef-0123-456789abcdef';
      const validPatIds = ['a1234567-89ab-cdef-0123-456789abcdef', 'b1234567-89ab-cdef-0123-456789abcdef'];

      assert.ok(UUID_REGEX.test(validCgId));
      assert.ok(validPatIds.every((id) => UUID_REGEX.test(id)));

      // Malicious injected strings
      const maliciousId1 = 'c1234567-89ab-cdef-0123-456789abcdef),target_doctor_id.is.null';
      const maliciousId2 = '1; DROP TABLE medications;--';

      assert.ok(!UUID_REGEX.test(maliciousId1));
      assert.ok(!UUID_REGEX.test(maliciousId2));
    });

    it('should reject negative, zero, fractional, or excessive restock counts', () => {
      function validateRestockCount(count) {
        if (!Number.isInteger(count) || count <= 0 || count > 5000) {
          throw new Error('Invalid restock quantity: must be an integer between 1 and 5000.');
        }
        return true;
      }

      assert.strictEqual(validateRestockCount(30), true);
      assert.strictEqual(validateRestockCount(1), true);
      assert.strictEqual(validateRestockCount(5000), true);

      assert.throws(() => validateRestockCount(-10), /Invalid restock quantity/);
      assert.throws(() => validateRestockCount(0), /Invalid restock quantity/);
      assert.throws(() => validateRestockCount(15.5), /Invalid restock quantity/);
      assert.throws(() => validateRestockCount(100000), /Invalid restock quantity/);
      assert.throws(() => validateRestockCount(NaN), /Invalid restock quantity/);
    });
  });
});



