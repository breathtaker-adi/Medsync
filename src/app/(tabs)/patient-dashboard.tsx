// src/app/(tabs)/patient-dashboard.tsx
import { Entypo, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PulseView } from '../../components/PulseView';
import { SeniorButton } from '../../components/SeniorButton';
import { MedSyncLogo } from '../../components/MedSyncLogo';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useAuth } from '../../context/authcontext';
import { supabase } from '../../lib/supabase';
import { medicationService } from '../../services/medicationService';
import { notificationService } from '../../services/notificationService';
import { Theme } from '../../theme';
import { Medication } from '../../types/medication';
import { avatarHelper } from '../../utils/avatarHelper';
import { showErrorAlert } from '../../utils/errorHandler';
import { checkIfOverdue, getTimeSlot, parseTimeToMinutes, TimeSlot } from '../../utils/timeUtils';

export type { Medication };

export default function PatientDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const { isAccessibilityMode, isAudioEnabled, triggerHaptic } = useAccessibility();

  // Avatar state
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);



  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUri(profile.avatar_url);
    } else if (session?.user?.id) {
      avatarHelper.getLocalAvatar(session.user.id).then((local) => {
        if (local) setAvatarUri(local);
      });
    }
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

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Time slot filter: 'all' | 'morning' | 'afternoon' | 'evening' | 'night'
  const [activeSlot, setActiveSlot] = useState<'all' | TimeSlot>('all');

  // Speaking state for daily brief
  const [isSpeakingDailyBrief, setIsSpeakingDailyBrief] = useState(false);

  // Undo Toast state
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [undoMedId, setUndoMedId] = useState<number | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Add Medication Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('08:00 AM');
  const [newMedQuantity, setNewMedQuantity] = useState('30');
  const [newMedUnit, setNewMedUnit] = useState('Tablets');
  const [newMedWarning, setNewMedWarning] = useState('');
  const [timeError, setTimeError] = useState('');

  const fetchMedications = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const res = await medicationService.fetchDailySchedule(session.user.id);
    if (res.success && res.data) {
      setMedications(res.data);
      await notificationService.scheduleAllAlarms(res.data);
    }
    setLoading(false);
  }, [session?.user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchMedications();
      if (session?.user?.id) {
        avatarHelper.getLocalAvatar(session.user.id).then((local) => {
          if (local) setAvatarUri(local);
        });
      }
    }, [fetchMedications, session?.user?.id])
  );

  // Realtime subscription with unique channel name and try/catch guard
  useEffect(() => {
    if (!session?.user?.id) return;

    const channelName = `patient_meds_dash_${session.user.id}_${Date.now()}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'medications',
            filter: `patient_id=eq.${session.user.id}`,
          },
          () => {
            fetchMedications();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'medication_logs',
            filter: `patient_id=eq.${session.user.id}`,
          },
          () => {
            fetchMedications();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[PatientDashboard] Realtime subscription error:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [session?.user?.id, fetchMedications]);

  const handleAddMedication = async () => {
    if (!newMedName.trim() || !newMedDosage.trim() || !newMedTime.trim() || !session?.user?.id) {
      Alert.alert('Missing Info', 'Please fill out all required fields.');
      return;
    }

    // Strict 12-hour time regex validation (HH:MM AM/PM)
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i;
    if (!timeRegex.test(newMedTime.trim())) {
      setTimeError('Enter a valid time (e.g., 08:00 AM or 07:30 PM)');
      Alert.alert(
        'Invalid Time Format',
        'Please enter a valid scheduled time in 12-hour format, e.g., 08:00 AM or 07:30 PM.'
      );
      return;
    }
    setTimeError('');

    const parsedQty = parseInt(newMedQuantity, 10);
    const validQty = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 30;
    const formattedDosage = `${newMedDosage.trim()} (${validQty} ${newMedUnit})`;

    const res = await medicationService.createMedication({
      patientId: session.user.id,
      medicineName: newMedName.trim(),
      dosage: formattedDosage,
      time: newMedTime.trim().toUpperCase(),
      warning: newMedWarning.trim() || null,
      pillsRemaining: validQty,
    });

    if (res.success) {
      triggerHaptic();
      setNewMedName('');
      setNewMedDosage('');
      setNewMedTime('08:00 AM');
      setNewMedQuantity('30');
      setNewMedUnit('Tablets');
      setNewMedWarning('');
      setTimeError('');
      setAddModalVisible(false);

      await fetchMedications();
      Alert.alert(
        'Success',
        `${newMedName} added with ${validQty} ${newMedUnit} scheduled at ${newMedTime.trim().toUpperCase()}!`
      );
    } else {
      showErrorAlert(res.error, 'Could Not Add Medication');
    }
  };

  const handleTaken = (med: Medication) => {
    triggerHaptic();
    setUndoMedId(med.id);

    const updatedMeds = medications.map((m) =>
      m.id === med.id ? { ...m, status: 'taken', isOverdue: false } : m
    );
    setMedications(updatedMeds);
    notificationService.scheduleAllAlarms(updatedMeds);

    setUndoToastVisible(true);

    const timer = setTimeout(() => {
      commitTakenToDatabase(med.id);
      setUndoToastVisible(false);
    }, 4000);

    setUndoTimer(timer);
  };

  const commitTakenToDatabase = async (id: number, cameraVerified: boolean = false) => {
    if (!session?.user?.id) return;
    const takenMed = medications.find((m) => m.id === id);

    const res = await medicationService.recordDoseWithInventory({
      medicationId: id,
      patientId: session.user.id,
      scheduledTime: takenMed?.time || '00:00',
      cameraVerified,
      currentPillsRemaining: takenMed?.pills_remaining,
    });

    if (res.success) {
      const newPillCount = res.data.pillsRemaining;
      setMedications((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, pills_remaining: newPillCount, camera_verified: cameraVerified }
            : m
        )
      );

      if (newPillCount <= 5 && newPillCount > 0 && takenMed) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Refill Reminder',
            body: `Only ${newPillCount} doses of ${takenMed.medicine_name} left. Tap to reorder.`,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date() },
        });
      }
    } else {
      showErrorAlert(res.error, 'Error Saving Dose');
    }
  };

  const handleCameraProof = async (med: Medication) => {
    triggerHaptic();
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is needed to capture proof of dose intake.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.3,
      });

      if (!result.canceled) {
        commitTakenToDatabase(med.id, true);

        const updatedMeds = medications.map((m) =>
          m.id === med.id
            ? { ...m, status: 'taken', isOverdue: false, camera_verified: true }
            : m
        );
        setMedications(updatedMeds);
        notificationService.scheduleAllAlarms(updatedMeds);
        Alert.alert(
          'Dose Confirmed',
          `Camera proof verified for ${med.medicine_name}. Adherence recorded!`
        );
      }
    } catch (err) {
      console.error('Camera proof error:', err);
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const handleUndoTaken = () => {
    triggerHaptic();
    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }

    const revertedMeds = medications.map((m) =>
      m.id === undoMedId ? { ...m, status: 'pending', isOverdue: checkIfOverdue(m.time) } : m
    );
    setMedications(revertedMeds);
    notificationService.scheduleAllAlarms(revertedMeds);

    setUndoToastVisible(false);
    setUndoMedId(null);
  };

  const handleSnooze = async (med: Medication) => {
    triggerHaptic();

    if ((med.snooze_count || 0) >= 2) {
      Alert.alert('Max Snoozes Reached', 'You must take or skip this medication now.');
      return;
    }

    const currentSnooze = med.snooze_count || 0;
    const updatedMeds = medications.map((m) =>
      m.id === med.id ? { ...m, snooze_count: currentSnooze + 1 } : m
    );
    setMedications(updatedMeds);

    await notificationService.scheduleSnoozeNotification(med, 20);
    Alert.alert('Snoozed', `${med.medicine_name} alarm snoozed for 20 minutes.`);

    if (session?.user?.id) {
      await medicationService.snoozeDose(med.id, session.user.id, med.time, currentSnooze);
    }
  };

  const handleReadAloudMed = (med: Medication) => {
    triggerHaptic();
    if (!isAudioEnabled) {
      Alert.alert(
        'Read Aloud Disabled',
        "Voice guidance is currently off. You can enable 'Read Aloud (Audio)' in Settings.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }
    notificationService.speakMedication(med, isAudioEnabled);
  };

  // Hands-free Daily Routine Audio Overview
  const handleReadAloudDay = () => {
    triggerHaptic();
    if (isSpeakingDailyBrief) {
      notificationService.stopSpeaking();
      setIsSpeakingDailyBrief(false);
      return;
    }

    if (!isAudioEnabled) {
      Alert.alert(
        'Read Aloud Disabled',
        "Voice guidance is currently off. You can enable 'Read Aloud (Audio)' in Settings.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }

    const totalCount = medications.length;
    const takenCount = medications.filter((m) => m.status === 'taken').length;
    const pendingMeds = medications.filter((m) => m.status !== 'taken' && m.status !== 'skipped');

    let text = `Hello. Today you have ${totalCount} scheduled ${
      totalCount === 1 ? 'dose' : 'doses'
    }. You have taken ${takenCount}. `;

    if (pendingMeds.length > 0) {
      text += `Your next upcoming ${pendingMeds.length === 1 ? 'dose is' : 'doses are'}: `;
      pendingMeds.slice(0, 3).forEach((m) => {
        text += `${m.medicine_name}, ${m.dosage}, at ${m.time}. `;
      });
    } else if (totalCount > 0) {
      text += 'Congratulations! You have completed all your medications for today.';
    } else {
      text += 'You have no scheduled doses for today.';
    }

    const spoken = notificationService.speakText(text, isAudioEnabled);
    if (spoken) {
      setIsSpeakingDailyBrief(true);
      setTimeout(() => setIsSpeakingDailyBrief(false), 8000);
    }
  };

  // Filtered Medications by Slot
  const filteredMedications = useMemo(() => {
    if (activeSlot === 'all') return medications;
    return medications.filter((m) => getTimeSlot(m.time) === activeSlot);
  }, [medications, activeSlot]);

  // Quadrant Counts
  const slotCounts = useMemo(() => {
    return {
      all: medications.length,
      morning: medications.filter((m) => getTimeSlot(m.time) === 'morning').length,
      afternoon: medications.filter((m) => getTimeSlot(m.time) === 'afternoon').length,
      evening: medications.filter((m) => getTimeSlot(m.time) === 'evening').length,
      night: medications.filter((m) => getTimeSlot(m.time) === 'night').length,
    };
  }, [medications]);

  // Adherence Calculations
  const takenCount = medications.filter((m) => m.status === 'taken').length;
  const adherencePercent =
    medications.length > 0 ? Math.round((takenCount / medications.length) * 100) : 100;

  // Time of Day Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const patientFirstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'there';

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const renderMedicationCard = (med: Medication) => {
    const isTaken = med.status === 'taken';
    const isSkipped = med.status === 'skipped';
    const isPending = !isTaken && !isSkipped;
    const isOverdue = med.isOverdue && isPending;

    const cardContent = (
      <View
        style={[
          styles.medCard,
          isAccessibilityMode && styles.highContrastMedCard,
          isOverdue && styles.overdueMedCard,
          isTaken && styles.takenMedCard,
        ]}
      >
        {/* Top Header of Card */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.badgeGroup}>
            <View
              style={[
                styles.statusBadge,
                isOverdue
                  ? styles.statusBadgeOverdue
                  : isTaken
                  ? styles.statusBadgeTaken
                  : styles.statusBadgePending,
              ]}
            >
              <Ionicons
                name={isOverdue ? 'alert-circle' : isTaken ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={isOverdue ? '#DC2626' : isTaken ? '#059669' : Theme.colors.primary}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  isOverdue
                    ? styles.statusTextOverdue
                    : isTaken
                    ? styles.statusTextTaken
                    : styles.statusTextPending,
                  isAccessibilityMode && styles.largeStatusText,
                ]}
              >
                {isOverdue ? 'OVERDUE' : isTaken ? 'COMPLETED' : 'SCHEDULED'}
              </Text>
            </View>

            {med.pills_remaining != null && (
              <View
                style={[
                  styles.stockBadge,
                  med.pills_remaining <= 5 && styles.stockBadgeLow,
                ]}
              >
                <Ionicons
                  name="medical"
                  size={12}
                  color={med.pills_remaining <= 5 ? '#DC2626' : '#0D9488'}
                />
                <Text
                  style={[
                    styles.stockText,
                    med.pills_remaining <= 5 && styles.stockTextLow,
                  ]}
                >
                  {med.pills_remaining} left
                </Text>
              </View>
            )}
          </View>

          {/* Top Right Actions */}
          <View style={styles.cardHeaderActions}>
            <TouchableOpacity
              onPress={() => router.push(`/medication-details?id=${med.id}`)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.cardMoreBtn}
              accessibilityLabel="Medication options"
            >
              <Entypo name="dots-three-vertical" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Medication Info Section */}
        <View style={styles.cardBodyRow}>
          <View style={styles.medTextCol}>
            <Text
              style={[
                styles.medicineName,
                isAccessibilityMode && styles.largeMedicineName,
              ]}
            >
              {med.medicine_name}
            </Text>
            <Text
              style={[
                styles.medicineDosage,
                isAccessibilityMode && styles.largeMedicineDosage,
              ]}
            >
              {med.dosage}
            </Text>

            {med.food_warning ? (
              <View style={styles.instructionChip}>
                <Ionicons name="information-circle-outline" size={13} color="#D97706" />
                <Text style={styles.instructionText}>{med.food_warning}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.timePlate}>
            <Ionicons name="alarm-outline" size={14} color="#64748B" />
            <Text style={[styles.timeText, isAccessibilityMode && styles.largeTimeText]}>
              {med.time}
            </Text>
          </View>
        </View>

        {/* Bottom Actions Row */}
        {isTaken ? (
          <View style={styles.takenConfirmationBanner}>
            <Ionicons name="checkmark-done" size={20} color="#059669" />
            <Text
              style={[
                styles.takenConfirmationText,
                isAccessibilityMode && styles.largeButtonText,
              ]}
            >
              {med.camera_verified ? 'Verified with Photo Proof' : 'Completed for Today'}
            </Text>
          </View>
        ) : isSkipped ? (
          <View style={styles.skippedBanner}>
            <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
            <Text style={styles.skippedBannerText}>Dose Skipped</Text>
          </View>
        ) : (
          <View style={styles.actionControlsRow}>
            {/* Primary Action Button */}
            <View style={{ flex: 1 }}>
              <SeniorButton
                title="I TOOK IT"
                variant="success"
                icon={<Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />}
                onPress={() => handleTaken(med)}
              />
            </View>

            {/* Camera Proof Action */}
            <TouchableOpacity
              style={[
                styles.cameraProofBtn,
                isAccessibilityMode && styles.largeCameraBtn,
              ]}
              onPress={() => handleCameraProof(med)}
              accessibilityRole="button"
              accessibilityLabel={`Verify ${med.medicine_name} with camera proof`}
            >
              <Ionicons name="camera-outline" size={22} color={Theme.colors.primary} />
            </TouchableOpacity>

            {/* Snooze 20m Button */}
            <TouchableOpacity
              style={[
                styles.snoozeBtn,
                isAccessibilityMode && styles.largeSnoozeBtn,
                (med.snooze_count || 0) >= 2 && styles.disabledBtn,
              ]}
              onPress={() => handleSnooze(med)}
              disabled={(med.snooze_count || 0) >= 2}
              accessibilityRole="button"
              accessibilityLabel={`Snooze ${med.medicine_name} for 20 minutes`}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={(med.snooze_count || 0) >= 2 ? '#CBD5E1' : '#334155'}
              />
              <Text
                style={[
                  styles.snoozeBtnLabel,
                  (med.snooze_count || 0) >= 2 && { color: '#CBD5E1' },
                ]}
              >
                +20m
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );

    if (isOverdue) {
      return (
        <PulseView key={med.id} active={true} minScale={0.99} maxScale={1.01} duration={1400}>
          {cardContent}
        </PulseView>
      );
    }

    return <View key={med.id}>{cardContent}</View>;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={[styles.loadingLabel, isAccessibilityMode && styles.largeText]}>
          Loading Medication Routine...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          padding: 14,
          paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 8 : 12),
          paddingBottom: 72,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Theme.colors.primary]}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* Top App Bar: Brand Logo on Left, Avatar & Settings on Right */}
        <View style={styles.topAppBar}>
          <MedSyncLogo size={40} variant="horizontal" />
          <View style={styles.headerActionCluster}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.headerAvatarImage} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarInitial}>
                    {(patientFirstName?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.headerCameraBadge}>
                <Ionicons name="camera" size={10} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsIconButton}
              onPress={() => {
                triggerHaptic();
                router.push('/settings');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
            >
              <Ionicons
                name="settings-outline"
                size={21}
                color={Theme.colors.onSurface}
              />
            </TouchableOpacity>
          </View>
        </View>



        {/* Header Greeting Row */}
        <View style={styles.headerRow}>
          <View style={styles.headerGreetingCol}>
            <Text style={[styles.greetingSubtext, isAccessibilityMode && styles.largeText]}>
              {todayFormatted}
            </Text>
            <Text
              style={[styles.greetingTitle, isAccessibilityMode && styles.largeGreetingTitle]}
            >
              {greeting}, {patientFirstName}
            </Text>
          </View>
        </View>

        {/* Adherence Hero Card */}
        {medications.length > 0 && (
          <View
            style={[
              styles.heroAdherenceCard,
              isAccessibilityMode && styles.highContrastHeroCard,
            ]}
          >
            <View style={styles.heroTopRow}>
              <View>
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color="#F59E0B" />
                  <Text style={styles.streakBadgeText}>7-Day Adherence Streak</Text>
                </View>
                <Text style={styles.heroTitle}>Today's Routine</Text>
                <Text style={styles.heroSubtitle}>
                  {takenCount} of {medications.length} doses taken
                </Text>
              </View>

              <View
                style={[
                  styles.percentPill,
                  takenCount === medications.length && styles.percentPillCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.percentPillText,
                    takenCount === medications.length && styles.percentPillTextCompleted,
                  ]}
                >
                  {adherencePercent}%
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarIndicator,
                  {
                    width: `${adherencePercent}%`,
                    backgroundColor:
                      takenCount === medications.length ? '#34D399' : '#46E4C1',
                  },
                ]}
              />
            </View>

            {takenCount === medications.length ? (
              <View style={styles.heroAllDoneNotice}>
                <Ionicons name="sparkles" size={16} color="#34D399" />
                <Text style={styles.heroAllDoneText}>
                  Outstanding! All scheduled doses completed for today.
                </Text>
              </View>
            ) : (
              <Text style={styles.heroRemainingNotice}>
                {medications.length - takenCount}{' '}
                {medications.length - takenCount === 1 ? 'dose' : 'doses'} remaining today
              </Text>
            )}
          </View>
        )}

        {/* Time-of-Day Quadrant Filter Tabs */}
        {medications.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.slotsScroll}
          >
            <TouchableOpacity
              style={[styles.slotTab, activeSlot === 'all' && styles.slotTabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveSlot('all');
              }}
            >
              <Text style={[styles.slotTabText, activeSlot === 'all' && styles.slotTabTextActive]}>
                All Doses ({slotCounts.all})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.slotTab, activeSlot === 'morning' && styles.slotTabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveSlot('morning');
              }}
            >
              <Ionicons
                name="sunny-outline"
                size={14}
                color={activeSlot === 'morning' ? '#FFFFFF' : '#D97706'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.slotTabText,
                  activeSlot === 'morning' && styles.slotTabTextActive,
                ]}
              >
                Morning ({slotCounts.morning})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.slotTab, activeSlot === 'afternoon' && styles.slotTabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveSlot('afternoon');
              }}
            >
              <Ionicons
                name="partly-sunny-outline"
                size={14}
                color={activeSlot === 'afternoon' ? '#FFFFFF' : '#0284C7'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.slotTabText,
                  activeSlot === 'afternoon' && styles.slotTabTextActive,
                ]}
              >
                Afternoon ({slotCounts.afternoon})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.slotTab, activeSlot === 'evening' && styles.slotTabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveSlot('evening');
              }}
            >
              <Ionicons
                name="moon-outline"
                size={14}
                color={activeSlot === 'evening' ? '#FFFFFF' : '#EA580C'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.slotTabText,
                  activeSlot === 'evening' && styles.slotTabTextActive,
                ]}
              >
                Evening ({slotCounts.evening})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.slotTab, activeSlot === 'night' && styles.slotTabActive]}
              onPress={() => {
                triggerHaptic();
                setActiveSlot('night');
              }}
            >
              <Ionicons
                name="cloudy-night-outline"
                size={14}
                color={activeSlot === 'night' ? '#FFFFFF' : '#7C3AED'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.slotTabText,
                  activeSlot === 'night' && styles.slotTabTextActive,
                ]}
              >
                Night ({slotCounts.night})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Medication Cards List */}
        {filteredMedications.length === 0 ? (
          <View
            style={[
              styles.emptyStateCard,
              isAccessibilityMode && styles.highContrastMedCard,
            ]}
          >
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-done-circle" size={44} color="#10B981" />
            </View>
            <Text style={styles.emptyStateTitle}>
              {medications.length === 0
                ? 'No Scheduled Doses'
                : 'No Doses in This Time Slot'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {medications.length === 0
                ? 'Tap the button below or scan your prescription to add medications.'
                : 'Switch tabs above to view doses scheduled in other time slots.'}
            </Text>
          </View>
        ) : (
          <View style={styles.medsList}>
            {filteredMedications.map(renderMedicationCard)}
          </View>
        )}

        {/* Quick Health Actions Banner */}
        <View style={styles.quickActionsContainer}>
          <Text style={[styles.quickActionsTitle, isAccessibilityMode && styles.largeText]}>
            Health Shortcuts
          </Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => {
                triggerHaptic();
                router.push('/(tabs)/uploads');
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#CCFBF1' }]}>
                <Ionicons name="camera" size={20} color="#0F766E" />
              </View>
              <Text style={styles.quickActionLabel}>Scan Rx Slip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => {
                triggerHaptic();
                router.push('/paused-medications' as any);
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="pause-circle" size={20} color="#D97706" />
              </View>
              <Text style={styles.quickActionLabel}>Paused Meds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionTile}
              onPress={() => {
                triggerHaptic();
                router.push('/doctor-link');
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="people" size={20} color="#6D28D9" />
              </View>
              <Text style={styles.quickActionLabel}>My Doctors</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button for Manual Add */}
      <TouchableOpacity
        style={[styles.fabButton, isAccessibilityMode && styles.largeFabButton]}
        onPress={() => {
          triggerHaptic();
          setAddModalVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add medication to schedule"
      >
        <Ionicons name="add" size={isAccessibilityMode ? 36 : 30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Manual Add Medication Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              isAccessibilityMode && styles.highContrastMedCard,
            ]}
          >
            <View style={styles.modalHeaderIcon}>
              <Ionicons name="medkit" size={28} color={Theme.colors.primary} />
            </View>

            <Text style={[styles.modalTitle, isAccessibilityMode && styles.largeText]}>
              Add Medication
            </Text>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Medicine Name *</Text>
              <TextInput
                style={[styles.textInput, isAccessibilityMode && styles.largeTextInput]}
                placeholder="e.g., Metformin"
                placeholderTextColor="#94A3B8"
                value={newMedName}
                onChangeText={setNewMedName}
              />
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Dosage *</Text>
              <TextInput
                style={[styles.textInput, isAccessibilityMode && styles.largeTextInput]}
                placeholder="e.g., 500mg"
                placeholderTextColor="#94A3B8"
                value={newMedDosage}
                onChangeText={setNewMedDosage}
              />
            </View>

            {/* Restricted Time Input with Presets */}
            <View style={styles.inputBlock}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.inputLabel}>Scheduled Time *</Text>
                <Text style={styles.inputHelpText}>12-hr format (e.g. 08:00 AM)</Text>
              </View>

              {/* Quick Time Presets */}
              <View style={styles.timePresetRow}>
                {['08:00 AM', '01:00 PM', '07:00 PM', '10:00 PM'].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.timePresetBtn,
                      newMedTime === preset && styles.timePresetBtnActive,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setNewMedTime(preset);
                      setTimeError('');
                    }}
                  >
                    <Text
                      style={[
                        styles.timePresetText,
                        newMedTime === preset && styles.timePresetTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.textInput,
                  timeError ? styles.textInputError : undefined,
                  isAccessibilityMode && styles.largeTextInput,
                ]}
                placeholder="08:00 AM"
                placeholderTextColor="#94A3B8"
                value={newMedTime}
                maxLength={8}
                onChangeText={(text) => {
                  // Allow only digits, colon, spaces, and A/P/M
                  const cleaned = text.replace(/[^0-9: apmAPM]/g, '').slice(0, 8);
                  setNewMedTime(cleaned);
                  if (timeError) setTimeError('');
                }}
              />
              {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}
            </View>

            {/* Supply Quantity & Units */}
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Supply Quantity & Units *</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <TextInput
                  style={[
                    styles.textInput,
                    { width: 90, textAlign: 'center' },
                    isAccessibilityMode && styles.largeTextInput,
                  ]}
                  placeholder="30"
                  placeholderTextColor="#94A3B8"
                  value={newMedQuantity}
                  keyboardType="numeric"
                  onChangeText={(text) => setNewMedQuantity(text.replace(/[^0-9]/g, ''))}
                />
                <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 13, color: '#475569' }}>
                  {newMedUnit}
                </Text>
              </View>

              {/* Unit Selector Chips */}
              <View style={styles.unitChipsRow}>
                {['Tablets', 'Capsules', 'ml (Liquid)', 'Grams', 'Units'].map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.unitChip,
                      newMedUnit === unit && styles.unitChipActive,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setNewMedUnit(unit);
                    }}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        newMedUnit === unit && styles.unitChipTextActive,
                      ]}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Instructions (Optional)</Text>
              <TextInput
                style={[styles.textInput, isAccessibilityMode && styles.largeTextInput]}
                placeholder="e.g., Take with food"
                placeholderTextColor="#94A3B8"
                value={newMedWarning}
                onChangeText={setNewMedWarning}
              />
            </View>

            <View style={styles.modalButtonsGroup}>
              <SeniorButton
                title="Save Medication"
                onPress={handleAddMedication}
                variant="primary"
                size="normal"
                icon={<Ionicons name="save" size={20} color="#FFFFFF" />}
              />
              <SeniorButton
                title="Cancel"
                onPress={() => setAddModalVisible(false)}
                variant="outline"
                size="normal"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo Toast Notification */}
      {undoToastVisible && (
        <View style={styles.undoToast}>
          <View style={styles.undoToastLeft}>
            <Ionicons name="checkmark-circle" size={20} color="#34D399" />
            <Text style={styles.undoToastText}>Marked as Taken</Text>
          </View>
          <TouchableOpacity
            onPress={handleUndoTaken}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.undoBtn}
          >
            <Text style={styles.undoBtnText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  loadingLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 15,
    color: '#64748B',
    marginTop: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 16,
  },
  headerActionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...Theme.shadows.card,
  },
  headerAvatarInitial: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  headerCameraBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  brandBar: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerGreetingCol: {
    flex: 1,
    paddingRight: 10,
  },
  greetingSubtext: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#0D9488',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greetingTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 20,
    color: '#0F172A',
  },
  largeGreetingTitle: {
    fontSize: 24,
  },
  headerIconsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  headerActionBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  largeActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  // Hero Card
  heroAdherenceCard: {
    backgroundColor: '#006874',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    ...Theme.shadows.cardElevated,
  },
  highContrastHeroCard: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  streakBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#FEF3C7',
  },
  heroTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#CCFBF1',
  },
  percentPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  percentPillCompleted: {
    backgroundColor: '#10B981',
  },
  percentPillText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  percentPillTextCompleted: {
    color: '#FFFFFF',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarIndicator: {
    height: '100%',
    borderRadius: 3,
  },
  heroAllDoneNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  heroAllDoneText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#A7F3D0',
  },
  heroRemainingNotice: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#CCFBF1',
  },
  // Quadrant Slots Scroll
  slotsScroll: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 2,
  },
  slotTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotTabActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  slotTabText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#64748B',
  },
  slotTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PublicSans-Bold',
  },
  // Med Cards
  medsList: {
    gap: 10,
    marginBottom: 16,
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  highContrastMedCard: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  overdueMedCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFDFD',
  },
  takenMedCard: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgePending: {
    backgroundColor: '#E0F2FE',
  },
  statusBadgeTaken: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeOverdue: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  statusTextPending: {
    color: Theme.colors.primary,
  },
  statusTextTaken: {
    color: '#059669',
  },
  statusTextOverdue: {
    color: '#DC2626',
  },
  largeStatusText: {
    fontSize: 11,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stockBadgeLow: {
    backgroundColor: '#FEE2E2',
  },
  stockText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#0F766E',
  },
  stockTextLow: {
    color: '#DC2626',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardAudioBtn: {
    padding: 3,
  },
  cardMoreBtn: {
    padding: 3,
  },
  // Card Body
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pillIconPlate: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pillIconPlateTaken: {
    backgroundColor: '#DCFCE7',
  },
  medTextCol: {
    flex: 1,
    paddingRight: 6,
  },
  medicineName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
    marginBottom: 2,
  },
  largeMedicineName: {
    fontSize: 18,
  },
  medicineDosage: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  largeMedicineDosage: {
    fontSize: 14,
  },
  instructionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  instructionText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#D97706',
  },
  timePlate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#334155',
  },
  largeTimeText: {
    fontSize: 13.5,
  },
  // Card Bottom Actions
  takenConfirmationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  takenConfirmationText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#059669',
  },
  skippedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  skippedBannerText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  actionControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cameraProofBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeCameraBtn: {
    width: 44,
    height: 44,
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
  },
  largeSnoozeBtn: {
    height: 44,
    paddingHorizontal: 12,
  },
  snoozeBtnLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#334155',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  // Empty State
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 10,
  },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 3,
  },
  emptyStateSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Quick Actions
  quickActionsContainer: {
    marginTop: 6,
  },
  quickActionsTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#0F172A',
    marginBottom: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickActionLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#334155',
  },
  // FAB
  fabButton: {
    position: 'absolute',
    bottom: 18,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.cardElevated,
    zIndex: 20,
  },
  largeFabButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    ...Theme.shadows.cardElevated,
  },
  modalHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 17,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  inputBlock: {
    marginBottom: 10,
  },
  inputLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#475569',
    marginBottom: 3,
  },
  inputHelpText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
  },
  timePresetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  timePresetBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePresetBtnActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  timePresetText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#475569',
  },
  timePresetTextActive: {
    color: '#0F766E',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: '#0F172A',
  },
  textInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#DC2626',
    marginTop: 3,
  },
  unitChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  unitChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  unitChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#475569',
  },
  unitChipTextActive: {
    fontFamily: 'PublicSans-Bold',
    color: '#0F766E',
  },
  largeTextInput: {
    fontSize: 15,
    paddingVertical: 10,
  },
  modalButtonsGroup: {
    marginTop: 8,
    gap: 6,
  },
  // Undo Toast
  undoToast: {
    position: 'absolute',
    bottom: 72,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Theme.shadows.cardElevated,
    zIndex: 30,
  },
  undoToastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undoToastText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  undoBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  undoBtnText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 12.5,
    color: '#46E4C1',
  },
  // Accessibility
  largeText: {
    fontSize: 14.5,
  },
  largeButtonText: {
    fontSize: 13.5,
  },
});