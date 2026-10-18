// src/app/doctor-link.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

interface ConnectedDoctor {
  link_id: number;
  doctor_id: string;
  full_name: string;
  specialty?: string;
  clinic_affiliation?: string;
  medical_license_number?: string;
  medical_council?: string;
  is_verified_doctor?: boolean;
  status: string;
  created_at: string;
}

export default function DoctorLinkScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();

  const [doctors, setDoctors] = useState<ConnectedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const fetchConnectedDoctors = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch active links from patient_caregivers
      const { data: links, error: linkErr } = await supabase
        .from('patient_caregivers')
        .select('id, caregiver_id, status, created_at')
        .eq('patient_id', session.user.id)
        .not('caregiver_id', 'is', null);

      if (linkErr) {
        console.error('Error fetching doctor links:', linkErr);
      }

      const activeLinks = links || [];
      const doctorIds = activeLinks.map((l: any) => l.caregiver_id);

      if (doctorIds.length === 0) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      // 2. Fetch doctor profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, clinic_affiliation, medical_license_number, medical_council, is_verified_doctor, role')
        .in('id', doctorIds);

      if (profErr) {
        console.error('Error fetching doctor profiles:', profErr);
      }

      const doctorList: ConnectedDoctor[] = activeLinks.map((link: any) => {
        const prof = (profiles || []).find((p: any) => p.id === link.caregiver_id);
        const name = prof?.full_name ? (prof.full_name.startsWith('Dr.') ? prof.full_name : `Dr. ${prof.full_name}`) : 'Supervising Physician';
        return {
          link_id: link.id,
          doctor_id: link.caregiver_id,
          full_name: name,
          specialty: prof?.specialty || 'General Practice',
          clinic_affiliation: prof?.clinic_affiliation || 'Clinical Practice',
          medical_license_number: prof?.medical_license_number,
          medical_council: prof?.medical_council,
          is_verified_doctor: prof?.is_verified_doctor ?? false,
          status: link.status || 'active',
          created_at: link.created_at,
        };
      });

      setDoctors(doctorList);
    } catch (err) {
      console.error('Doctor link fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchExistingPairingCode = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from('patient_caregivers')
      .select('pairing_code, created_at')
      .eq('patient_id', session.user.id)
      .is('caregiver_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.pairing_code && data?.created_at) {
      const isExpired = Date.now() - new Date(data.created_at).getTime() > 15 * 60 * 1000;
      if (!isExpired) {
        setPairingCode(data.pairing_code);
      }
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchConnectedDoctors();
    fetchExistingPairingCode();
  }, [fetchConnectedDoctors, fetchExistingPairingCode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchConnectedDoctors(), fetchExistingPairingCode()]);
    setRefreshing(false);
  };

  const handleGenerateCode = async () => {
    if (!session?.user?.id) return;
    triggerHaptic();
    setGeneratingCode(true);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    for (let i = 0; i < 8; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { error } = await supabase.from('patient_caregivers').insert({
      patient_id: session.user.id,
      caregiver_id: null,
      pairing_code: newCode,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    setGeneratingCode(false);

    if (error) {
      Alert.alert('Error', 'Could not generate pairing code. Please try again.');
    } else {
      setPairingCode(newCode);
      Alert.alert('New Code Generated', `Give this code to your doctor: ${newCode}\nValid for 15 minutes.`);
    }
  };

  const handleUnlinkDoctor = (doctor: ConnectedDoctor) => {
    triggerHaptic();
    Alert.alert(
      'Disconnect Doctor',
      `Are you sure you want to disconnect ${doctor.full_name}? They will no longer have access to your prescriptions or dose logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('patient_caregivers')
              .delete()
              .eq('id', doctor.link_id);

            if (error) {
              Alert.alert('Error', 'Could not disconnect doctor.');
            } else {
              Alert.alert('Disconnected', `${doctor.full_name} has been unlinked from your account.`);
              fetchConnectedDoctors();
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Connected Physicians"
        subtitle="Manage your supervising doctors & clinical team"
        fallbackRoute="/(tabs)/patient-dashboard"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Theme.colors.primary]}
            tintColor={Theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Count Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconPlate}>
            <Ionicons name="medical" size={24} color={Theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>
              {doctors.length === 0
                ? 'No Physicians Connected'
                : doctors.length === 1
                ? '1 Supervising Physician'
                : `${doctors.length} Supervising Physicians`}
            </Text>
            <Text style={styles.summarySubtitle}>
              {doctors.length === 0
                ? 'Link your doctor using the 8-character pairing code below.'
                : 'Authorized to review prescriptions and monitor medication adherence.'}
            </Text>
          </View>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Syncing Connected Physicians...</Text>
          </View>
        ) : (
          <>
            {/* Connected Doctors Cards List */}
            {doctors.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeaderTitle}>Active Clinical Team</Text>
                {doctors.map((doc) => (
                  <View key={doc.link_id} style={styles.doctorCard}>
                    <View style={styles.doctorCardTop}>
                      <View style={styles.doctorAvatar}>
                        <Text style={styles.doctorAvatarText}>
                          {doc.full_name
                            .replace('Dr. ', '')
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.doctorInfoCol}>
                        <View style={styles.nameBadgeRow}>
                          <Text style={styles.doctorNameText} numberOfLines={1}>
                            {doc.full_name}
                          </Text>
                          {doc.is_verified_doctor && (
                            <View style={styles.verifiedBadge}>
                              <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
                              <Text style={styles.verifiedBadgeText}>Verified MD</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.specialtyText}>
                          {doc.specialty} • {doc.clinic_affiliation}
                        </Text>

                        {doc.medical_license_number && (
                          <View style={styles.licenseRow}>
                            <Ionicons name="card-outline" size={12} color="#64748B" />
                            <Text style={styles.licenseText}>
                              Reg: {doc.medical_license_number} ({doc.medical_council || 'State Council'})
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.doctorCardFooter}>
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activePillText}>Active Clinical Access</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.unlinkBtn}
                        onPress={() => handleUnlinkDoctor(doc)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                        <Text style={styles.unlinkBtnText}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Doctor Link Pairing Code Card */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeaderTitle}>Connect a New Doctor</Text>
              <View style={styles.pairingCard}>
                <View style={styles.pairingHeaderRow}>
                  <MaterialCommunityIcons name="qrcode-scan" size={24} color={Theme.colors.primary} />
                  <Text style={styles.pairingCardTitle}>Physician Pairing Code</Text>
                </View>

                <Text style={styles.pairingCardDesc}>
                  Share this temporary 8-character code with your doctor. They can enter it in their MedSync Clinical Roster to securely connect.
                </Text>

                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{pairingCode || '--------'}</Text>
                </View>

                {pairingCode && (
                  <View style={styles.timerRow}>
                    <Ionicons name="time-outline" size={14} color="#D97706" />
                    <Text style={styles.timerText}>Code is active (valid for 15 minutes)</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={handleGenerateCode}
                  disabled={generatingCode}
                >
                  {generatingCode ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={18} color="#FFFFFF" />
                      <Text style={styles.generateButtonText}>
                        {pairingCode ? 'Generate New Pairing Code' : 'Generate Doctor Pairing Code'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  summaryIconPlate: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  summaryTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  summarySubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  doctorCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorAvatarText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  doctorInfoCol: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  doctorNameText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  specialtyText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: '#0D9488',
    marginTop: 2,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  licenseText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  doctorCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  activePillText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#059669',
  },
  unlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  unlinkBtnText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#DC2626',
  },
  pairingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  pairingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pairingCardTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  pairingCardDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  codeText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 30,
    letterSpacing: 8,
    color: '#0F172A',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 14,
  },
  timerText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#D97706',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  generateButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
