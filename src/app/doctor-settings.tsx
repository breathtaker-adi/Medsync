import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

export default function DoctorSettingsScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const {
    isAccessibilityMode,
    isAudioEnabled,
    toggleAccessibility,
    toggleAudio,
    triggerHaptic,
  } = useAccessibility();

  // Clinical Alert States
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(profile?.alerts_enabled ?? true);
  const [reviewPushEnabled, setReviewPushEnabled] = useState<boolean>(true);
  const [lowAdherenceWarning, setLowAdherenceWarning] = useState<boolean>(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState<boolean>(false);

  // Roster Statistics
  const [linkedCount, setLinkedCount] = useState<number>(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // Linking Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [pairingInput, setPairingInput] = useState('');
  const [linking, setLinking] = useState(false);

  const isVerifiedDoctor = profile?.role === 'doctor' || profile?.is_verified_doctor === true;

  // Load roster metrics
  const fetchRosterStats = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { count: patientCount } = await supabase
        .from('patient_caregivers')
        .select('id', { count: 'exact', head: true })
        .eq('caregiver_id', session.user.id);

      setLinkedCount(patientCount || 0);

      const { count: reviewCount } = await supabase
        .from('pending_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      setPendingReviewsCount(reviewCount || 0);
    } catch (err) {
      console.warn('Error fetching doctor stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchRosterStats();
  }, [fetchRosterStats]);

  useEffect(() => {
    if (profile?.alerts_enabled != null) {
      setAlertsEnabled(profile.alerts_enabled);
    }
  }, [profile?.alerts_enabled]);

  const handleToggleAlerts = async (value: boolean) => {
    triggerHaptic();
    setAlertsEnabled(value);

    const { error } = await supabase
      .from('profiles')
      .update({ alerts_enabled: value })
      .eq('id', session?.user?.id);

    if (error) {
      Alert.alert('Error', 'Could not update alert preferences.');
      setAlertsEnabled(!value);
    } else {
      Alert.alert('Updated', 'Clinical missed-dose alert preferences saved.');
    }
  };

  const handleLinkPatient = async () => {
    const formattedCode = pairingInput.trim().toUpperCase();

    if (!session?.user?.id || formattedCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 8-character pairing code.');
      return;
    }
    setLinking(true);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('claim_pairing_code', {
        p_code: formattedCode,
      });

      if (!rpcError && rpcData?.success) {
        Alert.alert('Success', 'Patient linked to your care roster successfully!');
        setModalVisible(false);
        setPairingInput('');
        fetchRosterStats();
        return;
      }

      // Fallback direct link
      const { data, error } = await supabase
        .from('patient_caregivers')
        .select('patient_id, caregiver_id')
        .eq('pairing_code', formattedCode)
        .single();

      if (error || !data) {
        Alert.alert('Error', rpcError?.message || 'Invalid pairing code or patient not found.');
        return;
      }

      if (data.caregiver_id) {
        Alert.alert('Already Linked', 'This patient is already linked to a caregiver or doctor.');
        return;
      }

      const { error: updateError } = await supabase
        .from('patient_caregivers')
        .update({ caregiver_id: session.user.id })
        .eq('pairing_code', formattedCode);

      if (!updateError) {
        Alert.alert('Success', 'Patient linked to your clinical roster!');
        setModalVisible(false);
        setPairingInput('');
        fetchRosterStats();
      } else {
        Alert.alert('Error', 'Failed to link patient.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to link patient.');
    } finally {
      setLinking(false);
    }
  };

  const openAlarmSoundSettings = async () => {
    triggerHaptic();
    if (Platform.OS === 'android') {
      try {
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
          'To ensure high-priority clinical notifications fire on time, enable "Alarms & Reminders" for MedSync in device settings.',
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

  const handleLogout = async () => {
    triggerHaptic();
    Alert.alert(
      'Sign Out of MedSync?',
      'Are you sure you want to log out of your clinical session?',
      [
        { text: 'Stay Logged In', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Error', 'Failed to sign out.');
            } else {
              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Doctor Settings"
        subtitle="Clinical preferences & practice management"
        fallbackRoute="/(tabs)/caregiver-dashboard"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Physician Profile & Credential Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarPlate}>
              <Ionicons name="medical" size={32} color={Theme.colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.doctorName}>
                {profile?.full_name?.startsWith('Dr.') ? profile.full_name : `Dr. ${profile?.full_name || 'Evelyn Reed, MD'}`}
              </Text>
              <Text style={styles.doctorSpecialty}>Internal Medicine &amp; Geriatrics</Text>
              <Text style={styles.practiceName}>MedSync Clinical Tele-Health Network</Text>
            </View>
          </View>

          {/* Verification Badge */}
          <View
            style={[
              styles.verificationRow,
              isVerifiedDoctor ? styles.verifiedRowBg : styles.pendingRowBg,
            ]}
          >
            <Ionicons
              name={isVerifiedDoctor ? 'shield-checkmark' : 'shield-outline'}
              size={20}
              color={isVerifiedDoctor ? Theme.colors.success : Theme.colors.secondary}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.verificationTitle,
                  { color: isVerifiedDoctor ? Theme.colors.success : Theme.colors.secondary },
                ]}
              >
                {isVerifiedDoctor ? 'Verified Medical Doctor (MD)' : 'Clinical Credential Pending'}
              </Text>
              <Text style={styles.verificationDesc}>
                {isVerifiedDoctor
                  ? 'Authorized to approve prescription OCR extractions and schedule medications.'
                  : 'Credential review required to approve prescription schedules.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Practice & Roster Quick Overview */}
        <Text style={styles.sectionTitle}>Practice &amp; Patient Roster</Text>
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => {
              triggerHaptic();
              router.push('/patient-directory');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Linked Patients: ${linkedCount}. Tap to view directory`}
          >
            <View style={[styles.metricIconPlate, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="people" size={24} color="#0284C7" />
            </View>
            {loadingStats ? (
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            ) : (
              <Text style={styles.metricValue}>{linkedCount}</Text>
            )}
            <Text style={styles.metricLabel}>Linked Patients</Text>
            <View style={styles.metricActionRow}>
              <Text style={styles.metricActionText}>Open Directory</Text>
              <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => {
              triggerHaptic();
              router.push('/(tabs)/caregiver-dashboard');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Pending Reviews: ${pendingReviewsCount}. Tap to review`}
          >
            <View style={[styles.metricIconPlate, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="document-text" size={24} color="#D97706" />
            </View>
            {loadingStats ? (
              <ActivityIndicator size="small" color={Theme.colors.primary} />
            ) : (
              <Text style={styles.metricValue}>{pendingReviewsCount}</Text>
            )}
            <Text style={styles.metricLabel}>Pending Reviews</Text>
            <View style={styles.metricActionRow}>
              <Text style={styles.metricActionText}>Review Queue</Text>
              <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Link Patient Button */}
        <View style={{ marginBottom: 24 }}>
          <SeniorButton
            title="Link New Patient (Pairing Code)"
            onPress={() => {
              triggerHaptic();
              setModalVisible(true);
            }}
            variant="outline"
            size="normal"
            icon={<Ionicons name="person-add-outline" size={20} color={Theme.colors.primary} />}
          />
        </View>

        {/* Clinical Alerts & Notifications */}
        <Text style={styles.sectionTitle}>Clinical Notification Preferences</Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="warning-outline" size={22} color={Theme.colors.error} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Critical Missed Dose Alerts</Text>
                <Text style={styles.settingSubtitle}>
                  High-priority alerts when a linked patient misses 2+ doses
                </Text>
              </View>
            </View>
            <Switch
              value={alertsEnabled}
              onValueChange={handleToggleAlerts}
              trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="scan-outline" size={22} color={Theme.colors.primary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Prescription OCR Uploads</Text>
                <Text style={styles.settingSubtitle}>
                  Notify immediately when a patient uploads a prescription for approval
                </Text>
              </View>
            </View>
            <Switch
              value={reviewPushEnabled}
              onValueChange={(val) => {
                triggerHaptic();
                setReviewPushEnabled(val);
              }}
              trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="trending-down-outline" size={22} color="#D97706" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Low Adherence Warning</Text>
                <Text style={styles.settingSubtitle}>
                  Highlight patients with adherence streak below 75%
                </Text>
              </View>
            </View>
            <Switch
              value={lowAdherenceWarning}
              onValueChange={(val) => {
                triggerHaptic();
                setLowAdherenceWarning(val);
              }}
              trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="newspaper-outline" size={22} color={Theme.colors.onSurfaceVariant} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Morning Clinical Digest</Text>
                <Text style={styles.settingSubtitle}>
                  Daily 8:00 AM summary of patient roster compliance
                </Text>
              </View>
            </View>
            <Switch
              value={dailyDigestEnabled}
              onValueChange={(val) => {
                triggerHaptic();
                setDailyDigestEnabled(val);
              }}
              trackColor={{ false: Theme.colors.surfaceContainerHigh, true: Theme.colors.primary }}
            />
          </View>
        </View>

        {/* Device Notification Channels (Android) */}
        {Platform.OS === 'android' && (
          <View style={[styles.card, { marginTop: 12 }]}>
            <TouchableOpacity style={styles.settingRow} onPress={openAlarmSoundSettings}>
              <View style={styles.settingInfo}>
                <Ionicons name="volume-medium-outline" size={22} color={Theme.colors.onSurfaceVariant} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Alert Sound &amp; Vibration</Text>
                  <Text style={styles.settingSubtitle}>Configure clinical alert ringtones</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Theme.colors.outline} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomWidth: 0 }]}
              onPress={openExactAlarmSettings}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="time-outline" size={22} color={Theme.colors.onSurfaceVariant} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>Exact Timing Permissions</Text>
                  <Text style={styles.settingSubtitle}>Allow emergency alerts in power-save mode</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Theme.colors.outline} />
            </TouchableOpacity>
          </View>
        )}

        {/* Accessibility & Voice Settings */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Accessibility &amp; Interface</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="contrast-outline" size={22} color={Theme.colors.onSurfaceVariant} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>High-Contrast Mode</Text>
                <Text style={styles.settingSubtitle}>Enhanced text legibility and border contrast</Text>
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

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high-outline" size={22} color={Theme.colors.onSurfaceVariant} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Audio Read-Aloud</Text>
                <Text style={styles.settingSubtitle}>Voice assistance for prescription details</Text>
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
        </View>

        {/* Privacy, Legal & DPDP Act 2023 */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Compliance &amp; Data Security</Text>
        <View style={styles.card}>
          <View style={styles.complianceHeader}>
            <Ionicons name="shield-checkmark" size={24} color={Theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.complianceTitle}>DPDP Act 2023 Compliant</Text>
              <Text style={styles.complianceDesc}>
                Health records and prescription scans are secured with hardware-backed encryption (AES-256).
                Approvals are logged with cryptographically verifiable physician timestamps.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0, paddingTop: 14 }]}
            onPress={() => {
              triggerHaptic();
              router.push('/privacy-policy');
            }}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="document-text-outline" size={22} color={Theme.colors.primary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Clinical Privacy Policy &amp; Consent</Text>
                <Text style={styles.settingSubtitle}>Review AI processing &amp; regulatory guidelines</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Theme.colors.outline} />
          </TouchableOpacity>
        </View>

        {/* Account & Session Actions */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Account &amp; Session</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => {
              triggerHaptic();
              router.push('/role-selection');
            }}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="swap-horizontal-outline" size={22} color={Theme.colors.primary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Switch Persona / Role</Text>
                <Text style={styles.settingSubtitle}>Switch between Patient and Doctor views</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Theme.colors.outline} />
          </TouchableOpacity>

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
              <Ionicons name="exit-outline" size={22} color={Theme.colors.primary} />
              <Text style={[styles.settingTitle, { color: Theme.colors.onSurface }]}>Exit MedSync</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Theme.colors.outline} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="log-out-outline" size={22} color={Theme.colors.error} />
              <Text style={[styles.settingTitle, { color: Theme.colors.error }]}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Theme.colors.outline} />
          </TouchableOpacity>
        </View>

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Patient Linking Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link Patient to Practice</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={Theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Enter the 8-character pairing code generated on the patient's device under Settings &gt; Caregiver Pairing.
            </Text>

            <TextInput
              style={styles.pairingInput}
              placeholder="e.g. A3K9P2X7"
              placeholderTextColor={Theme.colors.outline}
              value={pairingInput}
              onChangeText={setPairingInput}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />

            <View style={styles.modalButtons}>
              <SeniorButton
                title={linking ? 'Linking...' : 'Confirm Patient Link'}
                onPress={handleLinkPatient}
                loading={linking}
                variant="primary"
                size="normal"
                icon={<Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />}
              />
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
  scrollContent: {
    padding: 12,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    marginBottom: 14,
    ...Theme.shadows.level1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlate: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  profileInfo: {
    flex: 1,
  },
  doctorName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 1,
  },
  doctorSpecialty: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: Theme.colors.primary,
    marginBottom: 1,
  },
  practiceName: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  verifiedRowBg: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pendingRowBg: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  verificationTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
  },
  verificationDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 10.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
    marginBottom: 8,
    marginLeft: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    alignItems: 'center',
    ...Theme.shadows.level1,
  },
  metricIconPlate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  metricLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  metricActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 2,
  },
  metricActionText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.primary,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    overflow: 'hidden',
    marginBottom: 10,
    ...Theme.shadows.level1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceContainerLow,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  settingTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: Theme.colors.onSurface,
  },
  settingSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
  },
  complianceTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#0369A1',
    marginBottom: 2,
  },
  complianceDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#075985',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    ...Theme.shadows.cardElevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  modalDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 18,
  },
  pairingInput: {
    height: 56,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    borderRadius: 14,
    fontSize: 22,
    fontFamily: 'PublicSans-Bold',
    textAlign: 'center',
    letterSpacing: 4,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceContainerLow,
    marginBottom: 20,
  },
  modalButtons: {
    width: '100%',
  },
  footerSpacing: {
    height: 30,
  },
});
