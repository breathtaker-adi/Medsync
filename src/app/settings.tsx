// src/app/settings.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

export default function SettingsScreen() {
  const { profile, session } = useAuth();
  const {
    isAccessibilityMode,
    isAudioEnabled,
    toggleAccessibility,
    toggleAudio,
    triggerHaptic,
  } = useAccessibility();

  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(profile?.alerts_enabled ?? true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Sync state if profile changes
  useEffect(() => {
    if (profile?.alerts_enabled != null) {
      setAlertsEnabled(profile.alerts_enabled);
    }
  }, [profile?.alerts_enabled]);

  // Fetch existing pairing code on mount if available
  useEffect(() => {
    const fetchExistingCode = async () => {
      if (!session?.user?.id || profile?.role !== 'patient') return;

      const { data } = await supabase
        .from('patient_caregivers')
        .select('pairing_code')
        .eq('patient_id', session.user.id)
        .maybeSingle();

      if (data?.pairing_code) {
        setPairingCode(data.pairing_code);
      }
    };

    fetchExistingCode();
  }, [session?.user?.id, profile?.role]);

  const generatePairingCode = async () => {
    if (!session?.user?.id) return;
    triggerHaptic();
    setLoadingCode(true);

    const { data: existingConnection } = await supabase
      .from('patient_caregivers')
      .select('pairing_code')
      .eq('patient_id', session.user.id)
      .maybeSingle();

    if (existingConnection?.pairing_code) {
      setPairingCode(existingConnection.pairing_code);
      setLoadingCode(false);
      return;
    }

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase.from('patient_caregivers').insert({
      patient_id: session.user.id,
      pairing_code: newCode,
      status: 'active',
    });

    if (!error) {
      setPairingCode(newCode);
    } else {
      console.error('Error generating pairing code:', error);
      Alert.alert('Error', 'Could not generate pairing code.');
    }
    setLoadingCode(false);
  };

  const exportHealthReport = async () => {
    if (!session?.user?.id) return;
    triggerHaptic();
    setGeneratingPdf(true);

    try {
      // 1. Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      // 2. Fetch logs and medications (include medication_id so names can be mapped)
      const { data: logs, error: logsError } = await supabase
        .from('medication_logs')
        .select('medication_id, log_date, scheduled_time, status, notes')
        .eq('patient_id', session.user.id)
        .gte('log_date', thirtyDaysAgoStr)
        .order('log_date', { ascending: false });

      if (logsError) throw logsError;

      const { data: meds, error: medsError } = await supabase
        .from('medications')
        .select('id, medicine_name')
        .eq('patient_id', session.user.id);

      if (medsError) throw medsError;

      // 3. Format HTML for the PDF
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>MedSync Health Report</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1c1b1f; }
              h1 { color: #006874; margin-bottom: 4px; }
              .meta { color: #49454f; font-size: 14px; margin-bottom: 24px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #cac4d0; padding: 10px 12px; text-align: left; font-size: 13px; }
              th { background-color: #f4eff4; color: #1c1b1f; font-weight: bold; }
              .taken { color: #198754; font-weight: bold; }
              .missed { color: #dc3545; font-weight: bold; }
              .pending { color: #ffc107; font-weight: bold; }
              .skipped { color: #6c757d; font-weight: bold; }
              tr:nth-child(even) { background-color: #faf9fd; }
            </style>
          </head>
          <body>
            <h1>MedSync Health Report</h1>
            <div class="meta">
              <p><strong>Patient:</strong> ${profile?.full_name || 'Patient'}</p>
              <p><strong>Report Window:</strong> Last 30 Days (${thirtyDaysAgoStr} to ${new Date().toISOString().split('T')[0]})</p>
              <p><strong>Generated On:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Scheduled Time</th>
                  <th>Medication</th>
                  <th>Status</th>
                  <th>Patient Notes</th>
                </tr>
              </thead>
              <tbody>
                ${logs && logs.length > 0
          ? logs
            .map((log) => {
              const med = meds?.find((m) => m.id === log.medication_id);
              return `
                            <tr>
                              <td>${log.log_date}</td>
                              <td>${log.scheduled_time || '-'}</td>
                              <td><strong>${med?.medicine_name || 'Unknown Med'}</strong></td>
                              <td class="${log.status}">${(log.status || 'PENDING').toUpperCase()}</td>
                              <td>${log.notes || '-'}</td>
                            </tr>
                          `;
            })
            .join('')
          : `<tr><td colspan="5" style="text-align: center; color: #79747e;">No logs recorded in the last 30 days.</td></tr>`
        }
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Could not generate health report PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleToggleAlerts = async (value: boolean) => {
    triggerHaptic();
    setAlertsEnabled(value);

    const { error } = await supabase
      .from('profiles')
      .update({ alerts_enabled: value })
      .eq('id', session?.user?.id);

    if (error) {
      console.error('Error updating alert preferences:', error);
      Alert.alert('Error', 'Could not update alert preferences.');
      setAlertsEnabled(!value);
    } else {
      Alert.alert('Success', 'Alert preference updated. Reload the dashboard to see changes.');
    }
  };

  const handleLogout = async () => {
    triggerHaptic();
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', 'Failed to log out.');
    } else {
      router.replace('/login');
    }
  };

  const openAlarmSoundSettings = async () => {
    triggerHaptic();
    if (Platform.OS === 'android') {
      try {
        // Try to open the specific channel settings directly
        await IntentLauncher.startActivityAsync(
          'android.settings.CHANNEL_NOTIFICATION_SETTINGS',
          {
            extra: {
              'android.provider.extra.APP_PACKAGE': Application.applicationId,
              'android.provider.extra.CHANNEL_ID': 'medication-alarms-auto',
            },
          }
        );
      } catch (e) {
        // Fallback: If the channel doesn't exist yet, just open general app settings
        console.log('Could not open channel settings, opening general settings', e);
        await IntentLauncher.startActivityAsync(
          'android.settings.APP_NOTIFICATION_SETTINGS',
          {
            extra: {
              'android.provider.extra.APP_PACKAGE': Application.applicationId,
            },
          }
        );
      }
    } else {
      // iOS fallback
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <Ionicons name="person-circle" size={64} color={Theme.colors.primary} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Guest User'}</Text>
            <Text style={styles.profileRole}>
              {profile?.role
                ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                : 'Not set'}
            </Text>
          </View>
        </View>

        {/* Export Health Report Button (Patients Only) */}
        {profile?.role === 'patient' && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={exportHealthReport}
            disabled={generatingPdf}
          >
            <Ionicons name="document-text-outline" size={24} color={Theme.colors.onPrimary} />
            <Text style={styles.exportButtonText}>
              {generatingPdf ? 'Generating Report...' : 'Export 30-Day Health Report'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Caregiver Pairing Code Section */}
        {profile?.role === 'patient' && (
          <View style={styles.pairingCard}>
            <Text style={styles.sectionTitle}>Caregiver Pairing</Text>
            <Text style={styles.pairingSubtitle}>
              Share this code with your doctor so they can monitor your medications.
            </Text>

            {pairingCode ? (
              <View style={styles.codeDisplay}>
                <Text style={styles.codeText}>{pairingCode}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generatePairingCode}
                disabled={loadingCode}
              >
                <Text style={styles.generateButtonText}>
                  {loadingCode ? 'Generating...' : 'Generate Pairing Code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>Preferences</Text>

        {/* Mute Alerts Toggle (Caregivers Only) */}
        {profile?.role === 'caregiver' && (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={24} color={Theme.colors.onSurfaceVariant} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Missed Dose Alerts</Text>
                <Text style={styles.settingSubtitle}>Get notified if a patient misses 2+ doses</Text>
              </View>
            </View>
            <Switch
              value={alertsEnabled}
              onValueChange={handleToggleAlerts}
              trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
            />
          </View>
        )}

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="accessibility" size={24} color={Theme.colors.onSurfaceVariant} />
            <Text style={styles.settingText}>Accessibility Mode</Text>
          </View>
          <Switch
            value={isAccessibilityMode}
            onValueChange={() => {
              triggerHaptic();
              toggleAccessibility();
            }}
            trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="volume-high" size={24} color={Theme.colors.onSurfaceVariant} />
            <Text style={styles.settingText}>Read Aloud (Audio)</Text>
          </View>
          <Switch
            value={isAudioEnabled}
            onValueChange={() => {
              triggerHaptic();
              toggleAudio();
            }}
            trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
          />
        </View>

        <TouchableOpacity style={styles.settingRow} onPress={openAlarmSoundSettings}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={24} color={Theme.colors.onSurfaceVariant} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Alarm & Ringtone</Text>
              <Text style={styles.settingSubtitle}>Change the medication alarm sound</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Account</Text>

        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <View style={styles.settingInfo}>
            <Ionicons name="log-out-outline" size={24} color={Theme.colors.error} />
            <Text style={[styles.settingText, { color: Theme.colors.error }]}>Log Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.outline} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginLeft: 8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  profileInfo: {
    marginLeft: 16,
  },
  profileName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  profileRole: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textTransform: 'capitalize',
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  exportButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  pairingCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Theme.colors.outline,
  },
  pairingSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 16,
  },
  codeDisplay: {
    backgroundColor: Theme.colors.primaryContainer,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  codeText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.primary,
    letterSpacing: 4,
  },
  generateButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  generateButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  settingTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  settingSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  settingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginLeft: 16,
  },
});