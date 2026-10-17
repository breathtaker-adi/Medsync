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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { Medication } from '../types/medication';
import { SeniorButton } from '../components/SeniorButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { medicationService } from '../services/medicationService';

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
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Medication Details"
        subtitle={med?.medicine_name ? `${med.medicine_name} • ${med.dosage}` : undefined}
        fallbackRoute="/(tabs)/patient-dashboard"
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconPlate}>
            <Ionicons name="medical" size={32} color={Theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.medicineName}>{med.medicine_name}</Text>
            <Text style={styles.dosageText}>{med.dosage}</Text>
          </View>
        </View>

        {/* Schedule & Stock Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="time" size={22} color={Theme.colors.primary} />
            <Text style={styles.statLabel}>Daily Time</Text>
            <Text style={styles.statValue}>{med.time}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={22} color={Theme.colors.secondary} />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{med.duration || '30 days'}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="cube-outline" size={22} color="#0284C7" />
            <Text style={styles.statLabel}>Pills Left</Text>
            <Text style={styles.statValue}>
              {med.pills_remaining ?? 30} / {med.total_pills ?? 30}
            </Text>
          </View>
        </View>

        {/* Food & Instruction Warning */}
        {med.food_warning && (
          <View style={styles.warningCard}>
            <Ionicons name="information-circle" size={24} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Doctor's Instructions</Text>
              <Text style={styles.warningBody}>{med.food_warning}</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Description & Clinical Notes</Text>
        <View style={styles.infoBox}>
          <Text style={styles.sectionText}>
            {med.description || 'Take strictly according to schedule. If experiencing side effects, notify your caregiver immediately.'}
          </Text>
        </View>

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
        <SeniorButton
          title="Order Refill Medicine"
          onPress={handleOrderMedicine}
          variant="primary"
          size="large"
          icon={<Ionicons name="cart-outline" size={22} color="#FFFFFF" />}
          style={{ marginBottom: 10 }}
        />

        <SeniorButton
          title="Skip Dosage for this Term"
          onPress={handleSkip}
          variant="outline"
          size="normal"
        />
      </View>
    </SafeAreaView>
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
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.outlineVariant,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    marginBottom: 16,
    gap: 16,
    ...Theme.elevation.level1,
  },
  heroIconPlate: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicineName: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: Theme.colors.onSurface,
    marginBottom: 2,
  },
  dosageText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    alignItems: 'center',
    gap: 4,
    ...Theme.elevation.level1,
  },
  statLabel: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    gap: 12,
    alignItems: 'center',
  },
  warningTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#92400E',
    marginBottom: 2,
  },
  warningBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    marginBottom: 14,
    ...Theme.elevation.level1,
  },
  timeDisplay: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  spacer: {
    height: 16,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onSurface,
    marginBottom: 6,
  },
  sectionText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 19,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: Theme.colors.surface,
  },
  orderButton: {
    backgroundColor: Theme.colors.primary,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  orderButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  skipButton: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
  },
  skipButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.error,
  },
  actionsContainer: {
    marginTop: 20,
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  editButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.primary,
  },
  disableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Theme.colors.secondaryContainer,
  },
  disableButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSecondaryContainer,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D32F2F',
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  deleteButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
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
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 14,
    textAlign: 'center',
  },
  timeInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: 10,
    padding: 10,
    fontSize: 18,
    fontFamily: 'PublicSans-Bold',
    textAlign: 'center',
    marginBottom: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerLowest,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: Theme.colors.surfaceContainer,
  },
  cancelModalButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  saveModalButton: {
    backgroundColor: Theme.colors.primary,
  },
  saveModalButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.onPrimary,
  },
});