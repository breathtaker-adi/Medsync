import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
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
import { Image } from 'expo-image';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { avatarHelper } from '../utils/avatarHelper';

const CLINICAL_SOUND_OPTIONS = [
  {
    name: 'Urgent Clinical Alert',
    desc: 'High-priority pulsating alert for critical dose misses',
  },
  {
    name: 'Standard Hospital Chime',
    desc: 'Crisp medical chime for prescription review notices',
  },
  {
    name: 'Gentle Chime',
    desc: 'Soft harmonic chime suitable for clinical rounds',
  },
  {
    name: 'Vibrant Pulse',
    desc: 'Rhythmic tones with strong haptic vibration',
  },
  {
    name: 'Discreet Vibrate',
    desc: 'Silent mode with double haptic vibration feedback',
  },
];

export default function DoctorSettingsScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
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
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [selectedSound, setSelectedSound] = useState('Urgent Clinical Alert');

  // Roster Statistics
  const [linkedCount, setLinkedCount] = useState<number>(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // Linking Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [pairingInput, setPairingInput] = useState('');
  const [linking, setLinking] = useState(false);

  // Avatar State
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);



  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUri(profile.avatar_url);
    } else if (session?.user?.id) {
      avatarHelper.getLocalAvatar(session.user.id).then((local) => {
        if (local) setAvatarUri(local);
      });
    }

    AsyncStorage.getItem('@medsync_doctor_alarm_sound').then((val) => {
      if (val) {
        setSelectedSound(val);
      } else {
        AsyncStorage.getItem('@medsync_alarm_sound').then((patientVal) => {
          if (patientVal) setSelectedSound(patientVal);
        });
      }
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

  // System gesture/hardware back navigation: Always return to clinical dashboard
  useEffect(() => {
    const onBackPress = () => {
      router.replace('/(tabs)/caregiver-dashboard');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

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

  const handleSelectSound = async (soundName: string) => {
    triggerHaptic();
    setSelectedSound(soundName);
    await AsyncStorage.setItem('@medsync_doctor_alarm_sound', soundName);
    await AsyncStorage.setItem('@medsync_alarm_sound', soundName);

    // Provide haptic feedback
    if (soundName === 'Discreet Vibrate') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Play voice/speech sound preview
    Speech.stop();
    Speech.speak(`Alert sound: ${soundName}. Urgent clinical update.`, {
      pitch: soundName === 'Urgent Clinical Alert' ? 1.3 : soundName === 'Gentle Chime' ? 1.1 : 1.0,
      rate: 0.95,
    });
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
        onBack={() => router.replace('/(tabs)/caregiver-dashboard')}
        fallbackRoute="/(tabs)/caregiver-dashboard"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Physician Profile & Credential Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.avatarPlate}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityLabel="Change physician profile picture"
              accessibilityRole="button"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="medical" size={28} color={Theme.colors.primary} />
              )}
              <View style={styles.doctorCameraBadge}>
                <Ionicons name="camera" size={11} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.doctorName}>
                {profile?.full_name?.startsWith('Dr.') ? profile.full_name : `Dr. ${profile?.full_name || 'Physician'}`}
              </Text>
              <Text style={styles.doctorSpecialty}>
                {profile?.specialty || 'Internal Medicine & Geriatrics'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <TouchableOpacity
                  onPress={handlePickAvatar}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="camera-outline" size={13} color={Theme.colors.primary} />
                  <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 11.5, color: Theme.colors.primary }}>
                    Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    router.push('/edit-profile' as any);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#CCFBF1',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Ionicons name="create-outline" size={12} color="#0D766E" />
                  <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 11.5, color: '#0D766E' }}>
                    Edit Clinical Details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Verification Badge */}
          <TouchableOpacity
            style={[
              styles.verificationRow,
              isVerifiedDoctor ? styles.verifiedRowBg : styles.pendingRowBg,
            ]}
            onPress={() => {
              triggerHaptic();
              router.push('/doctor-verification');
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isVerifiedDoctor
                ? 'Verified Medical Doctor (MD). Tap to view credentials'
                : 'Clinical Credential Pending. Tap to get verified'
            }
          >
            <Ionicons
              name={isVerifiedDoctor ? 'shield-checkmark' : 'shield-outline'}
              size={22}
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
                  : 'Submit your license details to earn the verified MD badge & unlock prescription approvals.'}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isVerifiedDoctor ? Theme.colors.success : Theme.colors.secondary}
            />
          </TouchableOpacity>


        </View>

        {/* Accessibility Status Banner */}
        {isAccessibilityMode && (
          <View style={styles.accessibilityActiveBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#0D7377" />
            <Text style={styles.accessibilityActiveBannerText}>
              Accessibility Mode Active • High Contrast &amp; Large Text Enabled
            </Text>
          </View>
        )}

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
              router.push('/pending-reviews' as any);
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

        {/* Device Notification Channels & Clinical Alerts */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <TouchableOpacity style={styles.settingRow} onPress={openAlarmSoundSettings}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-medium-outline" size={22} color={Theme.colors.primary} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Alert Sound &amp; Vibration</Text>
                <Text style={styles.settingSubtitle}>Current: {selectedSound} • Tap to choose</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.soundBadge}>
                <Text style={styles.soundBadgeText}>{selectedSound}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Theme.colors.outline} />
            </View>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
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
          )}
        </View>

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
              router.push('/clinical-privacy-policy');
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

      {/* Alert Sound & Vibration Modal */}
      <Modal
        visible={alarmModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Speech.stop();
          setAlarmModalVisible(false);
        }}
      >
        <View style={styles.soundModalBackdrop}>
          <View style={styles.soundModalCard}>
            <View style={styles.soundModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.soundModalIconWrap}>
                  <Ionicons name="notifications" size={22} color={Theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.soundModalTitle}>Clinical Alert &amp; Ringtone</Text>
                  <Text style={styles.soundModalSubtitle}>Tap ringtone to preview audio &amp; vibration</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Speech.stop();
                  setAlarmModalVisible(false);
                }}
                style={styles.soundCloseBtn}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginTop: 12 }}>
              {CLINICAL_SOUND_OPTIONS.map((item) => {
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

            <View style={styles.soundModalFooter}>
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
                style={styles.soundModalDoneBtn}
                onPress={() => {
                  Speech.stop();
                  setAlarmModalVisible(false);
                }}
              >
                <Text style={styles.soundModalDoneText}>Done</Text>
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6F4F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  doctorCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0D9488',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
  verifyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    ...Theme.shadows.level1,
  },
  verifyActionBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
  soundModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  soundModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  soundModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  soundModalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6FFFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundModalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  soundModalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  soundCloseBtn: {
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
  soundModalFooter: {
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
  soundModalDoneBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  soundModalDoneText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
