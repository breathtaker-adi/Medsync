// src/services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Medication } from '../types/medication';
import { getNextDateForTime, parseTimeToHourMin } from '../utils/timeUtils';

export const notificationService = {
  /**
   * Text-to-speech read-aloud for senior medication adherence
   */
  speakMedication(medication: Medication, isAudioEnabled: boolean): boolean {
    if (!isAudioEnabled) {
      return false;
    }

    const overdueWarning = medication.isOverdue ? ' Warning: This dose is overdue.' : '';
    const foodAdvice = medication.food_warning ? ` ${medication.food_warning}.` : '';
    const textToRead = `${medication.medicine_name}. ${medication.dosage}. Scheduled for ${medication.time}.${foodAdvice}${overdueWarning}`;

    try {
      Speech.speak(textToRead, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.85, // Slightly slower rate for senior clarity
      });
      return true;
    } catch (err) {
      console.warn('[notificationService] Speech error:', err);
      return false;
    }
  },

  /**
   * Stop any in-progress speech playback
   */
  stopSpeaking(): void {
    try {
      Speech.stop();
    } catch {}
  },

  /**
   * Speak arbitrary text aloud (e.g. clinical briefing or dashboard summary)
   */
  speakText(text: string, isAudioEnabled: boolean): boolean {
    if (!isAudioEnabled || !text) {
      return false;
    }

    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
      return true;
    } catch (err) {
      console.warn('[notificationService] speakText error:', err);
      return false;
    }
  },

  /**
   * Schedule local 20-minute snooze notification
   */
  async scheduleSnoozeNotification(medication: Medication, minutes = 20): Promise<string | null> {
    try {
      const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);

      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ Snoozed: Time to take ${medication.medicine_name}`,
            body: `Dosage: ${medication.dosage}. Scheduled dose was snoozed.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: snoozeDate,
            channelId: 'medication-alarms-auto',
          },
        });
        return id;
      } catch {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ Snoozed: Time to take ${medication.medicine_name}`,
            body: `Dosage: ${medication.dosage}. Scheduled dose was snoozed.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: snoozeDate,
          },
        });
        return id;
      }
    } catch (err) {
      return null;
    }
  },

  /**
   * Schedule automated recurring daily alarms for all active medications
   */
  async scheduleAllAlarms(meds: Medication[]): Promise<void> {
    try {
      // Cancel previous auto-alarms so roster updates don't produce duplicate alerts
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of scheduled) {
          if (
            notification.content?.categoryIdentifier === 'medication-alerts' ||
            notification.content?.data?.medicationId
          ) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
      } catch {
        // Fallback to global clear if getAllScheduledNotifications is restricted
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      }

      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('medication-alarms-auto', {
            name: 'Automatic Medication Alarms',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
          });
        } catch {
          // Channel manager may be unsupported in Expo Go Android client
        }
      }

      for (const med of meds) {
        // Do not unschedule daily alarms when a dose is taken today; only skip paused medications
        if (!med.time || med.status === 'paused') {
          continue;
        }

        const { hour, minute } = parseTimeToHourMin(med.time);

        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🚨 MEDICATION ALERT`,
              body: `Time to take ${med.medicine_name} (${med.dosage})`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              categoryIdentifier: 'medication-alerts',
              data: { medicationId: med.id, scheduledTime: med.time },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              hour,
              minute,
              repeats: true,
              channelId: 'medication-alarms-auto',
            },
          });
        } catch {
          try {
            // Fallback without channelId for Expo Go runtime
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `🚨 MEDICATION ALERT`,
                body: `Time to take ${med.medicine_name} (${med.dosage})`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                categoryIdentifier: 'medication-alerts',
                data: { medicationId: med.id, scheduledTime: med.time },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                hour,
                minute,
                repeats: true,
              },
            });
          } catch (fallbackErr) {
            // Silently ignore if Expo Go rejects scheduling
          }
        }
      }
    } catch (err) {
      // Non-fatal warning
      console.warn('[notificationService] Failed to schedule alarms:', err);
    }
  },

  /**
   * Send a high-priority push notification to a linked patient via Expo Push Service
   */
  async sendPushNotificationToPatient(
    patientId: string,
    title: string,
    body: string,
    caregiverId?: string
  ): Promise<boolean> {
    try {
      let query = supabase
        .from('patient_push_tokens')
        .select('push_token')
        .eq('patient_id', patientId);

      if (caregiverId) {
        query = query.eq('caregiver_id', caregiverId);
      }

      const { data: patientData, error } = await query;
      if (error || !patientData || patientData.length === 0) {
        return false;
      }

      const token = patientData[0]?.push_token;
      if (!token) return false;

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title,
          body,
          sound: 'default',
          priority: 'high',
        }),
      });

      return response.ok;
    } catch (err) {
      console.warn('[notificationService] Failed to send push notification:', err);
      return false;
    }
  },
};
