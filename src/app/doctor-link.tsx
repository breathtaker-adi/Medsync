// src/app/doctor-link.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
import { useAuth } from '../context/AuthContext';
import { Theme } from '../theme';
import { useDoctorLink, ConnectedDoctor } from '../hooks/useDoctorLink';

export default function DoctorLinkScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();

  const {
    doctors,
    loading,
    refreshing,
    pairingCode,
    generatingCode,
    refresh,
    generateCode,
    disconnectDoctor,
  } = useDoctorLink();

  const [selectedDoctor, setSelectedDoctor] = useState<ConnectedDoctor | null>(null);

  const handleGenerateCode = async () => {
    triggerHaptic();
    const newCode = await generateCode();
    if (!newCode) {
      Alert.alert('Error', 'Could not generate pairing code. Please try again.');
    } else {
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
            const success = await disconnectDoctor(doctor);
            if (!success) {
              Alert.alert('Error', 'Could not disconnect doctor. Please try again.');
            } else {
              Alert.alert('Disconnected', `${doctor.full_name} has been unlinked from your account.`);
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
            onRefresh={refresh}
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
                  <TouchableOpacity
                    key={doc.link_id}
                    style={styles.doctorCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedDoctor(doc);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`View doctor profile for ${doc.full_name}`}
                  >
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

                      <View style={styles.cardChevronBox}>
                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
                  </TouchableOpacity>
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

      {/* Doctor Basic Information Modal */}
      <Modal
        visible={!!selectedDoctor}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDoctor(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDoctor(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
          >
            {selectedDoctor && (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderDocRow}>
                    <View style={styles.modalDocAvatar}>
                      <Text style={styles.modalDocAvatarText}>
                        {selectedDoctor.full_name
                          .replace('Dr. ', '')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.modalDocFullName} numberOfLines={1}>
                          {selectedDoctor.full_name}
                        </Text>
                        {selectedDoctor.is_verified_doctor && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                            <Text style={styles.verifiedBadgeText}>Verified MD</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.modalDocSpecialty}>
                        {selectedDoctor.specialty || 'General Practitioner'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedDoctor(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close doctor information"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ maxHeight: 420, marginVertical: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Practice Location & Address */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>CLINICAL PRACTICE & ADDRESS</Text>
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconCircle}>
                          <Ionicons name="business" size={18} color={Theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailTitle}>Practice Affiliation</Text>
                          <Text style={styles.detailValue}>
                            {selectedDoctor.clinic_affiliation || 'MedSync Verified Practice'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.innerDivider} />

                      <View style={styles.detailRow}>
                        <View style={styles.detailIconCircle}>
                          <Ionicons name="location" size={18} color={Theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailTitle}>Shared Practice Address</Text>
                          <Text style={styles.detailValue}>
                            {selectedDoctor.clinic_affiliation || 'Clinical Consultation Facility'}
                          </Text>
                          <Text style={styles.detailSubtext}>
                            Official healthcare center location shared for clinical care.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Contact Information */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>CONTACT INFORMATION</Text>
                    <View style={styles.detailCard}>
                      {/* Email */}
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconCircle}>
                          <Ionicons name="mail" size={18} color={Theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailTitle}>Clinical Email</Text>
                          <Text style={styles.detailValue}>
                            {selectedDoctor.email || 'Contact through MedSync Consultation'}
                          </Text>
                        </View>
                        {selectedDoctor.email && (
                          <TouchableOpacity
                            style={styles.contactActionBtn}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              Linking.openURL(`mailto:${selectedDoctor.email}`);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Email ${selectedDoctor.full_name}`}
                          >
                            <Ionicons name="send" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.contactActionBtnText}>Email</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.innerDivider} />

                      {/* Phone */}
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconCircle}>
                          <Ionicons name="call" size={18} color={Theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailTitle}>Clinic Phone</Text>
                          {selectedDoctor.phone ? (
                            <Text style={styles.detailValue}>{selectedDoctor.phone}</Text>
                          ) : (
                            <Text style={styles.detailPlaceholder}>
                              Direct phone line will be added once configured by physician.
                            </Text>
                          )}
                        </View>
                        {selectedDoctor.phone && (
                          <TouchableOpacity
                            style={styles.contactActionBtn}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              Linking.openURL(`tel:${selectedDoctor.phone}`);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Call ${selectedDoctor.full_name}`}
                          >
                            <Ionicons name="call" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.contactActionBtnText}>Call</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Credentials & Authenticity */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionLabel}>CREDENTIALS & OVERSIGHT</Text>
                    <View style={styles.detailCard}>
                      <View style={styles.credentialRow}>
                        <Text style={styles.credentialKey}>Medical Council</Text>
                        <Text style={styles.credentialVal}>
                          {selectedDoctor.medical_council || 'State Medical Council / NMC'}
                        </Text>
                      </View>

                      {selectedDoctor.medical_license_number && (
                        <View style={styles.credentialRow}>
                          <Text style={styles.credentialKey}>Registration No.</Text>
                          <Text style={styles.credentialVal}>
                            {selectedDoctor.medical_license_number}
                          </Text>
                        </View>
                      )}

                      {selectedDoctor.years_of_experience && (
                        <View style={styles.credentialRow}>
                          <Text style={styles.credentialKey}>Clinical Experience</Text>
                          <Text style={styles.credentialVal}>
                            {selectedDoctor.years_of_experience} years
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Privacy & Reciprocal Consent Notice */}
                  <View style={styles.privacyNoticeBox}>
                    <Ionicons name="shield-checkmark" size={18} color="#0D9488" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.privacyNoticeTitle}>Confidential Healthcare Channel</Text>
                      <Text style={styles.privacyNoticeText}>
                        Only official practice details and verified contact channels are shared under reciprocal DPDP consent. Personal home addresses, private mobile numbers, and internal credentials remain strictly protected.
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Footer Actions */}
                <View style={styles.modalFooterRow}>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() => {
                      const doc = selectedDoctor;
                      setSelectedDoctor(null);
                      handleUnlinkDoctor(doc);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Disconnect doctor"
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                    <Text style={styles.modalSecondaryBtnText}>Disconnect</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalDoneBtn}
                    onPress={() => setSelectedDoctor(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Done"
                  >
                    <Text style={styles.modalDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  cardChevronBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
    ...Theme.shadows.cardElevated,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderDocRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  modalDocAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0D9488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDocAvatarText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  modalDocFullName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: '#0F172A',
  },
  modalDocSpecialty: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: '#0D9488',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailSection: {
    marginBottom: 14,
  },
  detailSectionLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  detailTitle: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#64748B',
  },
  detailValue: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#0F172A',
    marginTop: 1,
  },
  detailSubtext: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  detailPlaceholder: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 10,
  },
  contactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'center',
  },
  contactActionBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  credentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  credentialKey: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#64748B',
  },
  credentialVal: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#0F172A',
  },
  privacyNoticeBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  privacyNoticeTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#0F766E',
    marginBottom: 2,
  },
  privacyNoticeText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#115E59',
    lineHeight: 15,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalSecondaryBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#DC2626',
  },
  modalDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
  },
  modalDoneBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
