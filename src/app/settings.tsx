import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { avatarHelper } from '../utils/avatarHelper';

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

const SOUND_OPTIONS = [
  { id: 'gentle_chime', name: 'Gentle Chime', desc: 'Soft harmonious bell for calm morning waking', icon: 'musical-notes' },
  { id: 'medical_pulse', name: 'Medical Pulse', desc: 'Clinical rhythm telemetry alert', icon: 'pulse' },
  { id: 'classic_bell', name: 'Classic Bell', desc: 'Resonant brass bell reminder', icon: 'notifications' },
  { id: 'urgent_alert', name: 'Urgent Alert', desc: 'High-visibility dual alert tone', icon: 'warning' },
  { id: 'calm_marimba', name: 'Calm Marimba', desc: 'Acoustic wooden mallet melody', icon: 'volume-medium' },
  { id: 'system_default', name: 'System Default', desc: 'Device default notification sound', icon: 'phone-portrait' },
];

export default function SettingsScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const {
    isAccessibilityMode,
    isAudioEnabled,
    toggleAccessibility,
    toggleAudio,
    triggerHaptic,
  } = useAccessibility();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [selectedSound, setSelectedSound] = useState('Gentle Chime');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(profile?.alerts_enabled ?? true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load avatar and selected sound from storage on mount
  useEffect(() => {
    if (session?.user?.id) {
      avatarHelper.getLocalAvatar(session.user.id).then((stored) => {
        if (stored) setAvatarUri(stored);
        else if (profile?.avatar_url) setAvatarUri(profile.avatar_url);
      });
    }
    AsyncStorage.getItem('@medsync_alarm_sound').then((val) => {
      if (val) setSelectedSound(val);
    });
  }, [session?.user?.id, profile?.avatar_url]);

  const handlePickAvatar = async () => {
    if (!session?.user?.id) return;
    triggerHaptic();
    const newAvatar = await avatarHelper.promptPickAvatar(session.user.id);
    if (newAvatar) {
      setAvatarUri(newAvatar);
      await refreshProfile();
    }
  };

  const handleSelectSound = async (soundName: string) => {
    triggerHaptic();
    setSelectedSound(soundName);
    await AsyncStorage.setItem('@medsync_alarm_sound', soundName);
    Speech.stop();
    Speech.speak(`Alert sound: ${soundName}. It is time for your medication.`, {
      pitch: soundName === 'Urgent Alert' ? 1.3 : soundName === 'Gentle Chime' ? 1.1 : 1.0,
      rate: 0.95,
    });
  };

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

  const openAlarmSoundSettings = () => {
    triggerHaptic();
    setAlarmModalVisible(true);
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
        <View style={[styles.profileCard, isAccessibilityMode && styles.highContrastCard]}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            accessibilityLabel="Change profile picture"
            accessibilityRole="button"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.profileAvatarImage} />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Ionicons name="person" size={28} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isAccessibilityMode && styles.largeProfileName]}>
              {profile?.full_name || 'Guest User'}
            </Text>
            <Text style={[styles.profileRole, isAccessibilityMode && styles.largeProfileRole]}>
              {profile?.role
                ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                : 'Not set'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={handlePickAvatar} style={styles.changePhotoBtn}>
                <Ionicons name="image-outline" size={13} color={Theme.colors.primary} />
                <Text style={styles.changePhotoText}>Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic();
                  router.push('/edit-profile' as any);
                }}
                style={[styles.changePhotoBtn, { backgroundColor: '#E0F2FE' }]}
              >
                <Ionicons name="create-outline" size={13} color="#0284C7" />
                <Text style={[styles.changePhotoText, { color: '#0284C7' }]}>Edit Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Accessibility Status Banner */}
        {isAccessibilityMode && (
          <View style={styles.accessibilityActiveBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#0D7377" />
            <Text style={styles.accessibilityActiveBannerText}>
              Accessibility Mode Active • High-Contrast &amp; Large Text Enabled
            </Text>
          </View>
        )}

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
                <View style={styles.codePlateHeader}>
                  <Ionicons name="key" size={18} color="#2DD4BF" />
                  <Text style={styles.codePlateLabel}>ACTIVE PAIRING CODE</Text>
                </View>
                <Text style={styles.codeText}>{pairingCode}</Text>
                <Text style={styles.codeHintText}>Valid for 15 minutes • Share with your doctor</Text>
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

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F1F5F9',
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
              }}
              onPress={() => {
                triggerHaptic();
                router.push('/doctor-link');
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="medical" size={20} color={Theme.colors.primary} />
                <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 13, color: '#0F172A' }}>
                  View Connected Doctors &amp; Roster
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Theme.colors.primary} />
            </TouchableOpacity>
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

        <View style={[styles.settingRow, isAccessibilityMode && styles.accessibilityRow]}>
          <View style={styles.settingInfo}>
            <Ionicons name="accessibility" size={isAccessibilityMode ? 28 : 24} color={Theme.colors.primary} />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, isAccessibilityMode && styles.largeSettingText]}>Accessibility Mode</Text>
              <Text style={[styles.settingSubtitle, isAccessibilityMode && styles.largeSubtitle]}>Large high-contrast text &amp; senior buttons</Text>
            </View>
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

        <View style={[styles.settingRow, isAccessibilityMode && styles.accessibilityRow]}>
          <View style={styles.settingInfo}>
            <Ionicons name="volume-high" size={isAccessibilityMode ? 28 : 24} color={Theme.colors.primary} />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, isAccessibilityMode && styles.largeSettingText]}>Read Aloud (Voice Guidance)</Text>
              <Text style={[styles.settingSubtitle, isAccessibilityMode && styles.largeSubtitle]}>Enable voice speech synthesis on home screen</Text>
            </View>
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
            <Ionicons name="notifications-outline" size={24} color={Theme.colors.primary} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Alarm & Ringtone</Text>
              <Text style={styles.settingSubtitle}>Current: {selectedSound} • Tap to choose</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.soundBadge}>
              <Text style={styles.soundBadgeText}>{selectedSound}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.onSurfaceVariant} />
          </View>
        </TouchableOpacity>

        {Platform.OS === 'android' && (
          <TouchableOpacity style={styles.settingRow} onPress={openExactAlarmSettings}>
            <View style={styles.settingInfo}>
              <Ionicons name="time-outline" size={24} color={Theme.colors.onSurfaceVariant} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Exact Alarms</Text>
                <Text style={styles.settingSubtitle}>Allow alarms to ring at the precise scheduled time</Text>
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

        {/* Paused Medications Section */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            triggerHaptic();
            router.push('/paused-medications' as any);
          }}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="pause-circle-outline" size={24} color="#D97706" />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Paused Medications</Text>
              <Text style={styles.settingSubtitle}>Manage &amp; resume held medication routines</Text>
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

      {/* Alarm Sound Picker Modal */}
      <Modal
        visible={alarmModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Speech.stop();
          setAlarmModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="musical-notes" size={22} color={Theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Medicine Alarm Sound</Text>
                  <Text style={styles.modalSubtitle}>Tap sound to preview tone & speech</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Speech.stop();
                  setAlarmModalVisible(false);
                }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginTop: 12 }}>
              {SOUND_OPTIONS.map((item) => {
                const isSelected = selectedSound === item.name;
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={[styles.soundOptionRow, isSelected && styles.soundOptionRowSelected]}
                    onPress={() => handleSelectSound(item.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.soundOptionLeft}>
                      <View style={[styles.soundRadio, isSelected && styles.soundRadioSelected]}>
                        {isSelected && <View style={styles.soundRadioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.soundName, isSelected && styles.soundNameSelected]}>
                          {item.name}
                        </Text>
                        <Text style={styles.soundDesc}>{item.desc}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.soundPreviewBtn}
                      onPress={() => handleSelectSound(item.name)}
                    >
                      <Ionicons
                        name={isSelected ? 'volume-high' : 'play-circle-outline'}
                        size={22}
                        color={isSelected ? Theme.colors.primary : '#64748B'}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.systemSettingsBtn}
                onPress={async () => {
                  setAlarmModalVisible(false);
                  Speech.stop();
                  if (Platform.OS === 'android') {
                    try {
                      await IntentLauncher.startActivityAsync(
                        'android.settings.APP_NOTIFICATION_SETTINGS',
                        {
                          extra: {
                            'android.provider.extra.APP_PACKAGE': Application.applicationId,
                          },
                        }
                      );
                    } catch {
                      Linking.openSettings();
                    }
                  } else {
                    Linking.openSettings();
                  }
                }}
              >
                <Ionicons name="settings-outline" size={16} color="#64748B" />
                <Text style={styles.systemSettingsText}>System Notification Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => {
                  Speech.stop();
                  setAlarmModalVisible(false);
                }}
              >
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


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
    backgroundColor: '#042F2E',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D9488',
    ...Theme.shadows.cardElevated,
  },
  codePlateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  codePlateLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#2DD4BF',
    letterSpacing: 1.2,
  },
  codeText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 5,
    marginVertical: 4,
    textAlign: 'center',
  },
  codeHintText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#CCFBF1',
    marginTop: 4,
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
  accessibilityActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6FFFA',
    borderWidth: 1.5,
    borderColor: '#0D7377',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  accessibilityActiveBannerText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0D7377',
    flex: 1,
  },
  highContrastCard: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  accessibilityRow: {
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  largeSettingText: {
    fontSize: 17,
    fontFamily: 'PublicSans-Bold',
    color: '#000000',
  },
  largeSubtitle: {
    fontSize: 13.5,
    color: '#1E293B',
    marginTop: 2,
  },
  largeProfileName: {
    fontSize: 20,
    color: '#000000',
  },
  largeProfileRole: {
    fontSize: 14,
    color: '#1E293B',
  },
  avatarContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  profileAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2E8F0',
  },
  profileAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0D9488',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  changePhotoText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  soundBadge: {
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  soundBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#0D9488',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6FFFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  soundOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  soundOptionRowSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  soundRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundRadioSelected: {
    borderColor: '#0D9488',
  },
  soundRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0D9488',
  },
  soundName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#1E293B',
  },
  soundNameSelected: {
    color: '#0D9488',
  },
  soundDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  soundPreviewBtn: {
    padding: 6,
  },
  modalFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  systemSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  systemSettingsText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  modalDoneBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalDoneText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});