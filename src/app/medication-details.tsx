// src/app/medication-details.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { medicationService } from '../services/medicationService';
import { Theme } from '../theme';
import { Medication } from '../types/medication';

export default function MedicationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const [med, setMed] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [editedTime, setEditedTime] = useState('');
  const [timeError, setTimeError] = useState('');
  const [restockCount, setRestockCount] = useState('30');

  useEffect(() => {
    if (id) {
      fetchMedicationDetails(Number(id));
    }
  }, [id]);

  const fetchMedicationDetails = async (medId: number) => {
    const res = await medicationService.fetchMedicationById(medId);
    if (res.success && res.data) {
      setMed(res.data);
    } else {
      Alert.alert('Error', 'Could not load medication details.');
    }
    setLoading(false);
  };

  const handleOrderMedicine = () => {
    if (!med) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const searchQuery = `https://www.google.com/search?q=buy+${encodeURIComponent(
      med.medicine_name
    )}+medicine+online`;

    Linking.openURL(searchQuery).catch(() => {
      Alert.alert('Error', 'Could not open browser to order medicine.');
    });
  };

  const handleSkip = async () => {
    if (!med) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { error } = await supabase
      .from('medications')
      .update({ status: 'skipped' })
      .eq('id', med.id)
      .eq('patient_id', session?.user?.id);

    if (error) {
      Alert.alert('Error', 'Failed to skip medication.');
    } else {
      Alert.alert('Skipped', `${med.medicine_name} dose skipped for today.`);
      router.back();
    }
  };

  // Toggle Active / Paused State
  const handleTogglePause = async () => {
    if (!med) return;
    setOptionsModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isCurrentlyActive = med.is_active !== false;
    const actionLabel = isCurrentlyActive ? 'Pause' : 'Resume';

    Alert.alert(
      `${actionLabel} Medication`,
      isCurrentlyActive
        ? 'This will pause alarms and hide this dose card from your daily schedule until resumed.'
        : 'This will re-activate scheduled alarms and display this dose on your daily routine.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            const nextActive = !isCurrentlyActive;
            const { error } = await supabase
              .from('medications')
              .update({ is_active: nextActive })
              .eq('id', Number(id))
              .eq('patient_id', session?.user?.id);

            if (!error) {
              setMed((prev) => (prev ? { ...prev, is_active: nextActive } : null));
              Alert.alert('Success', `Medication routine is now ${nextActive ? 'Active' : 'Paused'}.`);
            } else {
              Alert.alert('Error', 'Could not update medication status.');
            }
          },
        },
      ]
    );
  };

  // Restock Supply Count
  const handleRestock = async () => {
    const count = parseInt(restockCount, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Invalid Count', 'Please enter a valid number of pills or units to add.');
      return;
    }

    const newRemaining = (med?.pills_remaining ?? 0) + count;
    const newTotal = Math.max(med?.total_pills ?? 30, newRemaining);

    const { error } = await supabase
      .from('medications')
      .update({ pills_remaining: newRemaining, total_pills: newTotal })
      .eq('id', Number(id))
      .eq('patient_id', session?.user?.id);

    if (!error) {
      setMed((prev) => (prev ? { ...prev, pills_remaining: newRemaining, total_pills: newTotal } : null));
      setRestockModalVisible(false);
      Alert.alert('Inventory Refilled', `Added ${count} units. New supply balance is ${newRemaining}.`);
    } else {
      Alert.alert('Error', 'Could not update inventory.');
    }
  };

  // DELETE MEDICATION (Hidden inside 3-dots menu)
  const handleDeletePermanently = () => {
    setOptionsModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      'Delete Medication Permanently?',
      `Are you sure you want to delete ${med?.medicine_name}? This will permanently remove this prescription and all adherence logs. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('medications')
              .delete()
              .eq('id', Number(id))
              .eq('patient_id', session?.user?.id);

            if (!error) {
              Alert.alert('Deleted', 'Medication has been permanently removed.');
              router.replace('/(tabs)/patient-dashboard');
            } else {
              Alert.alert('Error', 'Failed to delete medication.');
            }
          },
        },
      ]
    );
  };

  // EDIT TIME
  const handleEditTime = () => {
    setEditedTime(med?.time || '08:00 AM');
    setTimeError('');
    setEditModalVisible(true);
  };

  const handleSaveTime = async () => {
    const formatted = editedTime.trim();
    // Validate 12-hour (08:00 AM) or 24-hour (14:30)
    const is12Hour = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i.test(formatted);
    const is24Hour = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formatted);

    if (!is12Hour && !is24Hour) {
      setTimeError('Please enter a valid time (e.g. 08:00 AM or 02:30 PM)');
      return;
    }

    const finalTime = formatted.toUpperCase();
    const { error } = await supabase
      .from('medications')
      .update({ time: finalTime })
      .eq('id', Number(id))
      .eq('patient_id', session?.user?.id);

    if (error) {
      Alert.alert('Error', 'Could not update medication schedule time.');
    } else {
      setMed((prev) => (prev ? { ...prev, time: finalTime } : null));
      setEditModalVisible(false);
      Alert.alert('Time Updated', `Dose alarm scheduled for ${finalTime}.`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (!med) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Medication Details" fallbackRoute="/(tabs)/patient-dashboard" />
        <View style={styles.center}>
          <Ionicons name="medical-outline" size={54} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Medication Not Found</Text>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => router.replace('/(tabs)/patient-dashboard')}
          >
            <Text style={styles.returnBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = med.is_active !== false;
  const pillsLeft = med.pills_remaining ?? 30;
  const pillsTotal = Math.max(med.total_pills ?? 30, pillsLeft);
  const pillPercent = Math.min(100, Math.round((pillsLeft / pillsTotal) * 100));
  const isLowStock = pillsLeft <= 5;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Medication Details"
        subtitle={med.medicine_name}
        fallbackRoute="/(tabs)/patient-dashboard"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setOptionsModalVisible(true);
            }}
            style={styles.headerMoreBtn}
            accessibilityRole="button"
            accessibilityLabel="Medication options and actions"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={Theme.colors.onSurface} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconPlate}>
              <Ionicons name="medkit" size={30} color={Theme.colors.primary} />
            </View>

            <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgePaused]}>
              <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotPaused]} />
              <Text style={[styles.statusBadgeText, isActive ? styles.statusTextActive : styles.statusTextPaused]}>
                {isActive ? 'Active Routine' : 'Paused'}
              </Text>
            </View>
          </View>

          <Text style={styles.medicineName}>{med.medicine_name}</Text>

          <View style={styles.dosagePillRow}>
            <View style={styles.dosagePill}>
              <Ionicons name="flask-outline" size={14} color="#0D9488" />
              <Text style={styles.dosagePillText}>{med.dosage}</Text>
            </View>
            <View style={styles.durationPill}>
              <Ionicons name="calendar-outline" size={14} color="#0284C7" />
              <Text style={styles.durationPillText}>{med.duration || '30 days duration'}</Text>
            </View>
          </View>
        </View>

        {/* Paused Routine Banner */}
        {!isActive && (
          <View style={styles.pausedAlertBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="pause-circle" size={26} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pausedAlertTitle}>Medication Routine Paused</Text>
                <Text style={styles.pausedAlertDesc}>
                  Daily alarms are silenced and this dose is held from your active schedule.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Schedule Timing Tile */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Ionicons name="alarm-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.sectionTitle}>Daily Dose Schedule</Text>
            </View>
            <TouchableOpacity style={styles.editTimeAction} onPress={handleEditTime}>
              <Ionicons name="pencil" size={14} color={Theme.colors.primary} />
              <Text style={styles.editTimeActionText}>Change Time</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timeDisplayCard}>
            <View style={styles.clockIconWrapper}>
              <Ionicons name="time" size={24} color="#0D9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeValueText}>{med.time}</Text>
              <Text style={styles.timeHintText}>Scheduled dose alarm time</Text>
            </View>
          </View>
        </View>

        {/* Inventory & Supply Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Ionicons name="cube-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.sectionTitle}>Supply & Refill Status</Text>
            </View>
            <TouchableOpacity
              style={styles.restockActionBtn}
              onPress={() => setRestockModalVisible(true)}
            >
              <Ionicons name="add-circle" size={15} color="#0284C7" />
              <Text style={styles.restockActionText}>Refill Supply</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inventoryRow}>
            <View style={styles.inventoryNumberGroup}>
              <Text style={[styles.pillsLeftText, isLowStock && styles.pillsLeftLow]}>
                {pillsLeft}
              </Text>
              <Text style={styles.pillsTotalText}> / {pillsTotal} left</Text>
            </View>
            <Text style={styles.inventoryPercentText}>{pillPercent}% remaining</Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${pillPercent}%` },
                isLowStock && styles.progressBarFillLow,
              ]}
            />
          </View>

          {isLowStock && (
            <View style={styles.lowStockBanner}>
              <Ionicons name="warning" size={18} color="#DC2626" />
              <Text style={styles.lowStockBannerText}>
                Low supply alert: Only {pillsLeft} doses remaining. Reorder today to avoid skipping days.
              </Text>
            </View>
          )}
        </View>

        {/* Doctor & Food Instructions */}
        {med.food_warning && (
          <View style={styles.instructionsCard}>
            <View style={styles.instructionIconPlate}>
              <Ionicons name="restaurant-outline" size={22} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.instructionsTitle}>Intake Instructions</Text>
              <Text style={styles.instructionsBody}>{med.food_warning}</Text>
            </View>
          </View>
        )}

        {/* Clinical Notes & Description */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleGroup}>
            <Ionicons name="document-text-outline" size={20} color={Theme.colors.primary} />
            <Text style={styles.sectionTitle}>Clinical Guidance & Notes</Text>
          </View>
          <Text style={styles.notesBody}>
            {med.description ||
              'Administer according to verified schedule. If adverse symptoms occur, consult your healthcare provider or caregiver.'}
          </Text>
        </View>

        {/* Routine Management Action (Pause / Resume) - Only shown when medication is active */}
        {isActive && (
          <TouchableOpacity style={styles.pauseRoutineCard} onPress={handleTogglePause}>
            <View style={styles.pauseIconCircle}>
              <Ionicons
                name="pause"
                size={18}
                color="#D97706"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pauseCardTitle}>Pause Medication Routine</Text>
              <Text style={styles.pauseCardSubtitle}>
                Temporarily halt daily reminders without losing history
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 3-DOTS ACTION SHEET MODAL (Hiding Delete Forever Safely) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={optionsModalVisible}
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.optionsSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{med.medicine_name}</Text>
              <Text style={styles.sheetSubtitle}>Medication Management Options</Text>
            </View>

            <TouchableOpacity style={styles.sheetOption} onPress={handleTogglePause}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons
                  name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={22}
                  color="#B45309"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionText}>
                  {isActive ? 'Pause Medication' : 'Resume Medication'}
                </Text>
                <Text style={styles.sheetOptionSubtext}>Toggle scheduled reminders</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setOptionsModalVisible(false);
                setRestockModalVisible(true);
              }}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="cube-outline" size={22} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionText}>Refill Supply Inventory</Text>
                <Text style={styles.sheetOptionSubtext}>Add pills or liquid volume to counter</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            {/* DESTRUCTIVE ACTION HIDDEN IN 3 DOTS */}
            <TouchableOpacity style={styles.sheetOptionDestructive} onPress={handleDeletePermanently}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="trash" size={22} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetDestructiveText}>Delete Medication Forever</Text>
                <Text style={styles.sheetDestructiveSubtext}>Permanently erase schedule and history</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* EDIT TIME MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editTimeModalContent}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons name="time" size={28} color={Theme.colors.primary} />
            </View>

            <Text style={styles.modalTitle}>Edit Schedule Time</Text>
            <Text style={styles.modalSubtitle}>Pick a quick preset or type 12-hour time (e.g. 08:00 AM)</Text>

            {/* Quick Presets */}
            <View style={styles.timePresetRow}>
              {['08:00 AM', '01:00 PM', '07:00 PM', '10:00 PM'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.timePresetBtn,
                    editedTime === preset && styles.timePresetBtnActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditedTime(preset);
                    setTimeError('');
                  }}
                >
                  <Text
                    style={[
                      styles.timePresetText,
                      editedTime === preset && styles.timePresetTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.timeInput, timeError ? styles.timeInputError : undefined]}
              placeholder="08:00 AM"
              placeholderTextColor="#94A3B8"
              value={editedTime}
              maxLength={8}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9: apmAPM]/g, '').slice(0, 8);
                setEditedTime(cleaned);
                if (timeError) setTimeError('');
              }}
            />
            {timeError ? <Text style={styles.timeErrorText}>{timeError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveModalButton]}
                onPress={handleSaveTime}
              >
                <Text style={styles.saveModalButtonText}>Save Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESTOCK SUPPLY MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={restockModalVisible}
        onRequestClose={() => setRestockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editTimeModalContent}>
            <View style={[styles.modalHeaderIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="cube" size={28} color="#0284C7" />
            </View>

            <Text style={styles.modalTitle}>Refill Medication Supply</Text>
            <Text style={styles.modalSubtitle}>How many tablets, capsules, or units are you adding?</Text>

            <View style={styles.quickCountRow}>
              {['15', '30', '60', '90'].map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.timePresetBtn,
                    restockCount === count && styles.timePresetBtnActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRestockCount(count);
                  }}
                >
                  <Text
                    style={[
                      styles.timePresetText,
                      restockCount === count && styles.timePresetTextActive,
                    ]}
                  >
                    +{count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.timeInput}
              placeholder="30"
              placeholderTextColor="#94A3B8"
              value={restockCount}
              keyboardType="numeric"
              onChangeText={(text) => setRestockCount(text.replace(/[^0-9]/g, ''))}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setRestockModalVisible(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveModalButton]}
                onPress={handleRestock}
              >
                <Text style={styles.saveModalButtonText}>Confirm Refill</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <SeniorButton
          title="Order Refill Online"
          onPress={handleOrderMedicine}
          variant="primary"
          size="large"
          icon={<Ionicons name="cart" size={22} color="#FFFFFF" />}
          style={{ marginBottom: 8 }}
        />

        {isActive ? (
          <SeniorButton
            title="Skip Dose for Today"
            onPress={handleSkip}
            variant="outline"
            size="normal"
          />
        ) : (
          <SeniorButton
            title="Resume Medication Routine"
            onPress={handleTogglePause}
            variant="primary"
            size="normal"
            icon={<Ionicons name="play-circle" size={20} color="#FFFFFF" />}
            style={{ backgroundColor: '#0D9488' }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  emptyTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
    marginTop: 12,
  },
  returnBtn: {
    marginTop: 16,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  returnBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  headerMoreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 170,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...Theme.shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroIconPlate: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgePaused: {
    backgroundColor: '#FEF3C7',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  statusBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextPaused: {
    color: '#B45309',
  },
  medicineName: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: '#0F172A',
    marginBottom: 8,
  },
  dosagePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dosagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dosagePillText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#0F766E',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationPillText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: '#0284C7',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    ...Theme.shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  editTimeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  editTimeActionText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  timeDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clockIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeValueText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 20,
    color: '#0F172A',
  },
  timeHintText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  restockActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  restockActionText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#0284C7',
  },
  inventoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  inventoryNumberGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pillsLeftText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: '#0F172A',
  },
  pillsLeftLow: {
    color: '#DC2626',
  },
  pillsTotalText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#64748B',
  },
  inventoryPercentText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0D9488',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0D9488',
  },
  progressBarFillLow: {
    backgroundColor: '#DC2626',
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  lowStockBannerText: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  instructionIconPlate: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#92400E',
    marginBottom: 2,
  },
  instructionsBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#B45309',
    lineHeight: 17,
  },
  notesBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginTop: 8,
  },
  pauseRoutineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    ...Theme.shadows.card,
  },
  pauseIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseCardTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#0F172A',
    marginBottom: 2,
  },
  pauseCardSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Theme.shadows.cardElevated,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Theme.shadows.cardElevated,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  sheetTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sheetOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOptionText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  sheetOptionSubtext: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6,
  },
  sheetOptionDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sheetDestructiveText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#DC2626',
  },
  sheetDestructiveSubtext: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#EF4444',
    marginTop: 1,
  },
  sheetCancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#475569',
  },
  editTimeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Theme.shadows.cardElevated,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    marginTop: 2,
  },
  timePresetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  quickCountRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  timePresetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  timePresetBtnActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  timePresetText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#475569',
  },
  timePresetTextActive: {
    color: '#0F766E',
  },
  timeInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    fontFamily: 'PublicSans-ExtraBold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  timeInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  timeErrorText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelModalButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#475569',
  },
  saveModalButton: {
    backgroundColor: Theme.colors.primary,
  },
  saveModalButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  pausedAlertBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  pausedAlertTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#92400E',
  },
  pausedAlertDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  resumeBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  resumeBannerBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#FFFFFF',
  },
});