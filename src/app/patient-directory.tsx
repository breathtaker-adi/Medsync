import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Theme } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { patientService } from '../services/patientService';
import { PatientItem } from '../types/patient';

export default function PatientDirectory() {
  const router = useRouter();
  const { session } = useAuth();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Wrapped in useFocusEffect so it re-fetches every time you open the screen
  useFocusEffect(
    React.useCallback(() => {
      const fetchPatients = async () => {
        if (!session?.user?.id) return;
        const res = await patientService.fetchLinkedPatients(session.user.id);
        if (res.success) {
          setPatients(res.data || []);
        } else {
          setPatients([]);
        }
        setLoading(false);
      };

      fetchPatients();
    }, [session?.user?.id])
  );

  const filteredPatients = patients.filter((p) =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePatientPress = (patientId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/patient-details?id=${patientId}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading patient directory...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Patient Directory"
        subtitle={`${patients.length} ${patients.length === 1 ? 'patient' : 'patients'} linked to care roster`}
        fallbackRoute="/(tabs)/caregiver-dashboard"
      />
      <View style={styles.container}>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={22}
            color={Theme.colors.primary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient by name..."
            placeholderTextColor={Theme.colors.outline}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={Theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Patient List */}
        <FlatList
          data={filteredPatients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconPlate}>
                <Ionicons
                  name={search ? 'search-outline' : 'people-outline'}
                  size={44}
                  color={Theme.colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {search ? 'No Matches Found' : 'No Patients Linked Yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {search
                  ? `No patients match "${search}". Check spelling or clear search.`
                  : 'Patients will appear here once linked using their pairing code from your Caregiver Dashboard.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handlePatientPress(item.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`View details for ${item.full_name}`}
            >
              {/* Avatar Circle with Initial */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.full_name?.charAt(0).toUpperCase() || 'P'}
                </Text>
              </View>

              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{item.full_name}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.patientBadge}>
                    <Text style={styles.patientBadgeText}>Active Patient</Text>
                  </View>
                  {item.blood_group && (
                    <View style={styles.bloodBadge}>
                      <Ionicons name="water" size={12} color="#D32F2F" />
                      <Text style={styles.bloodBadgeText}>{item.blood_group}</Text>
                    </View>
                  )}
                </View>

                {/* Contact numbers and actions */}
                {item.phone || item.email || item.emergency_contact_phone ? (
                  <View style={styles.directoryContactRow}>
                    {item.phone ? (
                      <TouchableOpacity
                        style={styles.directoryContactPill}
                        onPress={(e) => {
                          e.stopPropagation();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          Linking.openURL(`tel:${item.phone}`);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${item.phone}`}
                      >
                        <Ionicons name="call" size={10} color="#0284C7" />
                        <Text style={styles.directoryContactText}>{item.phone}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.emergency_contact_phone ? (
                      <TouchableOpacity
                        style={[styles.directoryContactPill, styles.directoryEmergencyPill]}
                        onPress={(e) => {
                          e.stopPropagation();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          Linking.openURL(`tel:${item.emergency_contact_phone}`);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Emergency call ${item.emergency_contact_phone}`}
                      >
                        <Ionicons name="alert-circle" size={10} color="#DC2626" />
                        <Text style={[styles.directoryContactText, { color: '#DC2626' }]}>
                          SOS: {item.emergency_contact_phone}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.chevronPlate}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Theme.colors.primary}
                />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    gap: 16,
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 28,
    color: Theme.colors.onSurface,
  },
  subtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    marginHorizontal: 20,
    marginVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    minHeight: 44,
    ...Theme.elevation.level1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PublicSans-Medium',
    fontSize: 13.5,
    color: Theme.colors.onSurface,
    paddingVertical: 8,
  },
  listContent: {
    padding: 14,
    paddingTop: 6,
    paddingBottom: 32,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    gap: 10,
    ...Theme.elevation.level1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.elevation.level1,
  },
  avatarText: {
    color: Theme.colors.onPrimary,
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 16,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: Theme.colors.onSurface,
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patientBadge: {
    backgroundColor: '#E8F5F5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  patientBadgeText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: Theme.colors.primary,
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bloodBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#D32F2F',
  },
  directoryContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  directoryContactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  directoryEmergencyPill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  directoryContactText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 10,
    color: '#0284C7',
  },
  chevronPlate: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Theme.colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyIconPlate: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
});