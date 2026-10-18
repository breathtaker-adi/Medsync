// src/app/prescription-history.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import { prescriptionService } from '../services/prescriptionService';
import { Theme } from '../theme';
import { usePrescriptionImageUrl } from '../utils/prescriptionHelper';

interface PrescriptionItem {
  id: number;
  patient_id: string;
  patient_name?: string;
  medication: string;
  dosage: string;
  duration?: string;
  image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  doctor_notes?: string;
  ocr_status?: string;
  target_doctor_id?: string;
  created_at: string;
  doctor?: {
    id: string;
    full_name: string;
    specialty?: string;
    clinic_affiliation?: string;
  };
}

function PrescriptionCard({
  item,
  isAccessibilityMode,
  onInspectImage,
  triggerHaptic,
}: {
  item: PrescriptionItem;
  isAccessibilityMode: boolean;
  onInspectImage: (url: string) => void;
  triggerHaptic: () => void;
}) {
  const { url: imageUrl, loading: imageLoading } = usePrescriptionImageUrl(item.image_url);

  // Status visual styling
  const isPending = item.status === 'pending';
  const isApproved = item.status === 'approved';
  const isRejected = item.status === 'rejected';

  const statusBg = isApproved ? '#ECFDF5' : isPending ? '#FFFBEB' : '#FEF2F2';
  const statusBorder = isApproved ? '#A7F3D0' : isPending ? '#FDE68A' : '#FECACA';
  const statusColor = isApproved ? '#047857' : isPending ? '#B45309' : '#B91C1C';
  const statusIcon = isApproved
    ? 'checkmark-circle'
    : isPending
    ? 'time'
    : 'alert-circle';
  const statusLabel = isApproved
    ? 'Approved & Scheduled'
    : isPending
    ? 'Pending Doctor Review'
    : 'Action Required / Rejected';

  const formattedDate = new Date(item.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const doctorDisplayName = item.doctor?.full_name
    ? item.doctor.full_name.startsWith('Dr.')
      ? item.doctor.full_name
      : `Dr. ${item.doctor.full_name}`
    : item.target_doctor_id
    ? 'Supervising Physician'
    : 'Practice Clinical Queue';

  const handleSpeakNotes = () => {
    triggerHaptic();
    const textToSpeak = item.doctor_notes
      ? `Doctor's message regarding ${item.medication}: ${item.doctor_notes}`
      : `Prescription for ${item.medication}. Status is ${statusLabel}.`;
    notificationService.speakText(textToSpeak, true);
  };

  return (
    <View
      style={[
        styles.card,
        isAccessibilityMode && styles.cardHighContrast,
        { borderColor: statusBorder },
      ]}
    >
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: statusBg, borderColor: statusBorder }]}>
        <View style={styles.statusRow}>
          <Ionicons name={statusIcon} size={18} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.dateText}>{formattedDate}</Text>
      </View>

      <View style={styles.cardContent}>
        {/* Main Details & Thumbnail */}
        <View style={styles.cardMainRow}>
          {/* Thumbnail / Image Preview */}
          <TouchableOpacity
            style={styles.thumbnailContainer}
            onPress={() => {
              if (imageUrl) {
                triggerHaptic();
                onInspectImage(imageUrl);
              }
            }}
            activeOpacity={0.8}
            accessibilityRole="imagebutton"
            accessibilityLabel="Tap to view enlarged prescription photo"
          >
            {imageLoading ? (
              <View style={styles.thumbnailPlaceholder}>
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              </View>
            ) : imageUrl ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                />
                <View style={styles.expandOverlay}>
                  <Ionicons name="expand" size={14} color="#FFFFFF" />
                </View>
              </View>
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="document-text-outline" size={24} color="#94A3B8" />
              </View>
            )}
          </TouchableOpacity>

          {/* Medication Info */}
          <View style={styles.infoCol}>
            <Text
              style={[styles.medicationName, isAccessibilityMode && styles.largeText]}
              numberOfLines={2}
            >
              {item.medication}
            </Text>

            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="pill" size={14} color="#64748B" />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.dosage || 'Prescribed dose'}
              </Text>
            </View>

            {item.duration ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                <Text style={styles.metaText} numberOfLines={1}>
                  Course: {item.duration}
                </Text>
              </View>
            ) : null}

            {/* Supervising Doctor */}
            <View style={styles.doctorBadge}>
              <Ionicons name="medical" size={12} color={Theme.colors.primary} />
              <Text style={styles.doctorBadgeText} numberOfLines={1}>
                {doctorDisplayName}
                {item.doctor?.specialty ? ` • ${item.doctor.specialty}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Doctor Clinical Feedback Note */}
        {item.doctor_notes ? (
          <View
            style={[
              styles.doctorNoteCard,
              isApproved && styles.doctorNoteApproved,
              isRejected && styles.doctorNoteRejected,
            ]}
          >
            <View style={styles.doctorNoteHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={isRejected ? 'alert-circle' : 'chatbox-ellipses-outline'}
                  size={15}
                  color={isRejected ? '#DC2626' : Theme.colors.primary}
                />
                <Text
                  style={[
                    styles.doctorNoteTitle,
                    isRejected && { color: '#B91C1C' },
                  ]}
                >
                  {isRejected ? 'Doctor Feedback / Reason:' : 'Clinical Notes & Attestation:'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSpeakNotes}
                style={styles.speakButton}
                accessibilityRole="button"
                accessibilityLabel="Read doctor notes aloud"
              >
                <Ionicons name="volume-medium" size={16} color={Theme.colors.primary} />
                <Text style={styles.speakButtonText}>Listen</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.doctorNoteBody}>{item.doctor_notes}</Text>
          </View>
        ) : null}

        {/* Help Tip For Rejected Prescriptions */}
        {isRejected && (
          <View style={styles.rejectedHelpBox}>
            <Ionicons name="information-circle" size={16} color="#DC2626" />
            <Text style={styles.rejectedHelpText}>
              Your doctor requested changes. Please snap a clearer photo or verify with your clinic.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function PrescriptionHistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();

  const [submissions, setSubmissions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Fullscreen Inspection Modal
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await prescriptionService.fetchPrescriptionHistoryForPatient(session.user.id);
      if (res.success && res.data) {
        setSubmissions(res.data as PrescriptionItem[]);
      }
    } catch (err) {
      console.warn('[prescription-history] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchHistory();

    // Live Realtime Subscription: updates status automatically when doctor approves or rejects!
    if (session?.user?.id) {
      const channel = supabase
        .channel(`patient-rx-history-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_reviews',
            filter: `patient_id=eq.${session.user.id}`,
          },
          () => {
            fetchHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.user?.id, fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
  };

  // Filter items
  const filteredSubmissions = submissions.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.status === activeFilter;
  });

  const countPending = submissions.filter((s) => s.status === 'pending').length;
  const countApproved = submissions.filter((s) => s.status === 'approved').length;
  const countRejected = submissions.filter((s) => s.status === 'rejected').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Prescription History"
        subtitle="Tracking slips submitted for physician sign-off"
        onBack={() => router.back()}
        fallbackRoute="/(tabs)/uploads"
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
          onPress={() => {
            triggerHaptic();
            setActiveFilter('all');
          }}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'all' && styles.filterChipTextActive,
            ]}
          >
            All ({submissions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            activeFilter === 'pending' && styles.filterChipActive,
          ]}
          onPress={() => {
            triggerHaptic();
            setActiveFilter('pending');
          }}
        >
          <View style={[styles.filterDot, { backgroundColor: '#F59E0B' }]} />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'pending' && styles.filterChipTextActive,
            ]}
          >
            Pending ({countPending})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            activeFilter === 'approved' && styles.filterChipActive,
          ]}
          onPress={() => {
            triggerHaptic();
            setActiveFilter('approved');
          }}
        >
          <View style={[styles.filterDot, { backgroundColor: '#10B981' }]} />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'approved' && styles.filterChipTextActive,
            ]}
          >
            Approved ({countApproved})
          </Text>
        </TouchableOpacity>

        {countRejected > 0 && (
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === 'rejected' && styles.filterChipActive,
            ]}
            onPress={() => {
              triggerHaptic();
              setActiveFilter('rejected');
            }}
          >
            <View style={[styles.filterDot, { backgroundColor: '#EF4444' }]} />
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'rejected' && styles.filterChipTextActive,
              ]}
            >
              Rejected ({countRejected})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your prescription history...</Text>
        </View>
      ) : filteredSubmissions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text-outline" size={48} color={Theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeFilter === 'all'
              ? 'No Prescriptions Submitted Yet'
              : `No ${activeFilter.toUpperCase()} Prescriptions`}
          </Text>
          <Text style={styles.emptySubtitle}>
            When you snap and upload prescription slips, they appear here with live review updates from your doctor.
          </Text>
          <TouchableOpacity
            style={styles.uploadCtaBtn}
            onPress={() => router.push('/(tabs)/uploads')}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.uploadCtaText}>Scan a Prescription Slip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSubmissions}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PrescriptionCard
              item={item}
              isAccessibilityMode={isAccessibilityMode}
              onInspectImage={(url) => setSelectedPhoto(url)}
              triggerHaptic={triggerHaptic}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Theme.colors.primary]}
              tintColor={Theme.colors.primary}
            />
          }
        />
      )}

      {/* Fullscreen Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Prescription Document</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedPhoto(null)}
              accessibilityLabel="Close enlarged photo"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalImageContainer}>
            {selectedPhoto ? (
              <Image
                source={{ uri: selectedPhoto }}
                style={styles.fullscreenImage}
                contentFit="contain"
              />
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.modalDismissBtn}
            onPress={() => setSelectedPhoto(null)}
          >
            <Text style={styles.modalDismissText}>Close Inspection</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#E6F4F4',
    borderColor: Theme.colors.primary,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: '#64748B',
  },
  filterChipTextActive: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: 'hidden',
    ...Theme.shadows.card,
  },
  cardHighContrast: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
  },
  dateText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
  },
  cardContent: {
    padding: 14,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbnailContainer: {
    width: 82,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  expandOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  medicationName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 4,
  },
  largeText: {
    fontSize: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  metaText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#475569',
  },
  doctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  doctorBadgeText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#0D9488',
  },
  doctorNoteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  doctorNoteApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  doctorNoteRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  doctorNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  doctorNoteTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#334155',
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  speakButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.primary,
  },
  doctorNoteBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  rejectedHelpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  rejectedHelpText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#B91C1C',
    flex: 1,
    lineHeight: 16,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  uploadCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  uploadCtaText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  modalDismissBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 20,
  },
  modalDismissText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
