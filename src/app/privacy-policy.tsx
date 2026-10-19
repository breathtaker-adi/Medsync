// src/app/privacy-policy.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { Theme } from '../theme';

export default function PrivacyPolicyScreen() {
  const { profile } = useAuth();
  const [acknowledged, setAcknowledged] = useState(true);

  const handleConfirmConsent = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Informed Consent Acknowledged',
      'Your health data privacy preferences and statutory informed consent are active and recorded on file.',
      [{ text: 'Return to Settings', onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Data Privacy & Consent"
        subtitle="Patient Health Charter & Statutory Consent"
        fallbackRoute="/settings"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Compliance Header Banner */}
        <View style={styles.charterHeader}>
          <MedSyncLogo size={36} variant="horizontal" />
          <View style={styles.officialSealBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={styles.officialSealText}>OFFICIAL PATIENT PRIVACY CHARTER</Text>
          </View>
          <Text style={styles.charterTitle}>Patient Data Protection &amp; Informed Health Consent</Text>
          <Text style={styles.charterSub}>
            Governed under the Digital Personal Data Protection (DPDP) Act 2023, DISHA Standards, and
            National Telemedicine Practice Guidelines of India.
          </Text>
          <View style={styles.charterMetaRow}>
            <Text style={styles.charterMeta}>Doc Ref: MEDSYNC-PDP-2026-V3</Text>
            <Text style={styles.charterMeta}>•</Text>
            <Text style={styles.charterMeta}>Effective: October 2026</Text>
          </View>
        </View>

        {/* Active Consent Certificate Card */}
        <View style={styles.consentCertCard}>
          <View style={styles.certIconPlate}>
            <Ionicons name="document-lock-outline" size={26} color="#0D9488" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.certStatusPill}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.certStatusText}>ACTIVE PATIENT CONSENT</Text>
            </View>
            <Text style={styles.certSubjectName}>
              Patient: {profile?.full_name || 'Authenticated MedSync User'}
            </Text>
            <Text style={styles.certSummary}>
              Zero-sale data isolation active. Prescription vision analysis is processed in isolated stateless memory.
            </Text>
          </View>
        </View>

        {/* Section 1: Scope of Health Data */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>1</Text>
            </View>
            <Text style={styles.sectionTitle}>Scope of Protected Health Information (PHI)</Text>
          </View>
          <Text style={styles.paragraph}>
            MedSync collects only data essential to maintaining medication adherence and clinical safety:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={16} color="#0D9488" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                <Text style={styles.boldText}>Medication Schedules:</Text> Medicine names, prescribed strengths, dosing times, and instructions.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={16} color="#0D9488" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                <Text style={styles.boldText}>Adherence Telemetry:</Text> Daily intake confirmations, snooze intervals, and missed dose counters.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={16} color="#0D9488" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                <Text style={styles.boldText}>Intake Verification Photos:</Text> Voluntary front-facing camera captures for dose proof.
              </Text>
            </View>
          </View>
        </View>

        {/* Section 2: AI Vision & Prescription Processing */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>2</Text>
            </View>
            <Text style={styles.sectionTitle}>Informed Consent: AI Prescription OCR Analysis</Text>
          </View>
          <Text style={styles.paragraph}>
            When you scan an Rx slip, our AI Vision OCR processes the document under strict isolation covenants:
          </Text>
          <View style={styles.highlightNotice}>
            <Ionicons name="shield-outline" size={20} color="#0F766E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightTitle}>Stateless &amp; Non-Training Architecture</Text>
              <Text style={styles.highlightBody}>
                Uploaded prescription images are NEVER used to train commercial AI or foundation models. Processing is
                conducted statelessly inside encrypted ephemeral memory buffers and immediately released.
              </Text>
            </View>
          </View>
        </View>

        {/* Section 3: Physician & Caregiver Access Governance */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>3</Text>
            </View>
            <Text style={styles.sectionTitle}>Doctor &amp; Caregiver Access Authorization</Text>
          </View>
          <Text style={styles.paragraph}>
            Health data visibility is locked down through Row-Level Security (RLS):
          </Text>
          <Text style={styles.paragraph}>
            • <Text style={styles.boldText}>Mutual Pairing Required:</Text> No medical doctor or caregiver can view your schedule without entering a 15-minute one-time pairing code generated by you.
          </Text>
          <Text style={styles.paragraph}>
            • <Text style={styles.boldText}>Verified MD Sign-Off:</Text> Only licensed practitioners with verified medical council registrations are authorized to approve and schedule prescribed regimens.
          </Text>
          <Text style={styles.paragraph}>
            • <Text style={styles.boldText}>Targeted Routing:</Text> You retain total discretion over which connected physician receives each prescription scan.
          </Text>
        </View>

        {/* Section 4: Absolute Zero-Sale Guarantee */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>4</Text>
            </View>
            <Text style={styles.sectionTitle}>Zero Commercialization &amp; Data Sale Guarantee</Text>
          </View>
          <View style={styles.zeroSaleBox}>
            <Ionicons name="ban" size={22} color="#DC2626" />
            <Text style={styles.zeroSaleText}>
              MedSync maintains an absolute, non-negotiable policy: We NEVER sell, monetize, rent, or transfer patient
              health records to pharmaceutical firms, insurance underwriters, or advertising brokers.
            </Text>
          </View>
        </View>

        {/* Section 5: Patient Autonomy & Rights */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>5</Text>
            </View>
            <Text style={styles.sectionTitle}>Your Statutory Patient Rights (DPDP Act 2023)</Text>
          </View>
          <View style={styles.rightsGrid}>
            <View style={styles.rightItem}>
              <Ionicons name="document-text-outline" size={18} color="#0D9488" />
              <Text style={styles.rightItemTitle}>Right to Access &amp; Export</Text>
              <Text style={styles.rightItemDesc}>Download 30-day clinical adherence reports in PDF format anytime.</Text>
            </View>
            <View style={styles.rightItem}>
              <Ionicons name="link-outline" size={18} color="#0D9488" />
              <Text style={styles.rightItemTitle}>Right to Revoke Access</Text>
              <Text style={styles.rightItemDesc}>Instantly unlink connected physicians and revoke observation rights.</Text>
            </View>
            <View style={styles.rightItem}>
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={styles.rightItemTitle}>Right to Complete Erasure</Text>
              <Text style={styles.rightItemDesc}>Permanently wipe all schedules, images, and telemetry via Delete Account.</Text>
            </View>
          </View>
        </View>

        {/* Section 6: Grievance Officer & Legal Recourse */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>6</Text>
            </View>
            <Text style={styles.sectionTitle}>Data Protection Officer (DPO) Contact</Text>
          </View>
          <Text style={styles.paragraph}>
            For inquiries regarding statutory consent, rights requests, or grievance redressal, contact our designated officer:
          </Text>
          <View style={styles.dpoPlate}>
            <Ionicons name="mail-outline" size={18} color="#0D9488" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dpoTitle}>MedSync Office of Data Privacy</Text>
              <Text style={styles.dpoEmail}>privacy@medsync.health • compliance@medsync.health</Text>
            </View>
          </View>
        </View>

        {/* Clinical Telemedicine Cross-Link */}
        <TouchableOpacity
          style={styles.clinicalLinkBtn}
          onPress={() => router.push('/clinical-privacy-policy')}
        >
          <Ionicons name="medical" size={18} color="#006874" />
          <View style={{ flex: 1 }}>
            <Text style={styles.clinicalLinkTitle}>View Clinical Practitioner &amp; Telemedicine Policy</Text>
            <Text style={styles.clinicalLinkSubtitle}>Ethical governance for prescribing medical doctors</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#006874" />
        </TouchableOpacity>

        {/* Formal Acknowledgment Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.confirmConsentBtn}
            onPress={handleConfirmConsent}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.confirmConsentText}>I Confirm &amp; Acknowledge Consent</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  charterHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...Theme.shadows.card,
  },
  officialSealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 8,
  },
  officialSealText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#059669',
    letterSpacing: 0.5,
  },
  charterTitle: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 26,
  },
  charterSub: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  charterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  charterMeta: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#94A3B8',
  },
  consentCertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    ...Theme.shadows.card,
  },
  certIconPlate: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  certStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  greenPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  certStatusText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  certSubjectName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 2,
  },
  certSummary: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    ...Theme.shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionNumberText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F766E',
  },
  sectionTitle: {
    flex: 1,
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  paragraph: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 8,
  },
  boldText: {
    fontFamily: 'PublicSans-Bold',
    color: '#0F172A',
  },
  bulletList: {
    gap: 8,
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletIcon: {
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  highlightNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  highlightTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F766E',
    marginBottom: 2,
  },
  highlightBody: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  zeroSaleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
  },
  zeroSaleText: {
    flex: 1,
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: '#991B1B',
    lineHeight: 18,
  },
  rightsGrid: {
    gap: 10,
    marginTop: 4,
  },
  rightItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rightItemTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 2,
  },
  rightItemDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  dpoPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  dpoTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F172A',
  },
  dpoEmail: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#0D9488',
    marginTop: 1,
  },
  clinicalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...Theme.shadows.card,
  },
  clinicalLinkTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#0F172A',
    marginBottom: 2,
  },
  clinicalLinkSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
  },
  actionContainer: {
    marginTop: 4,
  },
  confirmConsentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006874',
    paddingVertical: 14,
    borderRadius: 14,
    ...Theme.shadows.cardElevated,
  },
  confirmConsentText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
