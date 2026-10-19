// src/app/paused-medications.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { medicationService } from '../services/medicationService';
import { notificationService } from '../services/notificationService';
import { Theme } from '../theme';
import { Medication } from '../types/medication';

export default function PausedMedicationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();

  const [pausedMeds, setPausedMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resumingId, setResumingId] = useState<number | null>(null);

  const fetchPausedMedications = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      const res = await medicationService.fetchPausedMedications(session.user.id);
      if (res.success) {
        setPausedMeds(res.data);
      } else {
        console.warn('Error fetching paused medications:', res.error.message);
      }
    } catch (err) {
      console.warn('Error fetching paused medications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchPausedMedications();
  }, [fetchPausedMedications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPausedMedications();
  };

  const handleResumeMedication = async (med: Medication) => {
    triggerHaptic();
    Alert.alert(
      'Resume Routine?',
      `Are you sure you want to resume ${med.medicine_name}? It will return to your daily schedule and medication alarms will be active again.`,
      [
        { text: 'Keep Paused', style: 'cancel' },
        {
          text: 'Resume Routine',
          style: 'default',
          onPress: async () => {
            setResumingId(med.id);
            try {
              const res = await medicationService.setMedicationActive(med.id, true);

              if (!res.success) {
                Alert.alert('Error', 'Could not resume medication. Please try again.');
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  'Routine Resumed',
                  `${med.medicine_name} is now active on your daily schedule.`
                );
                // Refresh list
                await fetchPausedMedications();
                // Reschedule notifications
                notificationService.scheduleAllAlarms([med]).catch(() => {});
              }
            } catch (err) {
              Alert.alert('Error', 'An unexpected error occurred while resuming.');
            } finally {
              setResumingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Paused Medications"
        subtitle="Temporarily held routines"
        fallbackRoute="/(tabs)/patient-dashboard"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Theme.colors.primary]}
            tintColor={Theme.colors.primary}
          />
        }
      >
        {/* Information Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="pause-circle" size={24} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Medications on Hold</Text>
            <Text style={styles.infoBannerText}>
              These medications will not trigger daily alarms or appear in your active schedule until you resume them.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Loading paused medications...</Text>
          </View>
        ) : pausedMeds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-done" size={40} color="#0D9488" />
            </View>
            <Text style={styles.emptyTitle}>No Paused Medications</Text>
            <Text style={styles.emptySubtitle}>
              All your prescribed medicines and scheduled routines are currently active and monitored.
            </Text>
            <TouchableOpacity
              style={styles.returnButton}
              onPress={() => router.push('/(tabs)/patient-dashboard')}
            >
              <Text style={styles.returnButtonText}>View Active Schedule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.medsList}>
            {pausedMeds.map((med) => {
              const isResuming = resumingId === med.id;
              return (
                <View key={med.id} style={styles.medCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.medIconWrapper}>
                      <Ionicons name="medkit" size={20} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.medName, isAccessibilityMode && styles.largeText]}>
                        {med.medicine_name}
                      </Text>
                      <Text style={styles.medDosage}>
                        {med.dosage} • Scheduled for {med.time}
                      </Text>
                    </View>
                    <View style={styles.pausedBadge}>
                      <Text style={styles.pausedBadgeText}>PAUSED</Text>
                    </View>
                  </View>

                  {/* Food / Instructions Warning if exists */}
                  {med.food_warning ? (
                    <View style={styles.warningRow}>
                      <Ionicons name="information-circle-outline" size={15} color="#64748B" />
                      <Text style={styles.warningText}>{med.food_warning}</Text>
                    </View>
                  ) : null}

                  {/* Pills Remaining Counter */}
                  <View style={styles.inventoryRow}>
                    <Text style={styles.inventoryText}>
                      Inventory: {med.pills_remaining ?? '—'} units remaining
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.detailsBtn}
                      onPress={() => {
                        triggerHaptic();
                        router.push(`/medication-details?id=${med.id}` as any);
                      }}
                    >
                      <Ionicons name="options-outline" size={16} color={Theme.colors.primary} />
                      <Text style={styles.detailsBtnText}>Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.resumeBtn, isResuming && styles.resumeBtnDisabled]}
                      onPress={() => handleResumeMedication(med)}
                      disabled={isResuming}
                    >
                      {isResuming ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.resumeBtnText}>Resume Routine</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#92400E',
  },
  infoBannerText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 14,
    color: '#64748B',
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  returnButton: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  returnButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  medsList: {
    gap: 12,
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.level1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  medDosage: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  pausedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pausedBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#D97706',
    letterSpacing: 0.5,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  warningText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#475569',
  },
  inventoryRow: {
    marginTop: 8,
  },
  inventoryText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#64748B',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resumeBtnDisabled: {
    opacity: 0.6,
  },
  resumeBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  largeText: {
    fontSize: 18,
  },
});
