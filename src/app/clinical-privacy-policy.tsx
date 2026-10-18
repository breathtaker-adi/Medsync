// src/app/clinical-privacy-policy.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { ScreenHeader } from '../components/ScreenHeader';
import { Theme } from '../theme';

export default function ClinicalPrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Clinical Privacy & Consent"
        subtitle="Physician guidelines, DPDP Act 2023 & NMC regulations"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/doctor-settings');
          }
        }}
        fallbackRoute="/doctor-settings"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoRow}>
          <MedSyncLogo size={36} variant="horizontal" />
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DPDP Act 2023 Compliant</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: '#E0F2FE' }]}>
            <Text style={[styles.badgeText, { color: '#0369A1' }]}>NMC Telemedicine Guidelines</Text>
          </View>
        </View>

        <Text style={styles.lastUpdated}>Effective Date: October 2026 • Clinical Version 2.4</Text>

        {/* Section 1 */}
        <Text style={styles.sectionTitle}>1. Clinical Fiduciary Commitment</Text>
        <Text style={styles.paragraph}>
          Under India’s Digital Personal Data Protection (DPDP) Act 2023 and the National Medical Commission (NMC) Telemedicine Practice Guidelines, MedSync operates strictly as a Secure Data Processor on behalf of registered medical practitioners (Data Fiduciaries).
        </Text>
        <Text style={styles.paragraph}>
          All health data, prescription slips, dose logs, and clinician verification notes are strictly isolated with AES-256 encryption at rest and TLS 1.3 in transit.
        </Text>

        {/* Section 2 */}
        <Text style={styles.sectionTitle}>2. AI Prescription OCR & Verification Protocol</Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.bold}>AI as Clinical Decision Support (CDS):</Text> MedSync AI Vision OCR parses handwritten or printed prescription images to suggest medication names, dosages, frequencies, and durations.
        </Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.bold}>Mandatory Physician Sign-Off:</Text> AI extraction output is never directly administered to patient schedules without human clinician review. A verified medical doctor must explicitly confirm or adjust the schedule before dosing alarms activate.
        </Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.bold}>Zero Model Training Retention:</Text> Prescription images sent to the vision inference pipeline are stateless and discarded immediately after OCR tokenization. Patient slips are never used to train or refine commercial AI models.
        </Text>

        {/* Section 3 */}
        <Text style={styles.sectionTitle}>3. Physician Authentication & Cryptographic Audit Trail</Text>
        <Text style={styles.paragraph}>
          Every prescription approval, adjustment, or rejection executed from your doctor account is stamped with a non-repudiable audit record containing:
        </Text>
        <Text style={styles.bullet}>• Verified Physician UID and Medical Registration Number.</Text>
        <Text style={styles.bullet}>• UTC Timestamp conforming to ISO 8601 clinical standards.</Text>
        <Text style={styles.bullet}>• Diff log of any edited dosage, duration, or timing parameters.</Text>
        <Text style={styles.bullet}>• Optional physician clinical notes and dietary instructions.</Text>

        {/* Section 4 */}
        <Text style={styles.sectionTitle}>4. Caregiver Surveillance & Patient Linking</Text>
        <Text style={styles.paragraph}>
          Physicians and caregivers may only access a patient's daily adherence chart after reciprocal authorization through an 8-character cryptographic pairing code (valid for 15 minutes). Patients retain the statutory right under DPDP Act 2023 to revoke practitioner access at any time.
        </Text>

        {/* Section 5 */}
        <Text style={styles.sectionTitle}>5. Clinical Emergency Disclaimer</Text>
        <Text style={styles.paragraph}>
          MedSync is an adherence synchronization companion and telehealth surveillance tool. It is not an emergency response dispatch service. For acute adverse drug reactions or life-threatening symptoms, patients must be directed to local emergency medical facilities.
        </Text>

        {/* Section 6 */}
        <Text style={styles.sectionTitle}>6. Grievance Officer & Regulatory Inquiries</Text>
        <Text style={styles.paragraph}>
          For institutional compliance inquiries, data protection impact assessments, or clinical audit reports, contact our Chief Compliance Officer:
        </Text>
        <Text style={styles.contactEmail}>clinical-privacy@medsync.health</Text>

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/doctor-settings');
            }
          }}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.closeButtonText}>Acknowledge Clinical Policy</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  logoRow: {
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: '#E6F4F4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#00595C',
  },
  lastUpdated: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginTop: 18,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: 10,
  },
  bullet: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
    marginLeft: 12,
    marginBottom: 6,
  },
  bold: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onSurface,
  },
  contactEmail: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: Theme.colors.primary,
    marginTop: 4,
    marginBottom: 14,
  },
  closeButton: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    ...Theme.shadows.button,
  },
  closeButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15.5,
    color: '#FFFFFF',
  },
});
