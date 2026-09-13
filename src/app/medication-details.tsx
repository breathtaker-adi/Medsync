// src/app/medication-details.tsx
import { Ionicons } from '@expo/vector-icons';
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
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { Medication } from '../types/medication';

export default function MedicationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { session } = useAuth();
  const [med, setMed] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchMedicationDetails(Number(id));
    }
  }, [id]);

  const fetchMedicationDetails = async (medId: number) => {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', medId)
      .eq('patient_id', session?.user?.id) // Security: scope to current user
      .single();

    if (error) {
      Alert.alert('Error', 'Could not load medication details.');
      console.error(error);
    } else if (data) {
      setMed(data);
    }
    setLoading(false);
  };

  const handleOrderMedicine = () => {
    if (!med) return;
    const searchQuery = `https://www.google.com/search?q=buy+${encodeURIComponent(
      med.medicine_name
    )}+medicine+online`;

    Linking.openURL(searchQuery).catch(() => {
      Alert.alert('Error', 'Could not open browser to order medicine.');
    });
  };

  const handleSkip = async () => {
    if (!med) return;

    const { error } = await supabase
      .from('medications')
      .update({ status: 'skipped' })
      .eq('id', med.id)
      .eq('patient_id', session?.user?.id); // Security: scope to current user

    if (error) {
      Alert.alert('Error', 'Failed to skip medication.');
    } else {
      Alert.alert('Skipped', 'Medication dose skipped for this term.');
      router.back();
    }
  };

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedTime, setEditedTime] = useState('');

  // 1. DISABLE (Pause)
  const handleDisable = async () => {
    Alert.alert(
      'Pause Medication',
      'This will hide the card from your dashboard and stop all alarms. You can re-enable it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause',
          onPress: async () => {
            await supabase.from('medications').update({ is_active: false }).eq('id', Number(id)).eq('patient_id', session?.user?.id);
            router.back(); // Go back to dashboard
          },
        },
      ]
    );
  };

  // 2. DELETE
  const handleDelete = async () => {
    Alert.alert(
      'Delete Medication',
      'Are you sure? This will permanently delete this medication and all its history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('medications').delete().eq('id', Number(id)).eq('patient_id', session?.user?.id);
            router.back(); // Go back to dashboard
          },
        },
      ]
    );
  };

  // 3. EDIT TIME
  const handleEditTime = () => {
    setEditedTime(med?.time || '');
    setEditModalVisible(true);
  };

  const handleSaveTime = async () => {
    const formatted = editedTime.trim();
    if (formatted && formatted.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      const { error } = await supabase.from('medications').update({ time: formatted }).eq('id', Number(id)).eq('patient_id', session?.user?.id);
      if (error) {
        Alert.alert('Error', 'Could not update medication time.');
      } else {
        setMed((prev) => (prev ? { ...prev, time: formatted } : null));
        setEditModalVisible(false);
        Alert.alert('Success', 'Time updated. Pull to refresh on dashboard.');
      }
    } else {
      Alert.alert('Invalid Format', 'Please use 24-hour HH:MM format, e.g., 14:30');
    }
  };

  if (loading || !med) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medication Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
        <Text style={styles.medicineName}>{med.medicine_name}</Text>
        <Text style={styles.dosageText}>{med.dosage}</Text>
        <Text style={styles.timeDisplay}>{med.time}</Text>

        <View style={styles.spacer} />

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.sectionText}>
          {med.description || 'No description available for this medication.'}
        </Text>

        <View style={styles.spacer} />

        <Text style={styles.sectionTitle}>Prescribed Duration</Text>
        <Text style={styles.sectionText}>
          {med.duration || 'Not specified by doctor.'}
        </Text>

        {/* Management Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
            <Ionicons name="create-outline" size={24} color={Theme.colors.primary} />
            <Text style={styles.editButtonText}>Edit Time</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.disableButton} onPress={handleDisable}>
            <Ionicons name="pause-circle-outline" size={24} color={Theme.colors.secondary} />
            <Text style={styles.disableButtonText}>Pause Medication</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#D32F2F" />
            <Text style={styles.deleteButtonText}>Delete Forever</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Time Modal (Supports both Android & iOS) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Time</Text>
            <Text style={styles.modalSubtitle}>Enter the new time (24-hour HH:MM format)</Text>

            <TextInput
              style={styles.timeInput}
              placeholder="e.g., 14:30"
              placeholderTextColor={Theme.colors.outline}
              value={editedTime}
              onChangeText={setEditedTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

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

      {/* Order & Skip Buttons */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.orderButton} onPress={handleOrderMedicine}>
          <Ionicons
            name="cart-outline"
            size={20}
            color={Theme.colors.onPrimary}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.orderButtonText}>Order Medicine</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip Dosage for this Term</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginLeft: 16,
  },
  medicineName: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  dosageText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 18,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 16,
  },
  timeDisplay: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 24,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  spacer: {
    height: 24,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
    marginBottom: 8,
  },
  sectionText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 24,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Theme.colors.surface,
  },
  orderButton: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  orderButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  skipButton: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.outlineVariant,
  },
  skipButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.error,
  },
  actionsContainer: {
    marginTop: 32,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  editButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.primary,
  },
  disableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Theme.colors.secondaryContainer,
  },
  disableButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSecondaryContainer,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D32F2F',
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  deleteButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#D32F2F',
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
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 20,
    textAlign: 'center',
  },
  timeInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    borderRadius: 12,
    padding: 14,
    fontSize: 22,
    fontFamily: 'PublicSans-Bold',
    textAlign: 'center',
    marginBottom: 20,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: Theme.colors.surfaceContainer,
  },
  cancelModalButtonText: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onSurfaceVariant,
  },
  saveModalButton: {
    backgroundColor: Theme.colors.primary,
  },
  saveModalButtonText: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onPrimary,
  },
});