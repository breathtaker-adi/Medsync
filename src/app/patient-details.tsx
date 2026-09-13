import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

export default function PatientDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [profile, setProfile] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      // 1. Fetch Patient Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      setProfile(profileData);

      // 2. Fetch Patient Medications
      const { data: medsData } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', id);

      setMedications(medsData || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color={Theme.colors.primary} />
      </TouchableOpacity>

      {/* Patient Header */}
      <View style={styles.header}>
        <View style={styles.largeAvatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.nameText}>{profile?.full_name}</Text>
        <Text style={styles.roleText}>Patient</Text>
      </View>

      {/* Medical Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Medical Information</Text>
        <Text style={styles.infoText}>Blood Group: {profile?.blood_group || 'N/A'}</Text>
        <Text style={styles.infoText}>Allergies: {profile?.allergies || 'None reported'}</Text>
      </View>

      {/* Medications List */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Active Medications</Text>

      {medications.length === 0 ? (
        <Text style={styles.emptyText}>No active medications prescribed.</Text>
      ) : (
        medications.map((med) => (
          <View key={med.id} style={styles.medCard}>
            <Text style={styles.medName}>{med.medicine_name}</Text>
            <Text style={styles.medDetails}>
              {med.dosage} • {med.time}
            </Text>
            {med.food_warning && (
              <Text style={styles.warningText}>⚠️ {med.food_warning}</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.surface },
  container: { flex: 1, backgroundColor: Theme.colors.surface },
  backButton: { marginBottom: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: Theme.colors.onPrimary,
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 40,
  },
  nameText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 28,
    color: Theme.colors.onSurface,
  },
  roleText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
  },
  infoCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Theme.colors.outline,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
    marginBottom: 12,
  },
  infoText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.outline,
    fontStyle: 'italic',
  },
  medCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.primary,
  },
  medName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  medDetails: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  warningText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#E65100',
    marginTop: 8,
  },
});