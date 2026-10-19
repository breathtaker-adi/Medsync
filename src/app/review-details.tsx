import { Entypo, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useAuth } from '../context/AuthContext';
import { Theme } from '../theme';
import { SeniorButton } from '../components/SeniorButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAccessibility } from '../context/AccessibilityContext';
import { notificationService } from '../services/notificationService';
import { prescriptionService } from '../services/prescriptionService';
import { showErrorAlert } from '../utils/errorHandler';
import { resolvePrescriptionImageUrl } from '../utils/prescriptionHelper';

export default function ReviewDetailsScreen() {
  const params = useLocalSearchParams();
  // Expo Router may return params as string | string[]; safely extract scalar
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();
  const [review, setReview] = useState<any>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [fullscreenImageVisible, setFullscreenImageVisible] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Editable states
  const [editedMedicine, setEditedMedicine] = useState('');
  const [editedDosage, setEditedDosage] = useState('');
  const [editedDuration, setEditedDuration] = useState('');
  const [editedQuantity, setEditedQuantity] = useState('30');
  const [editedUnit, setEditedUnit] = useState('Tablets');
  const [doctorNote, setDoctorNote] = useState('');

  const { profile, session } = useAuth();
  const isDoctor = profile?.role === 'doctor' || profile?.is_verified_doctor === true;

  const handleReadAloudPrescription = () => {
    triggerHaptic();
    const medName = editedMedicine || review?.medication || 'Prescription medication';
    const dosage = editedDosage || review?.dosage || 'unspecified dosage';
    const duration = editedDuration || review?.duration || 'standard duration';
    const patient = review?.patient_name || 'the patient';
    const text = `Prescription for ${patient}. Medication: ${medName}. Dosage: ${dosage}. Supply: ${editedQuantity} ${editedUnit}. Duration: ${duration}. ${
      doctorNote ? `Doctor's note: ${doctorNote}` : ''
    }`;
    notificationService.speakText(text, true);
  };

  useEffect(() => {
    if (id) fetchReviewDetails(Number(id));
    else setLoading(false);
  }, [id]);

  const fetchReviewDetails = async (reviewId: number) => {
    const res = await prescriptionService.fetchReviewById(reviewId);

    if (!res.success || !res.data) {
      // Show a clear error but don't block the "not found" UI from showing
      console.warn('[review-details] fetchReviewById failed:', res.error);
      setReview(null);
      setLoading(false);
      return;
    }

    const data = res.data;
    setReview(data);
    // Pre-fill editable fields
    setEditedMedicine(data.medication || '');
    setEditedDosage(data.dosage || 'Take 1 tablet');
    setEditedDuration(data.duration || '30 days');
    setDoctorNote(data.doctor_notes || '');

    // Robust multi-strategy image URL resolution
    if (data.image_url) {
      setImageLoading(true);
      setImageLoadError(false);
      try {
        const url = await resolvePrescriptionImageUrl(data.image_url);
        setResolvedImageUrl(url);
      } catch (e) {
        console.error('[review-details] Error resolving prescription image:', e);
      } finally {
        setImageLoading(false);
      }
    } else {
      setResolvedImageUrl(null);
    }
    setLoading(false);
  };

  const handleSaveEdits = async () => {
    if (!review) return;

    const res = await prescriptionService.updatePendingReview(review.id, {
      medication: editedMedicine,
      dosage: editedDosage,
      duration: editedDuration,
      doctor_notes: doctorNote,
    });

    if (!res.success) {
      Alert.alert('Error', 'Could not save corrections.');
      console.error(res.error);
      return;
    }

    setReview((prev: any) => ({
      ...prev,
      medication: editedMedicine,
      dosage: editedDosage,
      duration: editedDuration,
      doctor_notes: doctorNote,
    }));

    setEditModalVisible(false);
    Alert.alert('Saved', 'Corrections saved. You can now approve.');
  };

  const handleApprove = async () => {
    if (!review) return;

    // Both Caregivers and Doctors have full authority to approve prescriptions!
    const isDoctor = profile?.role === 'doctor' || profile?.is_verified_doctor === true;
    const isCaregiver = profile?.role === 'caregiver';

    if (!isDoctor && !isCaregiver) {
      Alert.alert(
        'Authority Required',
        'Only caregivers or doctors linked to this patient are authorized to review and approve prescriptions.'
      );
      return;
    }

    const medName = editedMedicine || review.medication;
    const dosageInfo = editedDosage || review.dosage;
    const supplyCount = parseInt(editedQuantity, 10) || 30;
    const formattedDosage = `${dosageInfo} (${supplyCount} ${editedUnit})`;

    // Stamp with appropriate attestation: Verified Physician Seal or Family Caregiver Signature
    const approverTitle = isDoctor && profile?.is_verified_doctor
      ? `Verified Physician (Dr. ${profile?.full_name?.replace(/^Dr\.\s*/i, '') || 'Doctor'})`
      : `Family Caregiver (${profile?.full_name || 'Caregiver'})`;

    const notesWithAttestation = doctorNote
      ? `${doctorNote}\n[Approved by ${approverTitle}]`
      : `Approved by ${approverTitle}`;

    // Execute approval via prescriptionService
    const approveRes = await prescriptionService.approvePrescription({
      reviewId: review.id,
      medicationName: medName,
      patientId: review.patient_id,
      dosage: formattedDosage,
      duration: editedDuration,
      doctorNotes: notesWithAttestation,
      pillsRemaining: supplyCount,
      totalPills: supplyCount,
      isVerifiedDoctor: Boolean(isDoctor && profile?.is_verified_doctor),
      approvedByRole: isDoctor ? 'doctor' : 'caregiver',
      approvedByName: profile?.full_name,
    });

    if (!approveRes.success) {
      Alert.alert('Error', approveRes.error.message || 'Failed to approve prescription.');
      return;
    }

    // Push notification to patient
    if (review.patient_id) {
      await notificationService.sendPushNotificationToPatient(
        review.patient_id,
        '✅ Prescription Approved',
        `Your doctor approved ${medName}. It has been added to your dashboard!`,
        session?.user?.id
      );
    }

    Alert.alert('Success', 'Prescription approved and sent to patient!');
    router.back();
  };

  const handleReject = async () => {
    if (!review) return;
    const res = await prescriptionService.rejectPrescription(review.id, doctorNote);

    if (!res.success) {
      showErrorAlert(res.error, 'Rejection Failed');
      return;
    }

    // Push notification to patient that prescription was rejected
    if (review.patient_id) {
      await notificationService.sendPushNotificationToPatient(
        review.patient_id,
        '❌ Prescription Requires Resubmission',
        doctorNote
          ? `Doctor note: ${doctorNote}`
          : 'Your uploaded prescription could not be verified. Tap to view and re-upload.',
        session?.user?.id
      );
    }

    Alert.alert('Rejected', 'Prescription has been rejected and the patient has been notified.');
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (!review) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title="Review Prescription"
          fallbackRoute="/(tabs)/caregiver-dashboard"
        />
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={56} color="#94A3B8" />
          <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 16, color: '#0F172A', marginTop: 12 }}>
            Prescription Review Not Found
          </Text>
          <Text
            style={{
              fontFamily: 'PublicSans-Regular',
              fontSize: 13,
              color: '#64748B',
              textAlign: 'center',
              marginTop: 6,
              marginHorizontal: 24,
            }}
          >
            This prescription may have already been reviewed or requires clinical roster refresh.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: Theme.colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 10,
            }}
            onPress={() => router.replace('/(tabs)/caregiver-dashboard')}
          >
            <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 14, color: '#FFFFFF' }}>
              Return to Clinical Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Review Prescription"
        subtitle={review?.patient_name ? `Patient: ${review.patient_name}` : undefined}
        fallbackRoute="/(tabs)/caregiver-dashboard"
        rightAction={
          <TouchableOpacity
            onPress={() => setEditModalVisible(true)}
            style={styles.menuBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit prescription details"
          >
            <Entypo name="dots-three-vertical" size={22} color={Theme.colors.onSurface} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Role & Approval Authority Banner */}
        {profile?.role === 'caregiver' && !profile?.is_verified_doctor ? (
          <View style={styles.caregiverAuthBanner}>
            <View style={styles.caregiverAuthIconPlate}>
              <Ionicons name="shield-checkmark" size={20} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.caregiverAuthTitle}>Family Caregiver Full Authorization</Text>
              <Text style={styles.caregiverAuthDesc}>
                You have full authority to review, edit dosages, and approve medication schedules for your loved ones.
              </Text>
            </View>
          </View>
        ) : profile?.is_verified_doctor ? (
          <View style={styles.doctorVerifiedBanner}>
            <Ionicons name="shield-checkmark" size={18} color="#059669" />
            <Text style={styles.doctorVerifiedBannerText}>
              Verified Physician Seal Attached • Official Medical Attestation
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.doctorVerificationBanner}
            onPress={() => router.push('/doctor-verification')}
          >
            <Ionicons name="shield-outline" size={20} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorVerificationBannerTitle}>
                Optional: Attach Verified Physician Seal
              </Text>
              <Text style={styles.doctorVerificationBannerDesc}>
                If you are a practicing medical doctor, verify your license to include a verified digital doctor seal.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D97706" />
          </TouchableOpacity>
        )}

        {/* Image Inspection Card */}
        <View style={styles.imageCardContainer}>
          <View style={styles.imageCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="image-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.imageCardTitle}>Prescription Document</Text>
            </View>
            {resolvedImageUrl ? (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic();
                  setFullscreenImageVisible(true);
                }}
                style={styles.expandHeaderBtn}
                accessibilityRole="button"
                accessibilityLabel="Enlarge prescription document in full screen"
              >
                <Ionicons name="expand" size={13} color={Theme.colors.primary} />
                <Text style={styles.expandHeaderBtnText}>Full Screen</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {imageLoading ? (
            <View style={styles.imagePlaceholderBox}>
              <ActivityIndicator size="large" color={Theme.colors.primary} />
              <Text style={styles.imagePlaceholderText}>Loading prescription photo...</Text>
            </View>
          ) : resolvedImageUrl && !imageLoadError ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                triggerHaptic();
                setFullscreenImageVisible(true);
              }}
              style={styles.imageTouchable}
              accessibilityRole="imagebutton"
              accessibilityLabel="Tap to view enlarged prescription photo"
            >
              <Image
                source={{ uri: resolvedImageUrl }}
                style={styles.prescriptionImage}
                contentFit="contain"
                onError={() => setImageLoadError(true)}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.imagePlaceholderBox}>
              <Ionicons name="document-text-outline" size={44} color="#94A3B8" />
              <Text style={styles.imagePlaceholderTitle}>Prescription Slip Attached</Text>
              <Text style={styles.imagePlaceholderText}>
                {review?.image_url
                  ? `Storage File: ${review.image_url}`
                  : 'Document reference on cloud storage'}
              </Text>
              <TouchableOpacity
                style={styles.retryImageBtn}
                onPress={() => fetchReviewDetails(review.id)}
              >
                <Ionicons name="refresh" size={14} color={Theme.colors.primary} />
                <Text style={styles.retryImageBtnText}>Reload Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!isDoctor && (
          <View style={[styles.notesContainer, { backgroundColor: Theme.colors.surfaceContainerHigh, marginTop: 12 }]}>
            <Text style={[styles.notesTitle, { color: Theme.colors.onSurfaceVariant }]}>
              ℹ️ Caregiver Oversight View
            </Text>
            <Text style={[styles.notesText, { color: Theme.colors.onSurfaceVariant }]}>
              Designated caregivers and verified physicians can review, adjust dosages, and approve prescriptions into the patient's daily medication routine.
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        {/* Prescription Summary Header & Quick Actions */}
        <View style={styles.summaryHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="receipt-outline" size={20} color={Theme.colors.primary} />
            <Text style={[styles.sectionTitle, isAccessibilityMode && styles.largeSectionTitle, { marginBottom: 0 }]}>
              Prescription Summary
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.editSummaryBtn}
              onPress={() => {
                triggerHaptic();
                setEditModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit medicine name, dosage and duration"
            >
              <Ionicons name="create-outline" size={14} color={Theme.colors.primary} />
              <Text style={styles.editSummaryBtnText}>Edit Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voiceAssistBtn}
              onPress={handleReadAloudPrescription}
              accessibilityRole="button"
              accessibilityLabel="Listen to prescription details read aloud"
            >
              <Ionicons name="volume-high" size={14} color={Theme.colors.primary} />
              <Text style={styles.voiceAssistBtnText}>Listen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Suspected Non-Prescription or Unclear Slip Warning */}
        {(review.ocr_status === 'failed' ||
          review.medication?.includes('⚠️') ||
          review.medication?.toLowerCase().includes('unrecognized') ||
          review.doctor_notes?.includes('AI Warning')) && (
          <View style={styles.suspectedNonPrescriptionBanner}>
            <View style={styles.suspectedIconCircle}>
              <Ionicons name="alert-circle" size={22} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.suspectedBannerTitle}>Suspected Non-Prescription or Unclear Slip</Text>
              <Text style={styles.suspectedBannerText}>
                AI OCR could not verify an official prescription in this photo. Please inspect the image carefully. You can tap &quot;Edit Details&quot; to manually prescribe and approve, or tap &quot;Reject&quot; below.
              </Text>
            </View>
          </View>
        )}

        {/* Structured Summary Card */}
        <View style={[styles.summaryCard, isAccessibilityMode && styles.highContrastCard]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Patient:</Text>
            <Text style={[styles.summaryValue, { fontFamily: 'PublicSans-Bold', color: '#0F172A' }]}>
              {review.patient_name || 'Patient'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Medication:</Text>
            <Text style={[styles.summaryValue, styles.summaryMedValue]}>
              {editedMedicine || 'Prescription Slip Review'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dosage:</Text>
            <Text style={styles.summaryValue}>{editedDosage || '1 dose as prescribed'}</Text>
          </View>
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Supply:</Text>
            <Text style={styles.summaryValue}>
              {editedQuantity} {editedUnit}
            </Text>
          </View>
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration:</Text>
            <Text style={styles.summaryValue}>{editedDuration || '30 days'}</Text>
          </View>
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Notes / Advice:</Text>
            <Text style={[styles.summaryValue, { color: doctorNote ? '#0F172A' : '#64748B' }]}>
              {doctorNote || 'No specific doctor instructions. Tap "Edit Details" to record directions.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Approve / Reject Buttons */}
      <View style={styles.bottomButtons}>
        <View style={{ flex: 1 }}>
          <SeniorButton
            title="Reject"
            onPress={handleReject}
            variant="outline"
            size="large"
            icon={<Ionicons name="close-circle-outline" size={22} color={Theme.colors.primary} />}
          />
        </View>
        <View style={{ flex: 1.3 }}>
          <SeniorButton
            title="Approve Schedule"
            onPress={handleApprove}
            variant="success"
            size="large"
            icon={<Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />}
          />
        </View>
      </View>

      {/* EDIT MODAL */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit & Correct Prescription</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={28} color={Theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Medicine Name</Text>
            <TextInput
              style={styles.input}
              value={editedMedicine}
              onChangeText={setEditedMedicine}
            />

            <Text style={styles.inputLabel}>Dosage</Text>
            <TextInput
              style={styles.input}
              value={editedDosage}
              onChangeText={setEditedDosage}
            />

            <Text style={styles.inputLabel}>Supply Quantity & Unit</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <TextInput
                style={[styles.input, { width: 80, marginBottom: 0 }]}
                value={editedQuantity}
                onChangeText={setEditedQuantity}
                keyboardType="numeric"
                placeholder="30"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {['Tablets', 'Capsules', 'ml (Liquid)', 'Grams', 'Units'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: 8,
                      marginRight: 6,
                      backgroundColor: editedUnit === u ? Theme.colors.primary : '#F1F5F9',
                    }}
                    onPress={() => setEditedUnit(u)}
                  >
                    <Text
                      style={{
                        fontFamily: 'PublicSans-Bold',
                        fontSize: 12,
                        color: editedUnit === u ? '#FFFFFF' : '#334155',
                      }}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.inputLabel}>Duration / When</Text>
            <TextInput
              style={styles.input}
              value={editedDuration}
              onChangeText={setEditedDuration}
            />

            {/* NEW: Doctor Correction Note */}
            <Text style={styles.inputLabel}>Correction Note (Why was it changed?)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., AI read name wrong. Updated to correct name."
              value={doctorNote}
              onChangeText={setDoctorNote}
              multiline={true}
            />

            <TouchableOpacity
              style={styles.saveEditButton}
              onPress={handleSaveEdits}
            >
              <Text style={styles.saveEditText}>Save Corrections</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={fullscreenImageVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullscreenImageVisible(false)}
      >
        <SafeAreaView style={styles.fullscreenModalBg}>
          <View style={styles.fullscreenModalTop}>
            <Text style={styles.fullscreenModalTitle}>Prescription Document</Text>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setFullscreenImageVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close full screen viewer"
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {resolvedImageUrl ? (
            <Image
              source={{ uri: resolvedImageUrl }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.outlineVariant,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  menuBtn: {
    padding: 4,
    marginRight: -4,
  },
  headerTitle: { fontFamily: 'PublicSans-Bold', fontSize: 16, color: Theme.colors.onSurface },
  prescriptionImage: { width: '100%', height: 240, borderRadius: 14, backgroundColor: Theme.colors.surfaceContainer },
  spacer: { height: 16 },
  sectionTitle: { fontFamily: 'PublicSans-Bold', fontSize: 15, color: Theme.colors.onSurface, marginBottom: 6 },
  sectionText: { fontFamily: 'PublicSans-Regular', fontSize: 13.5, color: Theme.colors.onSurfaceVariant },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  summaryLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#475569',
    width: 130,
  },
  summaryValue: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
  summaryMedValue: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.primary,
    fontSize: 14,
  },
  imageCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...Theme.shadows.card,
  },
  imageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  imageCardTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#334155',
  },
  expandHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E6F4F4',
  },
  expandHeaderBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.primary,
  },
  imageTouchable: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomBadgeText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  imagePlaceholderBox: {
    height: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  imagePlaceholderTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
  },
  imagePlaceholderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  retryImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F4F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  retryImageBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  editSummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editSummaryBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  fullscreenModalBg: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  fullscreenModalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fullscreenModalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  fullscreenCloseBtn: {
    padding: 6,
  },
  fullscreenImage: {
    flex: 1,
    width: '100%',
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: 10,
  },
  notesTitle: { fontFamily: 'PublicSans-Bold', fontSize: 12.5, color: Theme.colors.onSecondaryContainer, marginBottom: 2 },
  notesText: { fontFamily: 'PublicSans-Regular', fontSize: 12.5, color: Theme.colors.onSecondaryContainer },
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 14,
    backgroundColor: Theme.colors.surface,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Theme.colors.error,
    marginRight: 6,
  },
  approveButton: {
    backgroundColor: Theme.colors.primary,
    marginLeft: 6,
  },
  rejectText: { fontFamily: 'PublicSans-Bold', fontSize: 14.5, color: Theme.colors.error },
  approveText: { fontFamily: 'PublicSans-Bold', fontSize: 14.5, color: Theme.colors.onPrimary },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: 'PublicSans-Bold', fontSize: 17, color: Theme.colors.onSurface },
  inputLabel: { fontFamily: 'PublicSans-Bold', fontSize: 12, color: Theme.colors.onSurfaceVariant, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: Theme.colors.onSurface,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  saveEditButton: {
    backgroundColor: Theme.colors.primary,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveEditText: { fontFamily: 'PublicSans-Bold', fontSize: 14.5, color: Theme.colors.onPrimary },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  voiceAssistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  voiceAssistBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#0F766E',
  },
  largeSectionTitle: {
    fontSize: 22,
  },
  highContrastCard: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  caregiverAuthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    marginBottom: 16,
  },
  caregiverAuthIconPlate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caregiverAuthTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0369A1',
  },
  caregiverAuthDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#0C4A6E',
    marginTop: 1,
    lineHeight: 15,
  },
  doctorVerifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  doctorVerifiedBannerText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#065F46',
  },
  doctorVerificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  doctorVerificationBannerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#92400E',
  },
  doctorVerificationBannerDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#78350F',
    marginTop: 1,
  },
  suspectedNonPrescriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginBottom: 16,
  },
  suspectedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suspectedBannerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#991B1B',
  },
  suspectedBannerText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
});