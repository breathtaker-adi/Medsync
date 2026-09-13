// src/app/(tabs)/patient-dashboard.tsx
import { Entypo, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useState } from 'react';
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
import { useAccessibility } from '../../context/AccessibilityContext';
import { useAuth } from '../../context/authcontext';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../theme';

export type Medication = {
  id: number;
  medicine_name: string;
  dosage: string;
  time: string;
  status: string;
  patient_id?: string;
  food_warning?: string;
  pills_remaining?: number;
  isOverdue?: boolean;
  snooze_count?: number;
};

// Helper component for the Timeline Section Headers
const TimelineHeader = ({ icon, title, color }: { icon: string; title: string; color: string }) => (
  <View style={styles.timelineHeader}>
    <Ionicons name={icon as any} size={22} color={color} />
    <Text style={[styles.timelineHeaderText, { color }]}>{title}</Text>
  </View>
);

export default function PatientDashboard() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAccessibilityMode, isAudioEnabled, triggerHaptic } = useAccessibility();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State for Undo Toast functionality
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const [undoMedId, setUndoMedId] = useState<number | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // State for Add Medication Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('');
  const [newMedWarning, setNewMedWarning] = useState('');

  // Helper function to convert ANY time string into sortable minutes
  const parseTimeToMinutes = (timeString: string) => {
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
  };

  // Checks if the current time is past the scheduled medication time
  const checkIfOverdue = (timeString: string) => {
    const medMinutes = parseTimeToMinutes(timeString);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return medMinutes < currentMinutes;
  };

  // Helper function to convert time string into a future Date object for notifications
  const getNextDateForTime = (timeString: string) => {
    const totalMinutes = parseTimeToMinutes(timeString);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const now = new Date();
    const nextDate = new Date();
    nextDate.setHours(hours, minutes, 0, 0);

    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    return nextDate;
  };

  // Schedules automatic alarms for active medications
  const scheduleAllAlarms = async (meds: Medication[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-alarms-auto', {
        name: 'Automatic Medication Alarms',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    for (const med of meds) {
      if (med.status !== 'taken' && med.status !== 'skipped') {
        const triggerDate = getNextDateForTime(med.time);

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
      }
    }
  };

  const fetchMedications = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Fetch master medication list (ONLY ACTIVE ONES)
    const { data: medsData, error: medsError } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', session.user.id)
      .eq('is_active', true);

    if (medsError) {
      console.error('Error fetching medications:', medsError);
    }

    // Fetch daily logs created for today
    const { data: logsData, error: logsError } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('patient_id', session.user.id)
      .eq('log_date', today);

    if (logsError) {
      console.error('Error fetching logs:', logsError);
    }

    // Merge medications with today's logs
    const mergedMeds =
      medsData?.map((med) => {
        const todayLog = logsData?.find((log) => log.medication_id === med.id);
        const currentStatus = todayLog ? todayLog.status : 'pending';

        return {
          ...med,
          status: currentStatus,
          isOverdue: currentStatus === 'pending' && checkIfOverdue(med.time),
          snooze_count: todayLog?.snooze_count || 0,
        };
      }) || [];

    // Sort chronologically
    const sortedData = [...mergedMeds].sort((a, b) => {
      return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
    });

    setMedications(sortedData);
    await scheduleAllAlarms(sortedData);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchMedications();
    }, [session?.user?.id])
  );

  const handleAddMedication = async () => {
    if (!newMedName || !newMedDosage || !newMedTime) {
      Alert.alert('Missing Info', 'Please fill out all fields.');
      return;
    }

    try {
      const { error } = await supabase.from('medications').insert({
        patient_id: session?.user?.id,
        medicine_name: newMedName,
        dosage: newMedDosage,
        time: newMedTime,
        status: 'pending',
        pills_remaining: 30, // Default starting count
        food_warning: newMedWarning || null,
      });

      if (error) throw error;

      // Reset fields and close modal
      setNewMedName('');
      setNewMedDosage('');
      setNewMedTime('');
      setNewMedWarning('');
      setAddModalVisible(false);

      // Refresh the dashboard
      fetchMedications();
      Alert.alert('Success', 'Medication added to your schedule!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleTaken = (med: Medication) => {
    triggerHaptic();
    setUndoMedId(med.id);

    // Update UI immediately
    const updatedMeds = medications.map((m) =>
      m.id === med.id ? { ...m, status: 'taken', isOverdue: false } : m
    );
    setMedications(updatedMeds);
    scheduleAllAlarms(updatedMeds);

    // Show the Undo Toast
    setUndoToastVisible(true);

    // Start 4-second timer to commit DB update
    const timer = setTimeout(() => {
      commitTakenToDatabase(med.id);
      setUndoToastVisible(false);
    }, 4000);

    setUndoTimer(timer);
  };

  const commitTakenToDatabase = async (id: number) => {
    const today = new Date().toISOString().split('T')[0];
    const takenMed = medications.find((m) => m.id === id);

    // Save daily log
    const { error: logError } = await supabase.from('medication_logs').upsert(
      {
        medication_id: id,
        patient_id: session?.user?.id,
        log_date: today,
        scheduled_time: takenMed?.time || '00:00',
        status: 'taken',
      },
      { onConflict: 'medication_id, log_date' }
    );

    if (logError) console.error('Error saving daily log:', logError);

    // Decrement Pills
    if (takenMed) {
      const currentPills = takenMed.pills_remaining ?? 30;
      const newPillCount = Math.max(0, currentPills - 1);
      const { error: medError } = await supabase
        .from('medications')
        .update({ pills_remaining: newPillCount })
        .eq('id', id);

      if (medError) console.error('Error updating pill count:', medError);

      // Low Stock Alert
      if (newPillCount <= 5 && newPillCount > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Refill Reminder',
            body: `Only ${newPillCount} doses of ${takenMed.medicine_name} left. Tap to reorder.`,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date() },
        });
      }
    }
  };

  const handleUndoTaken = () => {
    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }

    // Revert UI back to pending
    const revertedMeds = medications.map((m) =>
      m.id === undoMedId ? { ...m, status: 'pending', isOverdue: checkIfOverdue(m.time) } : m
    );
    setMedications(revertedMeds);
    scheduleAllAlarms(revertedMeds);

    setUndoToastVisible(false);
    setUndoMedId(null);
  };

  const handleSnooze = async (med: Medication) => {
    triggerHaptic();

    if ((med.snooze_count || 0) >= 2) {
      Alert.alert('Max Snoozes Reached', 'You must take or skip this medication now.');
      return;
    }

    const updatedMeds = medications.map((m) =>
      m.id === med.id ? { ...m, snooze_count: (m.snooze_count || 0) + 1 } : m
    );
    setMedications(updatedMeds);

    const snoozeDate = new Date();
    snoozeDate.setMinutes(snoozeDate.getMinutes() + 20);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 SNOOZE OVER: MEDICATION ALERT',
        body: `Time to take ${med.medicine_name} (${med.dosage})`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'medication-alerts',
        data: { medicationId: med.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: snoozeDate,
        channelId: 'medication-alarms-auto',
      },
    });

    Alert.alert('Snoozed', `${med.medicine_name} alarm snoozed for 20 minutes.`);

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('medication_logs').upsert(
      {
        medication_id: med.id,
        patient_id: session?.user?.id,
        log_date: today,
        scheduled_time: med.time,
        snooze_count: (med.snooze_count || 0) + 1,
      },
      { onConflict: 'medication_id, log_date' }
    );
  };

  const handleReadAloud = (med: Medication) => {
    triggerHaptic();
    if (isAudioEnabled) {
      const textToRead = `${med.medicine_name}. ${med.dosage}. Scheduled for ${med.time}.${med.isOverdue ? ' Warning: This dose is overdue.' : ''
        }`;
      Speech.speak(textToRead);
    } else {
      Alert.alert('Audio Disabled', "Turn on 'Read Aloud' in settings to hear dosage.");
    }
  };

  const renderMedicationCard = (med: Medication) => (
    <View
      key={med.id}
      style={[
        styles.card,
        isAccessibilityMode && styles.highContrastCard,
        med.isOverdue && styles.overdueCard,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[
            styles.alertTitle,
            isAccessibilityMode && styles.largeAlertTitle,
            med.isOverdue && styles.overdueAlertTitle,
          ]}
        >
          {med.isOverdue ? 'OVERDUE ALERT' : 'MEDICATION ALERT'}
        </Text>

        {med.status !== 'taken' && (
          <TouchableOpacity
            onPress={() => router.push(`/medication-details?id=${med.id}`)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Entypo name="dots-three-vertical" size={20} color={Theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* Medicine Icon */}
      <View style={styles.medIconContainer}>
        <Ionicons name="medkit-outline" size={28} color={Theme.colors.primary} />
      </View>

      <View style={styles.medImageContainer}>
        <TouchableOpacity
          style={[styles.audioBtn, isAccessibilityMode && styles.largeAudioBtn]}
          onPress={() => handleReadAloud(med)}
        >
          <Ionicons
            name="volume-high"
            size={isAccessibilityMode ? 24 : 20}
            color={med.isOverdue ? '#D32F2F' : Theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.medicineName, isAccessibilityMode && styles.largeText]}>
        {med.medicine_name}
      </Text>
      <Text style={[styles.dosageText, isAccessibilityMode && styles.largeDosageText]}>
        {med.dosage}
      </Text>
      <Text style={[styles.timeDisplay, isAccessibilityMode && styles.largeTimeDisplay]}>
        {med.time}
      </Text>

      {med.status === 'taken' ? (
        <View
          style={[
            styles.button,
            styles.takenButton,
            isAccessibilityMode && styles.largeButton,
          ]}
        >
          <Text style={[styles.buttonText, isAccessibilityMode && styles.largeButtonText]}>
            TAKEN
          </Text>
        </View>
      ) : med.status === 'skipped' ? (
        <View
          style={[
            styles.button,
            styles.skippedButton,
            isAccessibilityMode && styles.largeButton,
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              styles.skippedText,
              isAccessibilityMode && styles.largeButtonText,
            ]}
          >
            SKIPPED
          </Text>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.successButton,
              styles.mainActionButton,
              isAccessibilityMode && styles.largeButton,
            ]}
            onPress={() => handleTaken(med)}
          >
            <Text style={[styles.buttonText, isAccessibilityMode && styles.largeButtonText]}>
              I TOOK IT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.snoozeButton,
              isAccessibilityMode && styles.largeSnoozeButton,
              (med.snooze_count || 0) >= 2 && styles.disabledButton,
            ]}
            onPress={() => handleSnooze(med)}
            disabled={(med.snooze_count || 0) >= 2}
            accessibilityRole="button"
            accessibilityLabel={`Snooze alarm for ${med.medicine_name} by 20 minutes`}
          >
            <Ionicons
              name="time-outline"
              size={isAccessibilityMode ? 26 : 22}
              color={(med.snooze_count || 0) >= 2 ? Theme.colors.outline : Theme.colors.onSurface}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Floating Settings Gear (Sticks to top right corner) */}
      <TouchableOpacity
        style={styles.settingsGear}
        onPress={() => router.push('/settings')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons
          name="settings-outline"
          size={isAccessibilityMode ? 32 : 28}
          color={Theme.colors.onSurface}
        />
      </TouchableOpacity>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Theme.colors.primary]}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* Screen Header with Title & Analytics */}
        <View style={styles.dashboardHeader}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerText, isAccessibilityMode && styles.largeHeaderText]}>
              Today's Medication
            </Text>
            <Text style={[styles.subHeaderText, isAccessibilityMode && styles.largeSubHeaderText]}>
              Remember to take your pills on time
            </Text>
          </View>

          {/* Analytics Button (stays next to title) */}
          <TouchableOpacity
            onPress={() => router.push('/medication-history')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Medication History"
          >
            <Ionicons
              name="stats-chart"
              size={isAccessibilityMode ? 32 : 28}
              color={Theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        {/* Grouped Timeline View Structure */}
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={80} color={Theme.colors.outline} />
            <Text style={styles.emptyStateTitle}>All Caught Up!</Text>
            <Text style={styles.emptyStateText}>You have no medications scheduled for today.</Text>
          </View>
        ) : (
          <View>
            {/* MORNING (12:00 AM - 11:59 AM) */}
            {medications.filter((m) => parseTimeToMinutes(m.time) < 720).length > 0 && (
              <>
                <TimelineHeader icon="sunny-outline" title="Morning" color="#F59E0B" />
                {medications
                  .filter((m) => parseTimeToMinutes(m.time) < 720)
                  .map(renderMedicationCard)}
              </>
            )}

            {/* AFTERNOON (12:00 PM - 4:59 PM) */}
            {medications.filter(
              (m) => parseTimeToMinutes(m.time) >= 720 && parseTimeToMinutes(m.time) < 1020
            ).length > 0 && (
                <>
                  <TimelineHeader icon="partly-sunny-outline" title="Afternoon" color="#0D7377" />
                  {medications
                    .filter(
                      (m) => parseTimeToMinutes(m.time) >= 720 && parseTimeToMinutes(m.time) < 1020
                    )
                    .map(renderMedicationCard)}
                </>
              )}

            {/* EVENING (5:00 PM - 8:59 PM) */}
            {medications.filter(
              (m) => parseTimeToMinutes(m.time) >= 1020 && parseTimeToMinutes(m.time) < 1260
            ).length > 0 && (
                <>
                  <TimelineHeader icon="moon-outline" title="Evening" color="#6750A4" />
                  {medications
                    .filter(
                      (m) => parseTimeToMinutes(m.time) >= 1020 && parseTimeToMinutes(m.time) < 1260
                    )
                    .map(renderMedicationCard)}
                </>
              )}

            {/* NIGHT (9:00 PM - 11:59 PM) */}
            {medications.filter((m) => parseTimeToMinutes(m.time) >= 1260).length > 0 && (
              <>
                <TimelineHeader icon="cloudy-night-outline" title="Night" color="#37474F" />
                {medications
                  .filter((m) => parseTimeToMinutes(m.time) >= 1260)
                  .map(renderMedicationCard)}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Medication Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Medication</Text>

            <Text style={styles.inputLabel}>Medicine Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Metformin"
              placeholderTextColor={Theme.colors.outline}
              value={newMedName}
              onChangeText={setNewMedName}
            />

            <Text style={styles.inputLabel}>Dosage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 500mg (1 tablet)"
              placeholderTextColor={Theme.colors.outline}
              value={newMedDosage}
              onChangeText={setNewMedDosage}
            />

            <Text style={styles.inputLabel}>Time</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 08:00 AM"
              placeholderTextColor={Theme.colors.outline}
              value={newMedTime}
              onChangeText={setNewMedTime}
            />

            <Text style={styles.inputLabel}>Instructions (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Take after food"
              placeholderTextColor={Theme.colors.outline}
              value={newMedWarning}
              onChangeText={setNewMedWarning}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.linkButton]}
                onPress={handleAddMedication}
              >
                <Text style={styles.linkButtonText}>Save Med</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo Toast Pop-up */}
      {undoToastVisible && (
        <View style={styles.undoToast}>
          <Text style={styles.undoToastText}>Marked as Taken</Text>
          <TouchableOpacity
            onPress={handleUndoTaken}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 50, // Space to prevent overlap with floating settings gear
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  largeHeaderText: {
    fontSize: 36,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
  },
  largeSubHeaderText: {
    fontSize: 18,
  },
  headerActions: {},
  settingsGear: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  spacer: {
    height: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    gap: 8,
  },
  timelineHeaderText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginTop: 12,
  },
  emptyStateText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  highContrastCard: {
    borderWidth: 3,
    borderColor: Theme.colors.primary,
  },
  overdueCard: {
    borderWidth: 2,
    borderColor: '#D32F2F',
    backgroundColor: '#FFEBEE',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  medImageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  medIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  audioBtn: {
    backgroundColor: Theme.colors.surfaceContainer,
    padding: 10,
    borderRadius: 20,
  },
  largeAudioBtn: {
    padding: 14,
    borderRadius: 24,
  },
  alertTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.secondaryContainer,
  },
  largeAlertTitle: {
    fontSize: 16,
  },
  overdueAlertTitle: {
    color: '#D32F2F',
  },
  medicineName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 28,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  largeText: {
    fontSize: 34,
    lineHeight: 42,
  },
  dosageText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 18,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 12,
  },
  largeDosageText: {
    fontSize: 22,
    lineHeight: 28,
  },
  timeDisplay: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.primary,
    marginBottom: 16,
  },
  largeTimeDisplay: {
    fontSize: 38,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainActionButton: {
    flex: 1,
  },
  button: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  largeButton: {
    height: 64,
  },
  successButton: {
    backgroundColor: Theme.colors.success,
  },
  snoozeButton: {
    width: 56,
    backgroundColor: Theme.colors.surfaceContainerHigh,
  },
  largeSnoozeButton: {
    width: 64,
    height: 64,
  },
  disabledButton: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    opacity: 0.5,
  },
  takenButton: {
    width: '100%',
    backgroundColor: Theme.colors.surfaceContainer,
  },
  skippedButton: {
    width: '100%',
    backgroundColor: Theme.colors.surfaceContainer,
  },
  buttonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  largeButtonText: {
    fontSize: 19,
  },
  skippedText: {
    color: Theme.colors.onSurfaceVariant,
  },
  undoToast: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: Theme.colors.onSurface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  undoToastText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 16,
    color: Theme.colors.surface,
  },
  undoButtonText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 16,
    color: Theme.colors.secondary,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderColor: Theme.colors.outline,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: 'PublicSans-Regular',
    marginBottom: 16,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Theme.colors.surfaceContainer,
  },
  cancelButtonText: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onSurfaceVariant,
  },
  linkButton: {
    backgroundColor: Theme.colors.primary,
  },
  linkButtonText: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onPrimary,
  },
});