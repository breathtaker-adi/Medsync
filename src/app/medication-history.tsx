import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { Theme } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { medicationService } from '../services/medicationService';

interface MedicationLogItem {
  id: number;
  medication_id: number;
  patient_id: string;
  log_date: string;
  scheduled_time: string;
  status: 'taken' | 'skipped' | 'pending' | 'missed';
  snooze_count?: number;
  created_at?: string;
  medication?: {
    medicine_name: string;
    dosage: string;
  };
}

interface MedicationMaster {
  id: number;
  medicine_name: string;
  dosage: string;
}

export default function MedicationHistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRange, setSelectedRange] = useState<7 | 30>(7);
  const [statusFilter, setStatusFilter] = useState<'all' | 'taken' | 'skipped' | 'missed'>('all');

  const [logs, setLogs] = useState<MedicationLogItem[]>([]);
  const [medMasterMap, setMedMasterMap] = useState<Record<number, MedicationMaster>>({});

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const res = await medicationService.fetchHistory(session.user.id, selectedRange);
    if (res.success && res.data) {
      const map: Record<number, MedicationMaster> = {};
      res.data.medications.forEach((m) => {
        map[m.id] = m;
      });
      setMedMasterMap(map);
      setLogs((res.data.logs || []) as MedicationLogItem[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [session?.user?.id, selectedRange]);

  useEffect(() => {
    setLoading(true);
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  // Metrics Calculations
  const stats = useMemo(() => {
    const total = logs.length;
    const taken = logs.filter((l) => l.status === 'taken').length;
    const skipped = logs.filter((l) => l.status === 'skipped').length;
    const missed = logs.filter((l) => l.status === 'missed' || l.status === 'pending').length;
    const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 100;

    // Calculate daily streak of 100% adherence going backwards from today
    const logsByDate: Record<string, MedicationLogItem[]> = {};
    logs.forEach((log) => {
      if (!logsByDate[log.log_date]) {
        logsByDate[log.log_date] = [];
      }
      logsByDate[log.log_date].push(log);
    });

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().split('T')[0];

      const dayLogs = logsByDate[dStr];
      if (!dayLogs || dayLogs.length === 0) {
        // If today has no logs yet, don't break the streak immediately
        if (i === 0) continue;
        break;
      }

      const allTaken = dayLogs.every((l) => l.status === 'taken');
      if (allTaken) {
        streak += 1;
      } else {
        break;
      }
    }

    return { total, taken, skipped, missed, adherenceRate, streak };
  }, [logs]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const filtered = logs.filter((item) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'missed') return item.status === 'missed' || item.status === 'pending';
      return item.status === statusFilter;
    });

    const groups: { date: string; displayDate: string; items: MedicationLogItem[] }[] = [];
    const dateMap: Record<string, MedicationLogItem[]> = {};

    filtered.forEach((log) => {
      if (!dateMap[log.log_date]) {
        dateMap[log.log_date] = [];
      }
      dateMap[log.log_date].push(log);
    });

    // Sort dates descending
    const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    sortedDates.forEach((dateStr) => {
      let displayDate = dateStr;
      if (dateStr === todayStr) {
        displayDate = 'Today';
      } else if (dateStr === yesterdayStr) {
        displayDate = 'Yesterday';
      } else {
        try {
          const dateObj = new Date(dateStr + 'T00:00:00');
          displayDate = dateObj.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          displayDate = dateStr;
        }
      }

      groups.push({
        date: dateStr,
        displayDate,
        items: dateMap[dateStr].sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '')),
      });
    });

    return groups;
  }, [logs, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'taken':
        return {
          label: 'Taken',
          bgColor: '#E8F5E9',
          textColor: '#2E7D32',
          icon: 'checkmark-circle' as const,
        };
      case 'skipped':
        return {
          label: 'Skipped',
          bgColor: '#FFF3E0',
          textColor: '#E65100',
          icon: 'close-circle' as const,
        };
      case 'missed':
      case 'pending':
      default:
        return {
          label: status === 'pending' ? 'Pending' : 'Missed',
          bgColor: '#FFEBEE',
          textColor: '#C62828',
          icon: 'alert-circle' as const,
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Medication History"
        subtitle="Track your routine and adherence stats"
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
        {/* Range Selector Pills */}
        <View style={styles.rangeSelectorContainer}>
          <TouchableOpacity
            style={[
              styles.rangeTab,
              selectedRange === 7 && styles.activeRangeTab,
              isAccessibilityMode && styles.largeRangeTab,
            ]}
            onPress={() => {
              triggerHaptic();
              setSelectedRange(7);
            }}
          >
            <Text
              style={[
                styles.rangeTabText,
                selectedRange === 7 && styles.activeRangeTabText,
                isAccessibilityMode && styles.largeRangeTabText,
              ]}
            >
              Past 7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rangeTab,
              selectedRange === 30 && styles.activeRangeTab,
              isAccessibilityMode && styles.largeRangeTab,
            ]}
            onPress={() => {
              triggerHaptic();
              setSelectedRange(30);
            }}
          >
            <Text
              style={[
                styles.rangeTabText,
                selectedRange === 30 && styles.activeRangeTabText,
                isAccessibilityMode && styles.largeRangeTabText,
              ]}
            >
              Past 30 Days
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Loading history records...</Text>
          </View>
        ) : (
          <>
            {/* Overview Adherence Card */}
            <View style={styles.overviewCard}>
              <View style={styles.overviewHeaderRow}>
                <View>
                  <Text style={styles.overviewLabel}>Adherence Score</Text>
                  <Text
                    style={[
                      styles.adherenceScoreText,
                      stats.adherenceRate >= 80
                        ? styles.scoreGreen
                        : stats.adherenceRate >= 50
                        ? styles.scoreAmber
                        : styles.scoreRed,
                    ]}
                  >
                    {stats.adherenceRate}%
                  </Text>
                </View>

                {stats.streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={20} color="#FF6F00" />
                    <Text style={styles.streakText}>
                      {stats.streak} {stats.streak === 1 ? 'Day' : 'Days'} Streak
                    </Text>
                  </View>
                )}
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(stats.adherenceRate, 100)}%`,
                      backgroundColor:
                        stats.adherenceRate >= 80
                          ? Theme.colors.success
                          : stats.adherenceRate >= 50
                          ? Theme.colors.secondaryContainer
                          : Theme.colors.danger,
                    },
                  ]}
                />
              </View>

              {/* Stat Counters Grid */}
              <View style={styles.statCountersGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Scheduled</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{stats.taken}</Text>
                  <Text style={styles.statLabel}>Taken</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#E65100' }]}>{stats.skipped}</Text>
                  <Text style={styles.statLabel}>Skipped</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#C62828' }]}>{stats.missed}</Text>
                  <Text style={styles.statLabel}>Missed</Text>
                </View>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              {(['all', 'taken', 'skipped', 'missed'] as const).map((key) => {
                const isActive = statusFilter === key;
                const labels: Record<string, string> = {
                  all: 'All',
                  taken: 'Taken',
                  skipped: 'Skipped',
                  missed: 'Missed',
                };
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.filterChip, isActive && styles.activeFilterChip]}
                    onPress={() => {
                      triggerHaptic();
                      setStatusFilter(key);
                    }}
                  >
                    <Text
                      style={[styles.filterChipText, isActive && styles.activeFilterChipText]}
                    >
                      {labels[key]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Timeline Sections */}
            {groupedLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="calendar-outline"
                  size={64}
                  color={Theme.colors.outlineVariant}
                />
                <Text style={styles.emptyStateTitle}>No Records Found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  There are no medication records matching this filter for the selected period.
                </Text>
              </View>
            ) : (
              groupedLogs.map((group) => (
                <View key={group.date} style={styles.dateGroup}>
                  <View style={styles.dateHeaderRow}>
                    <Ionicons name="time" size={16} color={Theme.colors.primary} />
                    <Text style={styles.dateHeaderText}>{group.displayDate}</Text>
                    <Text style={styles.dateItemCount}>({group.items.length})</Text>
                  </View>

                  {group.items.map((log) => {
                    const medInfo = medMasterMap[log.medication_id];
                    const badge = getStatusBadge(log.status);

                    return (
                      <View key={log.id} style={styles.logCard}>
                        <View style={styles.logCardLeft}>
                          <Text
                            style={[
                              styles.medNameText,
                              isAccessibilityMode && styles.largeMedNameText,
                            ]}
                          >
                            {medInfo?.medicine_name || `Medication #${log.medication_id}`}
                          </Text>

                          <View style={styles.medMetaRow}>
                            {medInfo?.dosage ? (
                              <Text style={styles.medDosageText}>{medInfo.dosage} • </Text>
                            ) : null}
                            <Text style={styles.medTimeText}>{log.scheduled_time || 'Scheduled'}</Text>
                            {(log.snooze_count ?? 0) > 0 && (
                              <Text style={styles.snoozeBadge}>
                                • Snoozed {log.snooze_count}x
                              </Text>
                            )}
                          </View>
                        </View>

                        <View
                          style={[
                            styles.badgeContainer,
                            { backgroundColor: badge.bgColor },
                          ]}
                        >
                          <Ionicons name={badge.icon} size={15} color={badge.textColor} />
                          <Text style={[styles.badgeText, { color: badge.textColor }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceContainer,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 22,
    color: Theme.colors.onSurface,
  },
  largeHeaderTitle: {
    fontSize: 26,
  },
  headerSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  rangeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeRangeTab: {
    backgroundColor: Theme.colors.primary,
  },
  largeRangeTab: {
    paddingVertical: 14,
  },
  rangeTabText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  activeRangeTabText: {
    color: Theme.colors.onPrimary,
  },
  largeRangeTabText: {
    fontSize: 16,
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 12,
  },
  overviewCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceContainerHigh,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  overviewLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
  },
  adherenceScoreText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 26,
    marginTop: 1,
  },
  scoreGreen: {
    color: '#2E7D32',
  },
  scoreAmber: {
    color: '#F57C00',
  },
  scoreRed: {
    color: '#C62828',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#E65100',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statCountersGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceContainer,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  statLabel: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 10.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Theme.colors.surfaceContainerHigh,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Theme.colors.surfaceContainerLow,
  },
  activeFilterChip: {
    backgroundColor: Theme.colors.primaryContainer,
  },
  filterChipText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  activeFilterChipText: {
    color: Theme.colors.onPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
    marginTop: 14,
  },
  emptyStateSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  dateHeaderText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.primary,
  },
  dateItemCount: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  logCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceContainer,
  },
  logCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  medNameText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  largeMedNameText: {
    fontSize: 16.5,
  },
  medMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  medDosageText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
  },
  medTimeText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
  },
  snoozeBadge: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: Theme.colors.secondary,
    marginLeft: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
  },
});
