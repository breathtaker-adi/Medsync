import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

export default function PatientDirectory() {
  const router = useRouter();
  const { session } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Wrapped in useFocusEffect so it re-fetches every time you open the screen!
  useFocusEffect(
    React.useCallback(() => {
      const fetchPatients = async () => {
        if (!session?.user?.id) return;

        // Fetch all linked patients
        const { data: links } = await supabase
          .from('patient_caregivers')
          .select('patient_id, override_alerts')
          .eq('caregiver_id', session.user.id);

        if (links && links.length > 0) {
          const patientIds = links.map((l) => l.patient_id);

          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', patientIds);

          setPatients(profiles || []);
        } else {
          setPatients([]); // Clear the list if no patients are linked
        }
        setLoading(false);
      };

      fetchPatients();
    }, [session?.user?.id])
  );

  // Filter patients based on search input
  const filteredPatients = patients.filter((p) =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Theme.colors.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients..."
          placeholderTextColor={Theme.colors.outline}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Patient List */}
      <FlatList
        data={filteredPatients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No patients found.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => router.push(`/patient-details?id=${item.id}`)}
          >
            {/* Avatar Circle with Initials */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.full_name?.charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.patientName}>{item.full_name}</Text>

            <Ionicons name="chevron-forward" size={24} color={Theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.surface },
  container: { flex: 1, backgroundColor: Theme.colors.surface, paddingTop: 40 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    margin: 20,
    marginBottom: 0,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.outline,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'PublicSans-Regular',
    color: Theme.colors.onSurface,
  },
  emptyText: { textAlign: 'center', color: Theme.colors.outline, marginTop: 20 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Theme.colors.onPrimary,
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
  },
  patientName: {
    flex: 1,
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
});