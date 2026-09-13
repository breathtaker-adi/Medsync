// src/app/review-details.tsx
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
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

export default function ReviewDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Editable states
  const [editedMedicine, setEditedMedicine] = useState('');
  const [editedDosage, setEditedDosage] = useState('');
  const [editedDuration, setEditedDuration] = useState('');
  const [doctorNote, setDoctorNote] = useState('');

  useEffect(() => {
    if (id) fetchReviewDetails(Number(id));
  }, [id]);

  const fetchReviewDetails = async (reviewId: number) => {
    const { data, error } = await supabase
      .from('pending_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (error) {
      Alert.alert('Error', 'Could not load review details.');
      console.error(error);
    } else if (data) {
      setReview(data);
      // Pre-fill editable fields
      setEditedMedicine(data.medication || '');
      setEditedDosage(data.dosage || 'Take 1 tablet');
      setEditedDuration(data.duration || '30 days');
      setDoctorNote(data.doctor_notes || '');
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

    const medName = editedMedicine || review.medication;
    const dosageInfo = editedDosage || review.dosage;

    // 1. Insert into medications table with the patient's ID
    const { error: medError } = await supabase.from('medications').insert({
      medicine_name: medName,
      dosage: dosageInfo,
      time: review.time || '08:00', // Default time if not provided
      status: 'pending',
      patient_id: review.patient_id, // Links medication directly to the patient
    });

    if (medError) {
      Alert.alert('Error', 'Failed to create medication schedule.');
      console.error(medError);
      return;
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

    // 2. Update the review status to approved with any doctor modifications
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
      Alert.alert('Warning', 'Medication created, but failed to update review status.');
      console.error(reviewError);
      return;
    }

    Alert.alert('Success', 'Prescription approved and sent to patient!');
    router.back();
  };

  const handleReject = async () => {
    if (!review) return;
    await supabase
      .from('pending_reviews')
      .update({ status: 'rejected', doctor_notes: doctorNote })
      .eq('id', review.id);

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Prescription</Text>

        {/* 3-Dot Edit Menu */}
        <TouchableOpacity onPress={() => setEditModalVisible(true)}>
          <Entypo name="dots-three-vertical" size={24} color={Theme.colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Image of Prescription */}
        <Image
          source={{ uri: review.image_url }}
          style={styles.prescriptionImage}
          contentFit="contain"
        />

        <View style={styles.spacer} />

        {/* Patient Info */}
        <Text style={styles.sectionTitle}>Patient</Text>
        <Text style={styles.sectionText}>{review.patient_name}</Text>

        <View style={styles.spacer} />

        {/* AI Summary / Details */}
        <Text style={styles.sectionTitle}>Summary</Text>

        <View style={styles.summaryCard}>
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
        <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={handleReject}>
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={handleApprove}>
          <Text style={styles.approveText}>Approve</Text>
        </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerTitle: { fontFamily: 'PublicSans-Bold', fontSize: 22, color: Theme.colors.onSurface },
  prescriptionImage: { width: '100%', height: 300, borderRadius: 16, backgroundColor: Theme.colors.surfaceContainer },
  spacer: { height: 24 },
  sectionTitle: { fontFamily: 'PublicSans-Bold', fontSize: 18, color: Theme.colors.onSurface, marginBottom: 8 },
  sectionText: { fontFamily: 'PublicSans-Regular', fontSize: 16, color: Theme.colors.onSurfaceVariant },
  summaryCard: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
  },
  summaryRow: { flexDirection: 'row', marginBottom: 8 },
  summaryLabel: { fontFamily: 'PublicSans-Bold', fontSize: 16, color: Theme.colors.onSurface, width: 100 },
  summaryValue: { fontFamily: 'PublicSans-Regular', fontSize: 16, color: Theme.colors.onSurfaceVariant, flex: 1 },
  notesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: 12,
  },
  notesTitle: { fontFamily: 'PublicSans-Bold', fontSize: 14, color: Theme.colors.onSecondaryContainer, marginBottom: 4 },
  notesText: { fontFamily: 'PublicSans-Regular', fontSize: 14, color: Theme.colors.onSecondaryContainer },
  bottomButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    backgroundColor: Theme.colors.surface,
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Theme.colors.error,
    marginRight: 8,
  },
  approveButton: {
    backgroundColor: Theme.colors.primary,
    marginLeft: 8,
  },
  rejectText: { fontFamily: 'PublicSans-Bold', fontSize: 18, color: Theme.colors.error },
  approveText: { fontFamily: 'PublicSans-Bold', fontSize: 18, color: Theme.colors.onPrimary },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'PublicSans-Bold', fontSize: 20, color: Theme.colors.onSurface },
  inputLabel: { fontFamily: 'PublicSans-Bold', fontSize: 14, color: Theme.colors.onSurfaceVariant, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  saveEditButton: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveEditText: { fontFamily: 'PublicSans-Bold', fontSize: 18, color: Theme.colors.onPrimary },
});