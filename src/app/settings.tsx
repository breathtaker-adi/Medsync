import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { SeniorButton } from '../components/SeniorButton';
import { ScreenHeader } from '../components/ScreenHeader';

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const generateRandomPairingCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

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

  // Fetch existing pairing code on mount if available and not expired (15m window)
  useEffect(() => {
    const fetchExistingCode = async () => {
      if (!session?.user?.id || profile?.role !== 'patient') return;

      const { data } = await supabase
        .from('patient_caregivers')
        .select('pairing_code, created_at, caregiver_id')
        .eq('patient_id', session.user.id)
        .is('caregiver_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.pairing_code && data?.created_at) {
        const isExpired = Date.now() - new Date(data.created_at).getTime() > 15 * 60 * 1000;
        if (!isExpired) {
          setPairingCode(data.pairing_code);
        }
      }
    };

    fetchExistingCode();
  }, [session?.user?.id, profile?.role]);

  const generatePairingCode = async () => {
    if (!session?.user?.id) return;
    triggerHaptic();
    setLoadingCode(true);

    // Check for an existing unexpired code
    const { data: existingConnection } = await supabase
      .from('patient_caregivers')
      .select('pairing_code, created_at, caregiver_id')
      .eq('patient_id', session.user.id)
      .is('caregiver_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConnection?.pairing_code && existingConnection?.created_at) {
      const isExpired = Date.now() - new Date(existingConnection.created_at).getTime() > 15 * 60 * 1000;
      if (!isExpired) {
        setPairingCode(existingConnection.pairing_code);
        setLoadingCode(false);
        return;
      }
    }

    // 8-character random pairing code
    const newCode = generateRandomPairingCode();

    const { error } = await supabase.from('patient_caregivers').insert({
      patient_id: session.user.id,
      pairing_code: newCode,
      status: 'pending',
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
      const todayStr = new Date().toISOString().split('T')[0];

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

      // 3. Format HTML for the PDF with strict character escaping
      const safePatientName = escapeHtml(profile?.full_name || 'Patient');
      const safeDateRange = `${escapeHtml(thirtyDaysAgoStr)} to ${escapeHtml(todayStr)}`;
      const safeGeneratedDate = escapeHtml(new Date().toLocaleDateString());

      const tableRows = logs && logs.length > 0
        ? logs
            .map((log) => {
              const med = meds?.find((m) => m.id === log.medication_id);
              const safeLogDate = escapeHtml(log.log_date);
              const safeTime = escapeHtml(log.scheduled_time || '-');
              const safeMedName = escapeHtml(med?.medicine_name || 'Unknown Med');
              const rawStatus = (log.status || 'PENDING').toUpperCase();
              const safeStatus = escapeHtml(rawStatus);
              const safeNotes = escapeHtml(log.notes || '-');
              const statusClass = escapeHtml(log.status || 'pending');

              return `
                <tr>
                  <td>${safeLogDate}</td>
                  <td>${safeTime}</td>
                  <td><strong>${safeMedName}</strong></td>
                  <td class="${statusClass}">${safeStatus}</td>
                  <td>${safeNotes}</td>
                </tr>
              `;
            })
            .join('')
        : `<tr><td colspan="5" style="text-align: center; color: #79747e;">No logs recorded in the last 30 days.</td></tr>`;

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
              <p><strong>Patient:</strong> ${safePatientName}</p>
              <p><strong>Report Window:</strong> Last 30 Days (${safeDateRange})</p>
              <p><strong>Generated On:</strong> ${safeGeneratedDate}</p>
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
                ${tableRows}
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
    Alert.alert(
      'Log Out of MedSync?',
      'Are you sure you want to sign out? You will need your email and password to log back in.',
      [
        { text: 'Stay Logged In', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Error', 'Failed to log out.');
            } else {
              router.replace('/login');
            }
          },
        },
      ]
    );
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

  const openExactAlarmSettings = async () => {
    triggerHaptic();
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
          {
            data: `package:${Application.applicationId}`,
          }
        );
      } catch (e) {
        Alert.alert(
          'Exact Alarm Settings',
          'To ensure medication alarms fire precisely on time, enable "Alarms & Reminders" for MedSync in your device settings.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } else {
      Linking.openSettings();
    }
  };

  const isDoctor = profile?.role === 'doctor' || profile?.is_verified_doctor === true;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Settings"
        subtitle={isDoctor ? 'Clinical & physician preferences' : 'Health & device preferences'}
        fallbackRoute={isDoctor ? '/(tabs)/caregiver-dashboard' : '/(tabs)/patient-dashboard'}
      />

      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <Ionicons name="person-circle" size={48} color={Theme.colors.primary} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Guest User'}</Text>
            <Text style={styles.profileRole}>
              {profile?.role
                ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                : 'Not set'}
            </Text>
          </View>
        </View>

        {/* Doctor Clinical Settings Banner */}
        {isDoctor && (
          <TouchableOpacity
            style={styles.doctorBanner}
            onPress={() => {
              triggerHaptic();
              router.push('/doctor-settings');
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Doctor Settings"
          >
            <View style={styles.doctorBannerLeft}>
              <View style={styles.doctorBannerIcon}>
                <Ionicons name="medical" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.doctorBannerTitle}>Doctor Clinical Settings</Text>
                  <View style={styles.doctorBadge}>
                    <Text style={styles.doctorBadgeText}>Verified MD</Text>
                  </View>
                </View>
                <Text style={styles.doctorBannerSubtitle}>
                  Practice roster, prescription review alerts & clinical credentials
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Theme.colors.primary} />
          </TouchableOpacity>
        )}

        {/* Export Health Report Button (Patients Only) */}
        {profile?.role === 'patient' && (
          <View style={{ marginBottom: 18 }}>
            <SeniorButton
              title={generatingPdf ? 'Generating Report...' : 'Export 30-Day Health Report'}
              onPress={exportHealthReport}
              loading={generatingPdf}
              variant="outline"
              size="normal"
              icon={<Ionicons name="document-text-outline" size={22} color={Theme.colors.primary} />}
            />
          </View>
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
              <SeniorButton
                title={loadingCode ? 'Generating...' : 'Generate 8-Digit Pairing Code'}
                onPress={generatePairingCode}
                loading={loadingCode}
                variant="primary"
                size="normal"
                icon={<Ionicons name="key-outline" size={20} color="#FFFFFF" />}
              />
            )}
          </View>
        )}

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>Preferences</Text>

        {/* Mute Alerts Toggle (Caregivers & Doctors) */}
        {(profile?.role === 'caregiver' || isDoctor) && (
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

        {Platform.OS === 'android' && (
          <TouchableOpacity style={styles.settingRow} onPress={openExactAlarmSettings}>
            <View style={styles.settingInfo}>
              <Ionicons name="time-outline" size={24} color={Theme.colors.onSurfaceVariant} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Exact Alarms (Android 14+)</Text>
                <Text style={styles.settingSubtitle}>Permit exact timing even in low battery mode</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        {/* Privacy & Health Data Section */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Privacy & Security</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            triggerHaptic();
            router.push('/privacy-policy' as any);
          }}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="shield-checkmark-outline" size={24} color={Theme.colors.primary} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Data Privacy & Consent</Text>
              <Text style={styles.settingSubtitle}>Review AI processing & health privacy</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Account</Text>

        {/* Exit Application */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            triggerHaptic();
            Alert.alert('Exit MedSync', 'Are you sure you want to close MedSync?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
            ]);
          }}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="exit-outline" size={24} color={Theme.colors.primary} />
            <Text style={[styles.settingText, { color: Theme.colors.onSurface }]}>Exit MedSync</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.outline} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <View style={styles.settingInfo}>
            <Ionicons name="log-out-outline" size={24} color={Theme.colors.error} />
            <Text style={[styles.settingText, { color: Theme.colors.error }]}>Log Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Theme.colors.outline} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { borderBottomWidth: 0 }]}
          onPress={() => {
            triggerHaptic();
            Alert.alert(
              'Delete Account & Data',
              'Are you sure you want to delete your account? All medication logs, active schedules, and caregiver links will be deleted. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      if (session?.user?.id) {
                        await supabase.from('medication_logs').delete().eq('patient_id', session.user.id);
                        await supabase.from('medications').delete().eq('patient_id', session.user.id);
                        await supabase.from('patient_caregivers').delete().or(`patient_id.eq.${session.user.id},caregiver_id.eq.${session.user.id}`);
                        await supabase.from('profiles').delete().eq('id', session.user.id);
                      }
                      await supabase.auth.signOut();
                      router.replace('/login');
                    } catch (err) {
                      console.error('Account deletion error:', err);
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          }}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="trash-outline" size={24} color={Theme.colors.error} />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: Theme.colors.error }]}>Delete Account & Data</Text>
              <Text style={styles.settingSubtitle}>Permanently erase all health records</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Branded Vector Logo App Footer */}
        <View style={styles.appFooter}>
          <MedSyncLogo size={48} variant="horizontal" />
          <Text style={styles.appVersionText}>Version 1.0.0 (Build 57)</Text>
          <Text style={styles.appMissionText}>Accessible & Secure Healthcare Companion</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.outlineVariant,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  doctorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    ...Theme.shadows.level1,
  },
  doctorBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  doctorBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  doctorBannerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  doctorBannerSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 15,
  },
  doctorBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doctorBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9.5,
    color: '#15803D',
  },
  profileInfo: {
    marginLeft: 12,
  },
  profileName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: Theme.colors.onSurface,
  },
  profileRole: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    textTransform: 'capitalize',
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  exportButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  pairingCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.outline,
  },
  pairingSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 12,
  },
  codeDisplay: {
    backgroundColor: Theme.colors.primaryContainer,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  codeText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: Theme.colors.primary,
    letterSpacing: 3,
  },
  generateButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  generateButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 10,
    marginLeft: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  settingSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  settingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 14,
    color: Theme.colors.onSurface,
    marginLeft: 12,
  },
  appFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 16,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  appVersionText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: Theme.colors.outline,
    marginTop: 8,
  },
  appMissionText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 3,
  },
});