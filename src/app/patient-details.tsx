import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeniorButton } from '../components/SeniorButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

import { useAccessibility } from '../context/AccessibilityContext';
import { patientService } from '../services/patientService';
import { UserProfile } from '../types/auth';
import { Medication } from '../types/medication';

export default function PatientDetails() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();
  const params = useLocalSearchParams<{ id?: string; patientId?: string; name?: string }>();
  const targetId = params.id || params.patientId;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!targetId || !session?.user?.id) {
        setLoading(false);
        return;
      }
      const res = await patientService.fetchPatientDetails(targetId, session.user.id);
      if (res.success && res.data) {
        setProfile(res.data.profile);
        setMedications(res.data.medications);
      } else {
        setProfile(null);
        setMedications([]);
      }
      setLoading(false);
    };

    fetchData();
  }, [targetId, session?.user?.id]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading patient record...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={profile?.full_name || 'Patient Record'}
        subtitle="Clinical profile & active medications"
        onBack={handleBack}
        fallbackRoute="/patient-directory"
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Patient Profile Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.largeAvatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0).toUpperCase() || 'P'}
            </Text>
          </View>
          <Text style={styles.nameText}>{profile?.full_name || 'Patient'}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={16} color={Theme.colors.primary} />
            <Text style={styles.roleBadgeText}>Linked Patient</Text>
          </View>
        </View>

        {/* Clinical Snapshot Cards */}
        <Text style={styles.sectionHeader}>CLINICAL INFORMATION</Text>
        <View style={styles.clinicalGrid}>
          {/* Blood Group */}
          <View style={styles.clinicalCard}>
            <View style={[styles.clinicalIconPlate, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="water" size={26} color="#D32F2F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicalLabel}>Blood Group</Text>
              <Text style={styles.clinicalValue}>{profile?.blood_group || 'N/A'}</Text>
            </View>
          </View>

          {/* Allergies */}
          <View style={styles.clinicalCard}>
            <View style={[styles.clinicalIconPlate, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="warning" size={26} color="#E65100" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicalLabel}>Allergies</Text>
              <Text style={[styles.clinicalValue, { fontSize: 16 }]}>
                {profile?.allergies || 'None reported'}
              </Text>
            </View>
          </View>
        </View>

        {/* Active Medications List */}
        <View style={styles.medsHeaderRow}>
          <Text style={styles.sectionHeader}>ACTIVE MEDICATIONS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{medications.length} Prescribed</Text>
          </View>
        </View>

        {medications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="medical-outline" size={48} color={Theme.colors.outline} />
            <Text style={styles.emptyTitle}>No Active Medications</Text>
            <Text style={styles.emptyDesc}>
              This patient currently does not have any active medication regimens recorded.
            </Text>
          </View>
        ) : (
          medications.map((med) => (
            <View key={med.id} style={styles.medCard}>
              <View style={styles.medCardHeader}>
                <View style={styles.medIconPlate}>
                  <Ionicons name="fitness" size={24} color={Theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{med.medicine_name}</Text>
                  <Text style={styles.medDosage}>
                    {med.dosage} • {med.time}
                  </Text>
                </View>
                {med.pills_remaining !== undefined && med.pills_remaining !== null && (
                  <View
                    style={[
                      styles.stockBadge,
                      med.pills_remaining <= 5 && styles.stockBadgeLow,
                    ]}
                  >
                    <Ionicons
                      name="cube-outline"
                      size={14}
                      color={med.pills_remaining <= 5 ? '#C62828' : Theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.stockBadgeText,
                        med.pills_remaining <= 5 && styles.stockBadgeTextLow,
                      ]}
                    >
                      {med.pills_remaining} left
                    </Text>
                  </View>
                )}
              </View>

              {med.food_warning && (
                <View style={styles.warningBanner}>
                  <Ionicons name="information-circle" size={18} color="#E65100" />
                  <Text style={styles.warningText}>{med.food_warning}</Text>
                </View>
              )}
            </View>
          ))
        )}

        {/* Action Button */}
        <SeniorButton
          title="Done"
          icon="checkmark-circle"
          variant="secondary"
          onPress={handleBack}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
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
  scrollContent: {
    padding: 14,
    paddingTop: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
  },
  backButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: Theme.colors.onSurface,
    marginLeft: 6,
  },
  profileHeaderCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Theme.colors.outlineVariant,
    marginBottom: 16,
    ...Theme.elevation.level2,
  },
  largeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...Theme.elevation.level2,
  },
  avatarText: {
    color: Theme.colors.onPrimary,
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
  },
  nameText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 18,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  roleBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
  },
  sectionHeader: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  clinicalGrid: {
    gap: 8,
    marginBottom: 18,
  },
  clinicalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    gap: 10,
    ...Theme.elevation.level1,
  },
  clinicalIconPlate: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicalLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 1,
  },
  clinicalValue: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  medsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  countBadge: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  emptyCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
  },
  emptyTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onSurface,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 17,
  },
  medCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 13,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.primary,
    ...Theme.elevation.level1,
  },
  medCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medIconPlate: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: Theme.colors.onSurface,
  },
  medDosage: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F5F5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stockBadgeLow: {
    backgroundColor: '#FFEBEE',
  },
  stockBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: Theme.colors.primary,
  },
  stockBadgeTextLow: {
    color: '#C62828',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: '#E65100',
  },
});