// src/app/(tabs)/caregiver-dashboard.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useAuth } from '../../context/AuthContext';
import { useCaregiverRoster } from '../../hooks/useCaregiverRoster';
import { notificationService } from '../../services/notificationService';
import { Theme } from '../../theme';
import { avatarHelper } from '../../utils/avatarHelper';
import { MissedAlertItem, PatientItem } from '../../types/patient';
import { PendingReview } from '../../types/review';
import { getPrescriptionPublicUrlSync, usePrescriptionImageUrl } from '../../utils/prescriptionHelper';



export type PendingReviewItem = PendingReview;
export type { PatientItem, MissedAlertItem };

function DashboardReviewCard({
  review,
  isAccessibilityMode,
  triggerHaptic,
  onPress,
}: {
  review: PendingReview;
  isAccessibilityMode: boolean;
  triggerHaptic: () => void;
  onPress: () => void;
}) {
  const { url: thumbUrl } = usePrescriptionImageUrl(review.image_url);
  const isSuspectedNonRx =
    review.ocr_status === 'failed' ||
    review.medication?.includes('⚠️') ||
    review.medication?.toLowerCase().includes('unrecognized');

  return (
    <TouchableOpacity
      key={review.id}
      style={[
        styles.reviewCard,
        isAccessibilityMode && styles.highContrastCard,
        isSuspectedNonRx && { borderColor: '#FCA5A5', backgroundColor: '#FFFBFB' },
      ]}
      activeOpacity={0.8}
      onPress={() => {
        triggerHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Review prescription for ${review.patient_name}, medication ${review.medication}`}
    >
      <View style={styles.reviewTopRow}>
        <View style={styles.reviewPatientBadge}>
          <Ionicons name="person-circle" size={18} color={Theme.colors.primary} />
          <Text style={styles.reviewPatientText}>{review.patient_name}</Text>
        </View>
        {isSuspectedNonRx ? (
          <View style={[styles.ocrTag, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="warning" size={13} color="#DC2626" />
            <Text style={[styles.ocrTagText, { color: '#DC2626' }]}>Inspect Photo</Text>
          </View>
        ) : (
          <View style={styles.ocrTag}>
            <MaterialCommunityIcons name="line-scan" size={14} color="#0D9488" />
            <Text style={styles.ocrTagText}>OCR Pre-Scanned</Text>
          </View>
        )}
      </View>

      <View style={styles.reviewCardContentRow}>
        {thumbUrl ? (
          <View style={styles.reviewThumbWrapper}>
            <Image
              source={{ uri: thumbUrl }}
              style={styles.reviewThumbImage}
              contentFit="cover"
            />
            <View style={styles.reviewThumbBadge}>
              <Ionicons name="document-text" size={10} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          <View style={styles.reviewThumbPlaceholder}>
            <Ionicons name="document-text-outline" size={24} color="#0D9488" />
          </View>
        )}

        <View style={styles.reviewBody}>
          <Text style={[styles.reviewMedTitle, isAccessibilityMode && styles.largeText]} numberOfLines={1}>
            {review.medication || 'Prescription Slip Review'}
          </Text>
          <Text style={styles.reviewDosageText} numberOfLines={1}>
            Dosage: {review.dosage || 'See uploaded slip'}
          </Text>
          <Text style={styles.reviewDurationText} numberOfLines={1}>
            Course: {review.duration || '30 days supply'}
          </Text>
        </View>
      </View>

      <View style={styles.reviewFooter}>
        <Text style={styles.reviewTapCta}>Tap to Inspect Photo &amp; Approve</Text>
        <Ionicons name="arrow-forward-circle" size={22} color={Theme.colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function CaregiverDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const { isAccessibilityMode, isAudioEnabled, triggerHaptic } = useAccessibility();

  // Avatar State
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);

  React.useEffect(() => {
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

  const {
    patients,
    reviews,
    missedAlerts,
    personalMeds,
    takePersonalDose,
    loading,
    refreshing,
    linking,
    onRefresh,
    linkPatientWithCode,
    toggleAlertOverride,
    refetch,
  } = useCaregiverRoster(session?.user?.id);

  useFocusEffect(
    useCallback(() => {
      refetch();
      if (session?.user?.id) {
        avatarHelper.getLocalAvatar(session.user.id).then((local) => {
          if (local) setAvatarUri(local);
        });
      }
    }, [refetch, session?.user?.id])
  );

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'alerts'>('all');

  // Linking Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [pairingInput, setPairingInput] = useState('');

  // Audio briefing speaking state
  const [isSpeakingBrief, setIsSpeakingBrief] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleLinkPatient = async () => {
    const formattedCode = pairingInput.trim().toUpperCase();

    if (!session?.user?.id || formattedCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6 to 8 character pairing code.');
      return;
    }

    const success = await linkPatientWithCode(formattedCode);
    if (success) {
      triggerHaptic();
      Alert.alert('Success', 'Patient linked to your clinical practice roster!');
      setModalVisible(false);
      setPairingInput('');
    }
  };

  const handleToggleOverride = async (patient: PatientItem, value: boolean) => {
    triggerHaptic();
    const patientIdentifier = patient.patient_id || String(patient.id);
    await toggleAlertOverride(patientIdentifier, value);
  };

  // Hands-free Clinical Briefing Audio
  const handlePlayClinicalBrief = () => {
    triggerHaptic();
    if (isSpeakingBrief) {
      notificationService.stopSpeaking();
      setIsSpeakingBrief(false);
      return;
    }

    if (!isAudioEnabled) {
      Alert.alert(
        'Voice Guidance Disabled',
        "Clinical briefing audio is disabled. You can turn on 'Audio Read-Aloud' in Settings.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => router.push('/doctor-settings') },
        ]
      );
      return;
    }

    const doctorName = profile?.full_name ? `Dr. ${profile.full_name.split(' ').pop()}` : 'Doctor';
    const patientCount = patients.length;
    const reviewCount = reviews.length;
    const alertCount = missedAlerts.length;

    const briefText = `${doctorName}, here is your clinical practice summary. You have ${patientCount} monitored ${
      patientCount === 1 ? 'patient' : 'patients'
    }. ${
      reviewCount > 0
        ? `There are ${reviewCount} pending prescription ${reviewCount === 1 ? 'review' : 'reviews'} awaiting your verification.`
        : 'All prescription reviews are up to date.'
    } ${
      alertCount > 0
        ? `Attention: ${alertCount} missed dose ${alertCount === 1 ? 'alert requires' : 'alerts require'} clinical intervention.`
        : 'No critical adherence alerts at this time.'
    }`;

    const spoken = notificationService.speakText(briefText, isAudioEnabled);
    if (spoken) {
      setIsSpeakingBrief(true);
      // Auto reset speaking state after estimated duration
      setTimeout(() => setIsSpeakingBrief(false), 9000);
    } else {
      Alert.alert('Audio Notice', 'Unable to play speech synthesis at this time.');
    }
  };

  // Filtered Patient List
  const filteredPatients = useMemo(() => {
    let result = [...patients];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const pName = (p.patient_name || p.full_name || '').toLowerCase();
        const pCond = (p.condition || '').toLowerCase();
        return pName.includes(q) || pCond.includes(q);
      });
    }

    if (activeFilter === 'alerts') {
      const alertIds = new Set(missedAlerts.map((a) => a.patient_id));
      result = result.filter((p) => alertIds.has(p.patient_id || String(p.id)));
    }

    return result;
  }, [patients, searchQuery, activeFilter, missedAlerts]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={[styles.loadingText, isAccessibilityMode && styles.largeText]}>
          Syncing Clinical Roster...
        </Text>
      </View>
    );
  }

  const doctorDisplayName = profile?.full_name
    ? profile.full_name.startsWith('Dr.')
      ? profile.full_name
      : `Dr. ${profile.full_name}`
    : 'Clinical Dashboard';

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
        {/* Top App Bar: Brand Logo on Left, Doctor Avatar & Settings on Right */}
        <View style={styles.topAppBar}>
          <MedSyncLogo size={40} variant="horizontal" />
          <View style={styles.headerActionCluster}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change physician profile picture"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.headerAvatarImage} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Ionicons name="medical" size={18} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.headerCameraBadge}>
                <Ionicons name="camera" size={10} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                triggerHaptic();
                router.push('/doctor-settings');
              }}
              style={styles.settingsIconButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Doctor Clinical Settings"
            >
              <Ionicons
                name="settings-outline"
                size={21}
                color={Theme.colors.onSurface}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Clinical Oversight Status Banner */}
        <View style={styles.clinicalStatusRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.clinicalBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.clinicalBadgeText}>LIVE CLINICAL SURVEILLANCE</Text>
            </View>
            <Text style={[styles.clinicalHeaderTitle, isAccessibilityMode && styles.largeText]}>
              Patient Triage &amp; Approvals
            </Text>
          </View>
        </View>

        {/* Clinical Triage KPI Cards Grid */}
        <View style={styles.kpiGrid}>
          {/* Active Patients KPI */}
          <View
            style={[
              styles.kpiCard,
              isAccessibilityMode && styles.highContrastCard,
            ]}
          >
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="people" size={20} color="#0284C7" />
            </View>
            <Text style={[styles.kpiNumber, isAccessibilityMode && styles.largeKpiNumber]}>
              {patients.length}
            </Text>
            <Text style={styles.kpiLabel}>Patients Monitored</Text>
          </View>

          {/* Pending Reviews KPI */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              router.push('/pending-reviews' as any);
            }}
            style={[
              styles.kpiCard,
              reviews.length > 0 && styles.kpiCardUrgent,
              isAccessibilityMode && styles.highContrastCard,
            ]}
          >
            <View
              style={[
                styles.kpiIconWrapper,
                { backgroundColor: reviews.length > 0 ? '#FEF3C7' : '#F1F5F9' },
              ]}
            >
              <Ionicons
                name="document-text"
                size={20}
                color={reviews.length > 0 ? '#D97706' : '#64748B'}
              />
            </View>
            <Text
              style={[
                styles.kpiNumber,
                reviews.length > 0 && { color: '#B45309' },
                isAccessibilityMode && styles.largeKpiNumber,
              ]}
            >
              {reviews.length}
            </Text>
            <Text style={styles.kpiLabel}>
              {reviews.length === 1 ? 'Pending Review' : 'Pending Reviews'}
            </Text>
          </TouchableOpacity>

          {/* Missed Doses KPI */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              setActiveFilter(activeFilter === 'alerts' ? 'all' : 'alerts');
            }}
            style={[
              styles.kpiCard,
              missedAlerts.length > 0 && styles.kpiCardAlert,
              isAccessibilityMode && styles.highContrastCard,
            ]}
          >
            <View
              style={[
                styles.kpiIconWrapper,
                { backgroundColor: missedAlerts.length > 0 ? '#FEE2E2' : '#F1F5F9' },
              ]}
            >
              <Ionicons
                name="warning"
                size={20}
                color={missedAlerts.length > 0 ? '#DC2626' : '#64748B'}
              />
            </View>
            <Text
              style={[
                styles.kpiNumber,
                missedAlerts.length > 0 && { color: '#DC2626' },
                isAccessibilityMode && styles.largeKpiNumber,
              ]}
            >
              {missedAlerts.length}
            </Text>
            <Text style={styles.kpiLabel}>
              {missedAlerts.length === 1 ? 'Dose Alert' : 'Dose Alerts'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Priority Missed Dose Alerts Banner */}
        {missedAlerts.length > 0 && (
          <View style={styles.alertsContainer}>
            <View style={styles.alertHeaderRow}>
              <View style={styles.alertHeaderLeft}>
                <Ionicons name="alert-circle" size={22} color="#DC2626" />
                <Text style={styles.alertSectionTitle}>Requires Immediate Follow-up</Text>
              </View>
              <View style={styles.alertCountBadge}>
                <Text style={styles.alertCountBadgeText}>{missedAlerts.length} Critical</Text>
              </View>
            </View>

            {missedAlerts.map((alert, index) => (
              <PulseView key={index} active={true} minScale={0.98} maxScale={1.01} duration={1400}>
                <View
                  style={[
                    styles.alertCard,
                    isAccessibilityMode && styles.highContrastAlertCard,
                  ]}
                >
                  <View style={styles.alertCardTop}>
                    <View style={styles.alertIconCircle}>
                      <Ionicons name="warning" size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.alertPatientName,
                          isAccessibilityMode && styles.largeText,
                        ]}
                      >
                        {alert.patient_name}
                      </Text>
                      <Text style={styles.alertDetailText}>
                        Missed {alert.missed_count} scheduled doses in the last 24 hours
                      </Text>
                    </View>
                  </View>

                  <View style={styles.alertActionButtons}>
                    <TouchableOpacity
                      style={styles.alertCallBtn}
                      onPress={() => {
                        triggerHaptic();
                        router.push(
                          `/patient-details?patientId=${alert.patient_id}&name=${encodeURIComponent(
                            alert.patient_name
                          )}`
                        );
                      }}
                    >
                      <Ionicons name="medical" size={16} color="#DC2626" />
                      <Text style={styles.alertCallBtnText}>View Clinical Chart</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </PulseView>
            ))}
          </View>
        )}

        {/* Prescription Verification Queue Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTitleGroup}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Theme.colors.primary} />
            <Text style={[styles.sectionTitle, isAccessibilityMode && styles.largeSectionTitle]}>
              Prescription Reviews
            </Text>
          </View>
          {reviews.length > 0 && (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{reviews.length} Pending</Text>
            </View>
          )}
        </View>

        {reviews.length === 0 ? (
          <View
            style={[
              styles.emptyReviewCard,
              isAccessibilityMode && styles.highContrastCard,
            ]}
          >
            <View style={styles.emptyReviewIconPlate}>
              <Ionicons name="checkmark-done-circle" size={36} color="#10B981" />
            </View>
            <Text style={styles.emptyReviewTitle}>Prescription Review Queue Clear</Text>
            <Text style={styles.emptyReviewSubtitle}>
              All patient prescription scans have been clinically verified.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#F0FDFA',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                marginTop: 10,
                borderWidth: 1,
                borderColor: '#CCFBF1',
              }}
            >
              <Ionicons name="camera-outline" size={16} color="#0D9488" />
              <Text style={{ flex: 1, fontFamily: 'PublicSans-Regular', fontSize: 11, color: '#0F766E', lineHeight: 15 }}>
                When patients scan a prescription in the Camera tab, AI OCR extracts medications and queues them here for physician sign-off.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <DashboardReviewCard
                key={review.id}
                review={review}
                isAccessibilityMode={isAccessibilityMode}
                triggerHaptic={triggerHaptic}
                onPress={() => router.push(`/review-details?id=${review.id}`)}
              />
            ))}
          </View>
        )}

        {/* Monitored Patient Roster Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <View style={styles.sectionHeaderTitleGroup}>
            <Ionicons name="people-outline" size={22} color={Theme.colors.primary} />
            <Text style={[styles.sectionTitle, isAccessibilityMode && styles.largeSectionTitle]}>
              Patient Practice Roster
            </Text>
          </View>

          <TouchableOpacity
            style={styles.linkHeaderBtn}
            onPress={() => {
              triggerHaptic();
              setModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={16} color={Theme.colors.primary} />
            <Text style={styles.linkHeaderBtnText}>Link Patient</Text>
          </TouchableOpacity>
        </View>

        {/* Search & Quick Filter Chips */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient roster by name..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterChipRow}>
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
              All ({patients.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'alerts' && styles.filterChipActiveAlert]}
            onPress={() => {
              triggerHaptic();
              setActiveFilter(activeFilter === 'alerts' ? 'all' : 'alerts');
            }}
          >
            <Ionicons
              name="warning"
              size={13}
              color={activeFilter === 'alerts' ? '#FFFFFF' : '#DC2626'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'alerts' && styles.filterChipTextActive,
              ]}
            >
              Alerts ({missedAlerts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'pending' && styles.filterChipActiveWarning]}
            onPress={() => {
              triggerHaptic();
              setActiveFilter(activeFilter === 'pending' ? 'all' : 'pending');
            }}
          >
            <Ionicons
              name="document-text"
              size={13}
              color={activeFilter === 'pending' ? '#FFFFFF' : '#D97706'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'pending' && styles.filterChipTextActive,
              ]}
            >
              Reviews ({reviews.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Patient Cards List */}
        {filteredPatients.length === 0 ? (
          <View style={styles.emptyPatientsCard}>
            <Ionicons name="person-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyPatientsTitle}>
              {searchQuery ? 'No matching patients found' : 'No patients linked yet'}
            </Text>
            <Text style={styles.emptyPatientsSubtitle}>
              {searchQuery
                ? 'Try adjusting your search terms.'
                : 'Share your 6-digit pairing code with patients to monitor their medication intake.'}
            </Text>
          </View>
        ) : (
          filteredPatients.map((patient) => {
            const displayName = patient.patient_name || patient.full_name || 'Patient';
            const hasAlert = missedAlerts.some(
              (a) => a.patient_id === (patient.patient_id || String(patient.id))
            );

            return (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.patientCard,
                  hasAlert && styles.patientCardWithAlert,
                  isAccessibilityMode && styles.highContrastCard,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic();
                  router.push(
                    `/patient-details?patientId=${patient.patient_id || patient.id}&name=${encodeURIComponent(
                      displayName
                    )}`
                  );
                }}
              >
                <View style={styles.patientTopRow}>
                  <View style={styles.patientAvatarInitials}>
                    <Text style={styles.patientInitialsText}>
                      {displayName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.patientInfoCol}>
                    <View style={styles.patientNameRow}>
                      <Text
                        style={[styles.patientName, isAccessibilityMode && styles.largeText]}
                      >
                        {displayName}
                      </Text>
                      {hasAlert && (
                        <View style={styles.alertPill}>
                          <Text style={styles.alertPillText}>Alert</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.patientPhone}>
                      {patient.condition ? `Condition: ${patient.condition}` : `Adherence: ${patient.adherence || 95}%`}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </View>

                {/* Patient Contact Details Section */}
                {patient.phone || patient.email || patient.emergency_contact_phone ? (
                  <View style={styles.patientContactRow}>
                    {patient.phone ? (
                      <TouchableOpacity
                        style={styles.contactChip}
                        onPress={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          Linking.openURL(`tel:${patient.phone}`);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Call patient: ${patient.phone}`}
                      >
                        <Ionicons name="call" size={12} color="#0284C7" />
                        <Text style={styles.contactChipText}>{patient.phone}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {patient.email ? (
                      <TouchableOpacity
                        style={styles.contactChip}
                        onPress={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          Linking.openURL(`mailto:${patient.email}`);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Email patient: ${patient.email}`}
                      >
                        <Ionicons name="mail" size={12} color="#0D9488" />
                        <Text style={styles.contactChipText} numberOfLines={1}>
                          {patient.email}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {patient.emergency_contact_phone ? (
                      <TouchableOpacity
                        style={[styles.contactChip, styles.emergencyContactChip]}
                        onPress={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          Linking.openURL(`tel:${patient.emergency_contact_phone}`);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Emergency call: ${patient.emergency_contact_name || 'Emergency contact'}`}
                      >
                        <Ionicons name="warning" size={12} color="#DC2626" />
                        <Text style={[styles.contactChipText, { color: '#DC2626' }]}>
                          SOS: {patient.emergency_contact_name ? `${patient.emergency_contact_name} ` : ''}({patient.emergency_contact_phone})
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.patientNoContactRow}>
                    <Ionicons name="call-outline" size={12} color="#94A3B8" />
                    <Text style={styles.patientNoContactText}>
                      No direct contact phone registered
                    </Text>
                  </View>
                )}

                {/* Patient Bottom Controls */}
                <View style={styles.patientBottomRow}>
                  <View style={styles.overrideAlertSection}>
                    <Ionicons
                      name={patient.override_alerts !== false ? 'notifications' : 'notifications-off'}
                      size={16}
                      color={patient.override_alerts !== false ? Theme.colors.primary : '#94A3B8'}
                    />
                    <Text style={styles.overrideLabel}>Dose Missed Alerts</Text>
                  </View>
                  <Switch
                    value={patient.override_alerts !== false}
                    onValueChange={(val) => handleToggleOverride(patient, val)}
                    trackColor={{ false: '#E2E8F0', true: Theme.colors.primary }}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Directory Navigation Button */}
        <View style={{ marginTop: 16 }}>
          <SeniorButton
            title="Open Complete Patient Directory"
            onPress={() => {
              triggerHaptic();
              router.push('/patient-directory');
            }}
            variant="outline"
            size="normal"
            icon={<Ionicons name="people-circle-outline" size={22} color={Theme.colors.primary} />}
          />
        </View>
      </ScrollView>

      {/* Link Patient Pairing Code Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              isAccessibilityMode && styles.highContrastCard,
            ]}
          >
            <View style={styles.modalIconCircle}>
              <Ionicons name="person-add" size={28} color={Theme.colors.primary} />
            </View>

            <Text style={[styles.modalTitle, isAccessibilityMode && styles.largeText]}>
              Link New Patient
            </Text>
            <Text style={styles.modalSubtitle}>
              Enter the patient's 6 or 8-digit secure pairing code from their MedSync Settings.
            </Text>

            <TextInput
              style={[
                styles.codeInput,
                isAccessibilityMode && styles.largeCodeInput,
              ]}
              placeholder="e.g. A4B9C2"
              placeholderTextColor="#94A3B8"
              value={pairingInput}
              onChangeText={setPairingInput}
              autoCapitalize="characters"
              maxLength={8}
            />

            <View style={styles.modalButtonsStack}>
              <SeniorButton
                title={linking ? 'Verifying & Linking...' : 'Confirm Patient Link'}
                onPress={handleLinkPatient}
                loading={linking}
                variant="primary"
                size="normal"
                icon={<Ionicons name="link" size={20} color="#FFFFFF" />}
              />
              <SeniorButton
                title="Cancel"
                onPress={() => {
                  setModalVisible(false);
                  setPairingInput('');
                }}
                variant="outline"
                size="normal"
              />
            </View>
          </View>
        </View>
      </Modal>
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
  loadingText: {
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
  clinicalStatusRow: {
    marginBottom: 14,
  },
  clinicalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  clinicalBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#047857',
    letterSpacing: 0.5,
  },
  clinicalHeaderTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 20,
    color: '#0F172A',
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlate: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#006874',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative',
    ...Theme.shadows.cardElevated,
  },
  avatarInitials: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerTitleGroup: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: '#0F172A',
    flexShrink: 1,
  },
  largeHeaderText: {
    fontSize: 21,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    gap: 3,
  },
  verifiedText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  statusPillText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#64748B',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
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
  headerIconBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  largeIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  kpiCardUrgent: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  kpiCardAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  kpiIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiNumber: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 2,
  },
  largeKpiNumber: {
    fontSize: 22,
  },
  kpiLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 10.5,
    color: '#64748B',
  },
  // Missed Dose Alerts
  alertsContainer: {
    marginBottom: 14,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  alertSectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#DC2626',
  },
  alertCountBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  alertCountBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#DC2626',
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  highContrastAlertCard: {
    borderWidth: 2,
    borderColor: '#991B1B',
    backgroundColor: '#FFFFFF',
  },
  alertCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertPatientName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#991B1B',
  },
  alertDetailText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#B91C1C',
    marginTop: 2,
  },
  alertActionButtons: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  alertCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  alertCallBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#DC2626',
  },
  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#0F172A',
  },
  largeSectionTitle: {
    fontSize: 18,
  },
  badgePill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgePillText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#B45309',
  },
  // Reviews
  emptyReviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  emptyReviewIconPlate: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyReviewTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 3,
  },
  emptyReviewSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
  },
  reviewsList: {
    gap: 8,
    marginBottom: 8,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewPatientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reviewPatientText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F172A',
  },
  ocrTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  ocrTagText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#0F766E',
  },
  reviewBody: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewCardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 6,
  },
  reviewThumbWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewThumbImage: {
    width: '100%',
    height: '100%',
  },
  reviewThumbBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 4,
    padding: 2,
  },
  reviewThumbPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewDosageText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  reviewDurationText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  reviewMedTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#006874',
    marginBottom: 1,
  },
  reviewHint: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 2,
  },
  reviewTapCta: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: Theme.colors.primary,
  },
  // Patient Roster
  linkHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  linkHeaderBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#0F172A',
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterChipActiveAlert: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterChipActiveWarning: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  filterChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PublicSans-Bold',
  },
  emptyPatientsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 8,
  },
  emptyPatientsTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#0F172A',
    marginTop: 6,
    marginBottom: 3,
  },
  emptyPatientsSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    ...Theme.shadows.card,
  },
  patientCardWithAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFDFD',
  },
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatarInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  patientInitialsText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#334155',
  },
  patientInfoCol: {
    flex: 1,
  },
  patientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  patientName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#0F172A',
  },
  alertPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  alertPillText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9.5,
    color: '#DC2626',
  },
  patientPhone: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  patientContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emergencyContactChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  contactChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#0369A1',
  },
  patientNoContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  patientNoContactText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 10.5,
    color: '#94A3B8',
  },
  patientBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  overrideAlertSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  overrideLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#475569',
  },
  // Accessibility styles
  highContrastCard: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  largeText: {
    fontSize: 15,
  },
  // Modal styles
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
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    ...Theme.shadows.cardElevated,
  },
  modalIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 17,
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 17,
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 14,
  },
  largeCodeInput: {
    fontSize: 22,
    paddingVertical: 14,
  },
  modalButtonsStack: {
    width: '100%',
    gap: 8,
  },
  // Personal Medications Self-Care Card
  personalMedsCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    padding: 12,
    marginBottom: 14,
  },
  personalMedsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  personalMedsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  personalMedsIconPlate: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalMedsTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#581C87',
  },
  personalMedsSub: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 10.5,
    color: '#7E22CE',
  },
  personalMedsSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  personalMedsSwitchBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#7C3AED',
  },
  personalMedsList: {
    gap: 6,
  },
  personalMedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  personalMedName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#0F172A',
  },
  personalMedDetail: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  personalMedTakenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  personalMedTakenText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#059669',
  },
  personalMedTakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  personalMedTakeBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  personalMedsEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
  },
  personalMedsEmptyText: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#6B21A8',
    lineHeight: 15,
  },
  personalMedsAddBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  personalMedsAddBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#FFFFFF',
  },
});