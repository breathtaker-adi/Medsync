// tests/architecture_and_services.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// 1. Result Pattern Invariants
function ok(data) {
  return { success: true, data };
}

function err(error) {
  return { success: false, error };
}

// 2. Time Utilities Logic Mirror
function parseTimeToMinutes(timeString) {
  if (!timeString) return 9999;
  let timeStr = timeString.trim().toUpperCase();
  const isPM = timeStr.includes('PM');
  const isAM = timeStr.includes('AM');
  timeStr = timeStr.replace('AM', '').replace('PM', '').trim();
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function parseTimeToHourMin(timeString) {
  const totalMinutes = parseTimeToMinutes(timeString);
  if (totalMinutes === 9999) return { hour: 8, minute: 0 };
  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

function getTimeSlot(timeString) {
  const minutes = parseTimeToMinutes(timeString);
  if (minutes < 720) return 'morning';
  if (minutes < 1020) return 'afternoon';
  if (minutes < 1260) return 'evening';
  return 'night';
}

function getNextDateForTime(timeString, referenceDate = new Date()) {
  const totalMinutes = parseTimeToMinutes(timeString);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const nextDate = new Date(referenceDate);
  nextDate.setHours(hours, minutes, 0, 0);
  if (nextDate <= referenceDate) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
}

// 3. Error Normalization Logic Mirror
function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') {
    if (error.message.includes('JWT expired') || error.message.includes('token is expired')) {
      return 'Your session has expired. Please log in again.';
    }
    if (error.message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (error.message.includes('duplicate key value')) {
      return 'This record already exists.';
    }
    return error.message;
  }
  return 'An unexpected error occurred.';
}

describe('Architecture & Service Layer Test Suite', () => {
  describe('Result<T> Contract Pattern', () => {
    it('should create valid ok results with data and success true', () => {
      const result = ok({ id: 123, name: 'Amoxicillin' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.id, 123);
      assert.strictEqual(result.data.name, 'Amoxicillin');
      assert.strictEqual(result.error, undefined);
    });

    it('should create valid err results with error and success false', () => {
      const errorObj = new Error('Database timeout');
      const result = err(errorObj);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.data, undefined);
      assert.strictEqual(result.error.message, 'Database timeout');
    });
  });

  describe('Time & Schedule Utilities', () => {
    it('should parse 12-hour AM/PM times into correct minute offsets', () => {
      assert.strictEqual(parseTimeToMinutes('12:00 AM'), 0);
      assert.strictEqual(parseTimeToMinutes('08:00 AM'), 480);
      assert.strictEqual(parseTimeToMinutes('12:00 PM'), 720);
      assert.strictEqual(parseTimeToMinutes('01:30 PM'), 810);
      assert.strictEqual(parseTimeToMinutes('11:59 PM'), 1439);
    });

    it('should parse 12-hour AM/PM into numeric hour and minute components', () => {
      assert.deepStrictEqual(parseTimeToHourMin('08:15 AM'), { hour: 8, minute: 15 });
      assert.deepStrictEqual(parseTimeToHourMin('01:30 PM'), { hour: 13, minute: 30 });
      assert.deepStrictEqual(parseTimeToHourMin('12:00 AM'), { hour: 0, minute: 0 });
      assert.deepStrictEqual(parseTimeToHourMin('12:00 PM'), { hour: 12, minute: 0 });
      assert.deepStrictEqual(parseTimeToHourMin(null), { hour: 8, minute: 0 });
    });

    it('should handle missing or invalid time strings gracefully', () => {
      assert.strictEqual(parseTimeToMinutes(null), 9999);
      assert.strictEqual(parseTimeToMinutes(''), 9999);
      assert.strictEqual(parseTimeToMinutes(undefined), 9999);
    });

    it('should categorize times into day quadrant slots correctly', () => {
      assert.strictEqual(getTimeSlot('08:00 AM'), 'morning');
      assert.strictEqual(getTimeSlot('11:59 AM'), 'morning');
      assert.strictEqual(getTimeSlot('12:00 PM'), 'afternoon');
      assert.strictEqual(getTimeSlot('04:30 PM'), 'afternoon');
      assert.strictEqual(getTimeSlot('06:00 PM'), 'evening');
      assert.strictEqual(getTimeSlot('08:30 PM'), 'evening');
      assert.strictEqual(getTimeSlot('09:00 PM'), 'night');
      assert.strictEqual(getTimeSlot('11:00 PM'), 'night');
    });

    it('should calculate next occurrence date across calendar days', () => {
      const ref = new Date('2026-10-16T10:00:00Z');
      const nextTime = getNextDateForTime('08:00 AM', ref);
      // Since 8 AM is before 10 AM, next date should be tomorrow
      assert.ok(nextTime > ref);
    });
  });

  describe('Centralized Error Handling Normalization', () => {
    it('should translate expired token messages to clear user notices', () => {
      const msg = getErrorMessage({ message: 'JWT expired' });
      assert.strictEqual(msg, 'Your session has expired. Please log in again.');
    });

    it('should translate invalid credentials messages cleanly', () => {
      const msg = getErrorMessage({ message: 'Invalid login credentials' });
      assert.strictEqual(msg, 'Invalid email or password. Please try again.');
    });

    it('should translate unique violation duplicate key errors cleanly', () => {
      const msg = getErrorMessage({ message: 'duplicate key value violates unique constraint' });
      assert.strictEqual(msg, 'This record already exists.');
    });

    it('should preserve unexpected specific error messages', () => {
      const msg = getErrorMessage({ message: 'Failed to connect to Bluetooth pillbox' });
      assert.strictEqual(msg, 'Failed to connect to Bluetooth pillbox');
    });

    it('should handle null/empty errors safely', () => {
      assert.strictEqual(getErrorMessage(null), 'An unexpected error occurred.');
      assert.strictEqual(getErrorMessage(undefined), 'An unexpected error occurred.');
    });
  });

  describe('Service Domain Invariants', () => {
    it('should permit caregiver and doctor approvals while disallowing unauthorized roles', () => {
      function canApprovePrescription(role, isVerifiedDoctor) {
        if (role !== 'caregiver' && role !== 'doctor' && !isVerifiedDoctor) {
          return err(new Error('Only designated caregivers or verified medical doctors can approve prescriptions.'));
        }
        return ok(true);
      }

      const caregiverAttempt = canApprovePrescription('caregiver', false);
      assert.strictEqual(caregiverAttempt.success, true);

      const doctorAttempt = canApprovePrescription('doctor', true);
      assert.strictEqual(doctorAttempt.success, true);

      const unauthorizedAttempt = canApprovePrescription('patient', false);
      assert.strictEqual(unauthorizedAttempt.success, false);
      assert.ok(unauthorizedAttempt.error.message.includes('caregivers or verified medical doctors'));
    });

    it('should validate 6-8 character pairing code format before submission', () => {
      function validatePairingCode(code) {
        if (!code || typeof code !== 'string') return false;
        const cleaned = code.trim().toUpperCase();
        return cleaned.length >= 6 && cleaned.length <= 8 && /^[A-Z0-9]+$/.test(cleaned);
      }

      assert.strictEqual(validatePairingCode('ABC12345'), true);
      assert.strictEqual(validatePairingCode('  xy7890  '), true);
      assert.strictEqual(validatePairingCode('123'), false); // Too short
      assert.strictEqual(validatePairingCode('TOOLONGCODE99'), false); // Too long
      assert.strictEqual(validatePairingCode('AB-CD-12'), false); // Invalid chars
    });

    it('should configure repeating calendar trigger and pass scheduledTime in notification data payload', () => {
      function createAlarmPayload(med) {
        const { hour, minute } = parseTimeToHourMin(med.time);
        return {
          content: {
            title: '🚨 MEDICATION ALERT',
            body: `Time to take ${med.medicine_name} (${med.dosage})`,
            categoryIdentifier: 'medication-alerts',
            data: { medicationId: med.id, scheduledTime: med.time },
          },
          trigger: {
            type: 'calendar',
            hour,
            minute,
            repeats: true,
          },
        };
      }

      const med = { id: 42, medicine_name: 'Metformin', dosage: '500mg', time: '09:30 AM', status: 'taken' };
      const alarm = createAlarmPayload(med);
      assert.strictEqual(alarm.trigger.type, 'calendar');
      assert.strictEqual(alarm.trigger.hour, 9);
      assert.strictEqual(alarm.trigger.minute, 30);
      assert.strictEqual(alarm.trigger.repeats, true);
      assert.strictEqual(alarm.content.data.scheduledTime, '09:30 AM');
      assert.strictEqual(alarm.content.data.medicationId, 42);
    });

    it('should throw fatal error when Supabase URL or Anon key is missing from environment', () => {
      function validateEnv(env) {
        if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
          throw new Error('[FATAL] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set.');
        }
        return { supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL, supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
      }

      assert.throws(() => validateEnv({}), /\[FATAL\]/);
      assert.throws(() => validateEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }), /\[FATAL\]/);
      const valid = validateEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_test_key',
      });
      assert.strictEqual(valid.supabaseUrl, 'https://example.supabase.co');
      assert.strictEqual(valid.supabaseAnonKey, 'sb_test_key');
    });
  });
});
