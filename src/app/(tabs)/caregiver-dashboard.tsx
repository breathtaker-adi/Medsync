// src/app/(tabs)/caregiver-dashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/authcontext';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../theme';

export interface ProfileItem {
  is_verified_doctor?: boolean;
}

export interface PendingReviewItem {
  id: number;
  patient_name: string;
  medication: string;
  dosage?: string | null;
  duration?: string | null;
  time_ago?: string;
  image_url?: string;
  status: string;
  doctor_notes?: string | null;
  patient_id?: string | null;
}

export interface PatientItem {
  id: number | string;
  patient_name: string;
  patient_id: string;
  condition: string;
  adherence: number;
  doctor_id?: string;
  override_alerts?: boolean;
}

export interface MissedAlertItem {
  patient_id: string;
  patient_name: string;
  missed_count: number;
}

export default function CaregiverDashboard() {
  const router = useRouter();
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileItem | null>(null);
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [reviews, setReviews] = useState<PendingReviewItem[]>([]);
  const [missedAlerts, setMissedAlerts] = useState<MissedAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Linking Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [pairingInput, setPairingInput] = useState('');
  const [linking, setLinking] = useState(false);

  const checkMissedDoses = async () => {
    if (!session?.user?.id) return;

    // 1. Fetch caregiver profile alert preferences
    const { data: caregiverProfile } = await supabase
      .from('profiles')
      .select('alerts_enabled')
      .eq('id', session.user.id)
      .maybeSingle();

    const globalAlertsOn = caregiverProfile?.alerts_enabled ?? true;

    // 2. Get linked patients (filter by override if global alerts are off)
    let query = supabase
      .from('patient_caregivers')
      .select('patient_id, override_alerts')
      .eq('caregiver_id', session.user.id);

    if (!globalAlertsOn) {
      query = query.eq('override_alerts', true);
    }

    const { data: links } = await query;

    if (!links || links.length === 0) {
      setMissedAlerts([]);
      return;
    }

    const patientIds = links.map((link) => link.patient_id);
    const today = new Date().toISOString().split('T')[0];

    // 3. Get names for these patients
    const { data: patientProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', patientIds);

    // 4. Find logs prior to today that are pending or missed
    const { data: missedLogs } = await supabase
      .from('medication_logs')
      .select('patient_id, log_date')
      .in('patient_id', patientIds)
      .lt('log_date', today)
      .in('status', ['pending', 'missed']);

    // 5. Flag patients with 2 or more missed logs
    if (missedLogs && patientProfiles) {
      const alertList: MissedAlertItem[] = [];

      patientIds.forEach((pId) => {
        const patientMisses = missedLogs.filter((log) => log.patient_id === pId);
        const patientInfo = patientProfiles.find((p) => p.id === pId);

        if (patientMisses.length >= 2 && patientInfo) {
          alertList.push({
            patient_id: pId,
            patient_name: patientInfo.full_name,
            missed_count: patientMisses.length,
          });
        }
      });

      setMissedAlerts(alertList);
    }
  };

  const fetchData = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch Doctor/Caregiver Profile Verification Status
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('is_verified_doctor')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userProfile) {
        setProfile(userProfile);
      }

      // 1. Fetch Pending Reviews (SCOPED to caregiver's linked patients)
      // First, get the patient IDs this caregiver is linked to
      const { data: linkedPatients } = await supabase
        .from('patient_caregivers')
        .select('patient_id')
        .eq('caregiver_id', session.user.id);

      const linkedPatientIds = (linkedPatients || []).map((lp: any) => lp.patient_id);

      let reviewData: any[] = [];
      let reviewError: any = null;

      if (linkedPatientIds.length > 0) {
        const result = await supabase
          .from('pending_reviews')
          .select('*')
          .eq('status', 'pending')
          .in('patient_id', linkedPatientIds);
        reviewData = result.data || [];
        reviewError = result.error;
      }

      // 2. Fetch Patient Roster & join override preferences
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('doctor_id', session.user.id);

      const { data: links } = await supabase
        .from('patient_caregivers')
        .select('patient_id, override_alerts')
        .eq('caregiver_id', session.user.id);

      if (reviewError) {
        console.error('Error fetching pending reviews:', reviewError);
      } else {
        setReviews(reviewData || []);
      }

      if (patientError) {
        console.error('Error fetching patient roster:', patientError);
      } else {
        const mergedPatients = (patientData || []).map((patient) => {
          const link = links?.find(
            (l) => l.patient_id === patient.patient_id || l.patient_id === String(patient.id)
          );
          return {
            ...patient,
            override_alerts: link ? link.override_alerts : false,
          };
        });
        setPatients(mergedPatients);
      }
    } catch (err) {
      console.error('Unexpected error fetching caregiver data:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), checkMissedDoses()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      checkMissedDoses();
    }, [session?.user?.id])
  );

  const handleLinkPatient = async () => {
    const formattedCode = pairingInput.trim().toUpperCase();

    if (!session?.user?.id || formattedCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character code.');
      return;
    }
    setLinking(true);

    const { data, error } = await supabase
      .from('patient_caregivers')
      .select('patient_id, caregiver_id')
      .eq('pairing_code', formattedCode)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Invalid pairing code or patient not found.');
      setLinking(false);
      return;
    }

    if (data.caregiver_id) {
      Alert.alert('Already Linked', 'This patient is already linked to a caregiver.');
      setLinking(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('patient_caregivers')
      .update({ caregiver_id: session.user.id })
      .eq('pairing_code', formattedCode);

    if (!updateError) {
      Alert.alert('Success', 'Patient linked successfully!');
      setModalVisible(false);
      setPairingInput('');
      await Promise.all([fetchData(), checkMissedDoses()]);
    } else {
      Alert.alert('Error', 'Failed to link patient.');
    }
    setLinking(false);
  };

  const handleToggleOverride = async (patient: PatientItem, value: boolean) => {
    const patientIdentifier = patient.patient_id || String(patient.id);

    // Optimistic UI update
    setPatients((prev) =>
      prev.map((p) => (p.id === patient.id ? { ...p, override_alerts: value } : p))
    );

    const { error } = await supabase
      .from('patient_caregivers')
      .update({ override_alerts: value })
      .eq('patient_id', patientIdentifier)
      .eq('caregiver_id', session?.user?.id);

    if (error) {
      console.error('Error updating override alerts:', error);
      Alert.alert('Error', 'Could not update alert preference for this patient.');
      setPatients((prev) =>
        prev.map((p) => (p.id === patient.id ? { ...p, override_alerts: !value } : p))
      );
    } else {
      checkMissedDoses();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[Theme.colors.primary]}
          tintColor={Theme.colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Caregiver Dashboard</Text>
        {profile?.is_verified_doctor && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Verified MD</Text>
          </View>
        )}
      </View>

      <Text style={styles.subHeaderText}>Review prescriptions and monitor patients</Text>

      {/* Link New Patient Button */}
      <TouchableOpacity
        style={styles.linkPatientButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add-circle" size={24} color={Theme.colors.onPrimary} />
        <Text style={styles.linkPatientText}>Link New Patient</Text>
      </TouchableOpacity>

      {/* Missed Dose Alerts Banner */}
      {missedAlerts.length > 0 && (
        <View style={styles.alertsContainer}>
          {missedAlerts.map((alert, index) => (
            <View key={index} style={styles.alertBanner}>
              <Ionicons name="warning" size={24} color="#FFFFFF" />
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>Missed Doses!</Text>
                <Text style={styles.alertMessage}>
                  {alert.patient_name} has missed {alert.missed_count} doses. Please check in on them.
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Pending Reviews Section */}
      <View style={styles.sectionHeader}>
        <Ionicons name="alert-circle" size={24} color={Theme.colors.secondaryContainer} />
        <Text style={styles.sectionTitle}>Pending Reviews</Text>
      </View>

      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>No pending prescriptions.</Text>
      ) : (
        reviews.map((review) => (
          <TouchableOpacity
            key={review.id}
            style={styles.reviewCard}
            onPress={() => router.push(`/review-details?id=${review.id}`)}
          >
            <View style={styles.reviewInfo}>
              <Text style={styles.patientName}>{review.patient_name}</Text>
              <Text style={styles.reviewMed}>
                {review.medication} - Dosage verification needed
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.onSecondaryContainer} />
          </TouchableOpacity>
        ))
      )}

      <View style={styles.spacer} />

      {/* Patient Directory Button */}
      <TouchableOpacity
        style={styles.directoryButton}
        onPress={() => router.push('/patient-directory')}
      >
        <Ionicons name="people-circle-outline" size={24} color={Theme.colors.primary} />
        <Text style={styles.directoryButtonText}>View Patient Directory</Text>
        <Ionicons name="chevron-forward" size={24} color={Theme.colors.onSurfaceVariant} />
      </TouchableOpacity>

      {/* Pairing Code Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Patient Code</Text>
            <Text style={styles.modalSubtitle}>
              Ask your patient for their 6-character pairing code.
            </Text>

            <TextInput
              style={styles.codeInput}
              placeholder="e.g. A4B9C2"
              placeholderTextColor={Theme.colors.outline}
              value={pairingInput}
              onChangeText={setPairingInput}
              autoCapitalize="characters"
              maxLength={6}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setPairingInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.linkButton]}
                onPress={handleLinkPatient}
                disabled={linking}
              >
                <Text style={styles.linkButtonText}>
                  {linking ? 'Linking...' : 'Link Patient'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 32,
    color: Theme.colors.onSurface,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D7D46', // Medical Green
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  verifiedText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 20,
  },
  linkPatientButton: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  linkPatientText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  alertsContainer: {
    marginBottom: 20,
    gap: 12,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  alertMessage: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: '#FFEBEE',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginLeft: 8,
  },
  emptyText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.outline,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: Theme.colors.secondaryContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewInfo: {
    flex: 1,
    paddingRight: 12,
  },
  reviewMed: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSecondaryContainer,
    marginTop: 4,
  },
  patientCard: {
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  patientDetails: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  adherenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adherenceText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
  },
  patientCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.outline,
  },
  specialAlertText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    flex: 1,
    flexWrap: 'wrap',
    marginRight: 8,
  },
  spacer: {
    height: 32,
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
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  codeInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontFamily: 'PublicSans-Bold',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 20,
    color: Theme.colors.onSurface,
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
  cancelButton: {
    backgroundColor: Theme.colors.surfaceContainer,
  },
  cancelButtonText: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onSurfaceVariant,
  },
  linkButton: {
    backgroundColor: Theme.colors.primary,
  },
  linkButtonText: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onPrimary,
  },
  directoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Theme.colors.outline,
    gap: 12,
  },
  directoryButtonText: {
    flex: 1,
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: Theme.colors.primary,
    marginLeft: 8,
  },
});