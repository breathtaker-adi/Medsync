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
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { SeniorButton } from '../components/SeniorButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAccessibility } from '../context/AccessibilityContext';
import { notificationService } from '../services/notificationService';
import { prescriptionService } from '../services/prescriptionService';
import { showErrorAlert } from '../utils/errorHandler';

export default function ReviewDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();
  const [review, setReview] = useState<any>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Editable states
  const [editedMedicine, setEditedMedicine] = useState('');
  const [editedDosage, setEditedDosage] = useState('');
  const [editedDuration, setEditedDuration] = useState('');
  const [doctorNote, setDoctorNote] = useState('');

  const { profile, session } = useAuth();
  const isDoctor = profile?.role === 'doctor' || profile?.is_verified_doctor === true;

  const handleReadAloudPrescription = () => {
    triggerHaptic();
    const medName = editedMedicine || review?.medication || 'Prescription medication';
    const dosage = editedDosage || review?.dosage || 'unspecified dosage';
    const duration = editedDuration || review?.duration || 'standard duration';
    const patient = review?.patient_name || 'the patient';
    const text = `Prescription for ${patient}. Medication: ${medName}. Dosage: ${dosage}. Duration: ${duration}. ${
      doctorNote ? `Doctor's note: ${doctorNote}` : ''
    }`;
    notificationService.speakText(text, true);
  };

  useEffect(() => {
    if (id) fetchReviewDetails(Number(id));
  }, [id]);

  const fetchReviewDetails = async (reviewId: number) => {
    const res = await prescriptionService.fetchReviewById(reviewId);

    if (!res.success || !res.data) {
      showErrorAlert(res.error, 'Could not load review details');
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

      // Resolve signed URL for private bucket paths
      if (data.image_url) {
        if (data.image_url.startsWith('http://') || data.image_url.startsWith('https://')) {
          setResolvedImageUrl(data.image_url);
        } else {
          try {
            const { data: signedData } = await supabase.storage
              .from('prescriptions')
              .createSignedUrl(data.image_url, 3600);
            setResolvedImageUrl(signedData?.signedUrl || data.image_url);
          } catch (e) {
            console.error('Failed to create signed URL:', e);
            setResolvedImageUrl(data.image_url);
          }
        }
      }
    setLoading(false);
  };

  const handleSaveEdits = async () => {
    if (!review) return;

    const { error } = await supabase
      .from('pending_reviews')
      .update({
        medication: editedMedicine,
        dosage: editedDosage,
        duration: editedDuration,
        doctor_notes: doctorNote, // Save the note!
      })
      .eq('id', review.id);

    if (error) {
      Alert.alert('Error', 'Could not save corrections.');
      console.error(error);
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

    if (!isDoctor) {
      Alert.alert(
        'Physician Verification Required',
        'Only verified doctors can approve prescriptions and schedule medications for patients. Caregiver view is read-only.'
      );
      return;
    }

    const medName = editedMedicine || review.medication;
    const dosageInfo = editedDosage || review.dosage;

    // 1. Attempt Atomic RPC Approval (single transactional execution)
    let approved = false;
    const { data: rpcData, error: rpcError } = await supabase.rpc('approve_review', {
      p_review_id: review.id,
      p_medicine_name: medName,
      p_dosage: dosageInfo,
      p_duration: editedDuration,
      p_time: review.time || '08:00',
      p_doctor_notes: doctorNote || null,
    });

    if (!rpcError && rpcData?.success) {
      approved = true;
    } else {
      console.warn('approve_review RPC fallback:', rpcError?.message);
      // Fallback: update review status then insert medication with rollback safety
      const { error: reviewError } = await supabase
        .from('pending_reviews')
        .update({
          status: 'approved',
          medication: editedMedicine,
          dosage: editedDosage,
          duration: editedDuration,
          doctor_notes: doctorNote,
        })
        .eq('id', review.id);

      if (reviewError) {
        Alert.alert('Error', 'Failed to update review status.');
        console.error(reviewError);
        return;
      }

      const { error: medError } = await supabase.from('medications').insert({
        medicine_name: medName,
        dosage: dosageInfo,
        time: review.time || '08:00',
        status: 'pending',
        patient_id: review.patient_id,
      });

      if (medError) {
        await supabase
          .from('pending_reviews')
          .update({ status: 'pending' })
          .eq('id', review.id);
        Alert.alert('Error', 'Failed to create medication schedule. Review has been reverted to pending.');
        console.error(medError);
        return;
      }
      approved = true;
    }

    // --- PUSH NOTIFICATION TO PATIENT ---
    try {
      // Get the patient's push token using the secure view
      const { data: patientData } = await supabase
        .from('patient_push_tokens')
        .select('push_token')
        .eq('patient_id', review.patient_id)
        .eq('caregiver_id', session?.user?.id); // Ensure doctor is authorized

      if (patientData && patientData.length > 0) {
        const patientToken = patientData[0].push_token;

        // Send notification via Expo's Push API
        if (patientToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: patientToken,
              title: '✅ Prescription Approved',
              body: `Your doctor approved ${medName}. It has been added to your dashboard!`,
              priority: 'high',
              sound: 'default',
            }),
          });
        }
      }
    } catch (notifError) {
      console.error('Failed to send push notification to patient:', notifError);
    }
    // --- END PUSH NOTIFICATION ---

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

    Alert.alert('Rejected', 'Prescription has been rejected.');
    router.back();
  };

  if (loading || !review) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
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
        {/* Image of Prescription */}
        <Image
          source={{ uri: resolvedImageUrl || review.image_url }}
          style={styles.prescriptionImage}
          contentFit="contain"
        />

        {!isDoctor && (
          <View style={[styles.notesContainer, { backgroundColor: Theme.colors.surfaceContainerHigh, marginTop: 16 }]}>
            <Text style={[styles.notesTitle, { color: Theme.colors.onSurfaceVariant }]}>
              ℹ️ Caregiver Oversight View
            </Text>
            <Text style={[styles.notesText, { color: Theme.colors.onSurfaceVariant }]}>
              Only verified medical doctors can officially approve prescriptions to a patient's schedule. You may inspect the slip and record notes.
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        {/* Patient Info */}
        <Text style={styles.sectionTitle}>Patient</Text>
        <Text style={styles.sectionText}>{review.patient_name}</Text>

        <View style={styles.spacer} />

        {/* AI Summary / Details */}
        <View style={styles.summaryHeaderRow}>
          <Text style={[styles.sectionTitle, isAccessibilityMode && styles.largeSectionTitle]}>Summary</Text>
          <TouchableOpacity
            style={styles.voiceAssistBtn}
            onPress={handleReadAloudPrescription}
            accessibilityRole="button"
            accessibilityLabel="Listen to prescription details"
          >
            <Ionicons name="volume-high" size={18} color={Theme.colors.primary} />
            <Text style={styles.voiceAssistBtnText}>Read Aloud</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.summaryCard, isAccessibilityMode && styles.highContrastCard]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Medicine:</Text>
            <Text style={styles.summaryValue}>{editedMedicine}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dosage:</Text>
            <Text style={styles.summaryValue}>{editedDosage}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration:</Text>
            <Text style={styles.summaryValue}>{editedDuration}</Text>
          </View>
        </View>

        {/* Show Doctor Notes if they exist */}
        {doctorNote ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Doctor's Note:</Text>
            <Text style={styles.notesText}>{doctorNote}</Text>
          </View>
        ) : null}
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
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
  },
  summaryRow: { flexDirection: 'row', marginBottom: 6 },
  summaryLabel: { fontFamily: 'PublicSans-Bold', fontSize: 13.5, color: Theme.colors.onSurface, width: 85 },
  summaryValue: { fontFamily: 'PublicSans-Regular', fontSize: 13.5, color: Theme.colors.onSurfaceVariant, flex: 1 },
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
});