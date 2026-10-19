// src/services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Medication } from '../types/medication';
import { getNextDateForTime } from '../utils/timeUtils';

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
   * Schedule automated alarms for all pending medications today
   */
  async scheduleAllAlarms(meds: Medication[]): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

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
        if (med.status !== 'taken' && med.status !== 'skipped' && med.time) {
          const triggerDate = getNextDateForTime(med.time);

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `🚨 MEDICATION ALERT`,
                body: `Time to take ${med.medicine_name} (${med.dosage})`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                categoryIdentifier: 'medication-alerts',
                data: { medicationId: med.id },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
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
                  data: { medicationId: med.id },
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: triggerDate,
                },
              });
            } catch (fallbackErr) {
              // Silently ignore if Expo Go rejects scheduling
            }
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
