// src/app/privacy-policy.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { ScreenHeader } from '../components/ScreenHeader';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Privacy Policy"
        subtitle="Digital Personal Data Protection (DPDP) Act 2023"
        fallbackRoute="/settings"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <MedSyncLogo size={40} variant="horizontal" style={{ marginBottom: 16 }} />
        <Text style={styles.badge}>Digital Personal Data Protection (DPDP) Act 2023</Text>
        <Text style={styles.lastUpdated}>Effective Date: October 2026</Text>

        <Text style={styles.sectionTitle}>1. Purpose & Core Commitment</Text>
        <Text style={styles.paragraph}>
          MedSync is dedicated to protecting your sensitive medical data. We process health information solely to facilitate medication adherence, schedule synchronization, and doctor-prescribed review workflows.
        </Text>

        <Text style={styles.sectionTitle}>2. Prescription Images & AI OCR Analysis</Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.bold}>Private Storage Isolation:</Text> Prescription scans uploaded to MedSync are stored in restricted, private cloud buckets accessible exclusively by your authenticated account and linked medical caregivers.
        </Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.bold}>Stateless AI Vision Processing:</Text> When you choose to extract medication information with our AI Prescription Scanner, images are transmitted over TLS-encrypted channels to extract dosage and schedule metadata. The AI processing does not retain your image for training purposes.
        </Text>

        <Text style={styles.sectionTitle}>3. Doctor & Caregiver Access Controls</Text>
        <Text style={styles.paragraph}>
          Doctors and caregivers cannot view your profile or medication logs without your explicit authorization. Pairing is accomplished through short-lived (15-minute) one-time cryptographic pairing codes. Only verified doctors have permissions to approve or modify prescribed clinical schedules.
        </Text>

        <Text style={styles.sectionTitle}>4. Client-Side Encryption & Secure Token Storage</Text>
        <Text style={styles.paragraph}>
          Your authentication credentials and access tokens are secured using hardware-backed cryptographic keystores (`expo-secure-store`). System backups are disabled (`allowBackup: false`) to safeguard against unauthorized offline data extraction.
        </Text>

        <Text style={styles.sectionTitle}>5. Your Rights Under DPDP Act</Text>
        <Text style={styles.paragraph}>
          Under applicable data protection laws, you possess the full right to:
        </Text>
        <Text style={styles.bullet}>• Review all active medications, schedules, and past adherence logs.</Text>
        <Text style={styles.bullet}>• Revoke doctor or caregiver links at any time from your settings.</Text>
        <Text style={styles.bullet}>• Export a 30-day medical PDF report for external clinician consultation.</Text>
        <Text style={styles.bullet}>• Permanently delete your account and all associated health records instantly via Settings &gt; Delete Account &amp; Data.</Text>

        <Text style={styles.sectionTitle}>6. Grievance & Inquiries</Text>
        <Text style={styles.paragraph}>
          For privacy concerns, data inquiries, or grievance redressal, contact our Data Protection Officer at <Text style={styles.link}>privacy@medsync.health</Text>.
        </Text>

        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>I Understand</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.outlineVariant,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  badge: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  lastUpdated: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: Theme.colors.onSurface,
    marginTop: 18,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14.5,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: 10,
  },
  bullet: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 22,
    marginLeft: 12,
    marginBottom: 6,
  },
  bold: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.onSurface,
  },
  link: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.primary,
  },
  closeButton: {
    backgroundColor: Theme.colors.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36,
  },
  closeButtonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
});
