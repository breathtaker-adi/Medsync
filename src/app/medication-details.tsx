// src/app/medication-details.tsx
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';
import { Medication } from '../types/medication';

export default function MedicationDetailsScreen() {
  const { id } = useLocalSearchParams();
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
      .eq('id', med.id);

    if (error) {
      Alert.alert('Error', 'Failed to skip medication.');
    } else {
      Alert.alert('Skipped', 'Medication dose skipped for this term.');
      router.back();
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
      </ScrollView>

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
});