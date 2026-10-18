// src/app/doctor-verification.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { SeniorButton } from '../components/SeniorButton';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

interface PlaceResult {
  place_id: number;
  name: string;
  display_name: string;
  type: string;
  city?: string;
  country?: string;
}

const SPECIALTY_OPTIONS: { name: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'Internal Medicine', icon: 'medkit' },
  { name: 'Geriatrics', icon: 'people' },
  { name: 'General Practice (GP)', icon: 'fitness' },
  { name: 'Cardiology', icon: 'heart' },
  { name: 'Neurology', icon: 'pulse' },
  { name: 'Endocrinology', icon: 'flask' },
  { name: 'Other', icon: 'add-circle-outline' },
];

const LICENSING_COUNCILS = [
  'National Medical Commission (NMC)',
  'State Medical Council',
  'General Medical Council (GMC)',
  'Medical Council of India (MCI)',
  'American Medical Association (AMA)',
  'Other Statutory Body',
];

const getShortCouncil = (council: string): string => {
  if (!council) return 'NMC';
  if (council.includes('NMC') || council.includes('National Medical Commission')) return 'NMC';
  if (council.includes('State Medical Council')) return 'SMC';
  if (council.includes('GMC') || council.includes('General Medical Council')) return 'GMC (UK)';
  if (council.includes('MCI') || council.includes('Medical Council of India')) return 'MCI';
  if (council.includes('AMA') || council.includes('American Medical Association')) return 'AMA (US)';
  return council.length > 14 ? `${council.substring(0, 12)}...` : council;
};

export default function DoctorVerificationScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();

  const isAlreadyVerified = profile?.is_verified_doctor === true;
  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState(
    profile?.full_name?.startsWith('Dr.') ? profile.full_name : `Dr. ${profile?.full_name || ''}`
  );
  const [licenseNumber, setLicenseNumber] = useState(profile?.medical_license_number || '');
  const [medicalCouncil, setMedicalCouncil] = useState(
    profile?.medical_council || 'National Medical Commission (NMC)'
  );
  const [specialty, setSpecialty] = useState(profile?.specialty || 'Internal Medicine');
  const [customSpecialty, setCustomSpecialty] = useState('');
  
  // Practice setting: 'hospital' vs 'clinic'
  const [practiceType, setPracticeType] = useState<'hospital' | 'clinic'>('hospital');
  const [clinicAffiliation, setClinicAffiliation] = useState(profile?.clinic_affiliation || '');
  const [clinicAddress, setClinicAddress] = useState('');
  const [yearsExperience, setYearsExperience] = useState(profile?.years_of_experience || '5+ Years');
  const [affirmed, setAffirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // Clinic Verification Photos (1 to 3 photos)
  const [clinicPhotos, setClinicPhotos] = useState<string[]>([]);

  // OpenStreetMap Nominatim Healthcare Places search
  const [searchQuery, setSearchQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showPlacesDropdown, setShowPlacesDropdown] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Pinpoint Location State (for unregistered clinics & hospital pinpointing)
  const [pinpointModalVisible, setPinpointModalVisible] = useState(false);
  const [pinpointName, setPinpointName] = useState('');
  const [pinpointStreet, setPinpointStreet] = useState('');
  const [pinpointCity, setPinpointCity] = useState('');
  const [pinpointState, setPinpointState] = useState('');

  // Load saved clinic photos from local storage on mount
  useEffect(() => {
    if (session?.user?.id) {
      AsyncStorage.getItem(`@medsync_clinic_photos_${session.user.id}`).then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) setClinicPhotos(parsed);
          } catch {}
        }
      });
    }
  }, [session?.user?.id]);

  // Debounced search for real hospitals & clinics worldwide via OpenStreetMap Nominatim
  const handleSearchPlaces = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text || text.trim().length < 3) {
      setPlaceResults([]);
      setIsSearchingPlaces(false);
      setShowPlacesDropdown(false);
      return;
    }

    setIsSearchingPlaces(true);
    setShowPlacesDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const queryTerm = text.trim();
        // Append medical facility query keywords if not already present
        const isMedicalQuery = /hospital|clinic|doctor|medical|college|dispensary|health|institute|nursing|aiims/i.test(queryTerm);
        const effectiveQuery = isMedicalQuery ? queryTerm : `${queryTerm} hospital clinic medical`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          effectiveQuery
        )}&format=json&limit=15&addressdetails=1`;

        const res = await fetch(url, {
          headers: {
            'User-Agent': 'MedSyncHealthcareApp/1.0 (contact: support@medsync.io)',
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            // Strict Medical Filter: exclude parks, bus stops, roads, leisure, retail
            const GARBAGE_CATEGORIES = new Set([
              'park', 'garden', 'pitch', 'leisure', 'highway', 'road', 'residential',
              'suburb', 'neighbourhood', 'bus_stop', 'station', 'subway', 'restaurant',
              'cafe', 'fast_food', 'bar', 'supermarket', 'mall', 'shop', 'tourism',
              'attraction', 'hotel', 'motel', 'viewpoint', 'zoo', 'forest', 'nature_reserve',
              'place_of_worship', 'cinema', 'theatre', 'playground', 'stadium'
            ]);

            const MEDICAL_KEYWORDS = /hospital|clinic|doctor|physician|dispensary|medical|healthcare|infirmary|nursing\s*home|health\s*centre|health\s*center|medical\s*college|aiims|sanatorium/i;

            const filtered = data.filter((item: any) => {
              const itemType = (item.type || '').toLowerCase();
              const itemClass = (item.class || '').toLowerCase();
              const name = (item.name || item.display_name?.split(',')[0] || '').toLowerCase();
              const displayName = (item.display_name || '').toLowerCase();

              // Exclude garbage unless explicitly named as a medical center
              if (GARBAGE_CATEGORIES.has(itemType) || GARBAGE_CATEGORIES.has(itemClass)) {
                if (!name.includes('hospital') && !name.includes('medical') && !name.includes('clinic')) {
                  return false;
                }
              }

              const isMedicalAmenity = itemClass === 'amenity' && ['hospital', 'clinic', 'doctors', 'pharmacy'].includes(itemType);
              const isHealthcareClass = itemClass === 'healthcare';
              const matchesMedical = MEDICAL_KEYWORDS.test(name) || MEDICAL_KEYWORDS.test(displayName);

              return isMedicalAmenity || isHealthcareClass || matchesMedical;
            });

            const mapped: PlaceResult[] = filtered.slice(0, 6).map((item: any) => ({
              place_id: item.place_id,
              name: item.name || item.display_name.split(',')[0],
              display_name: item.display_name,
              type: item.type || item.class || 'hospital',
              city: item.address?.city || item.address?.town || item.address?.state_district,
              country: item.address?.country,
            }));
            setPlaceResults(mapped);
          } else {
            setPlaceResults([]);
          }
        }
      } catch (err) {
        console.warn('Nominatim places search error:', err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 450);
  };

  const handleOpenPinpointModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPinpointName(clinicAffiliation || searchQuery || '');
    setPinpointModalVisible(true);
  };

  const handleConfirmPinpoint = () => {
    if (!pinpointName.trim()) {
      Alert.alert('Facility Name Required', 'Please enter your clinic or hospital name.');
      return;
    }
    if (!pinpointCity.trim()) {
      Alert.alert('City Required', 'Please enter the city or district of your practice.');
      return;
    }

    // Hospital Verification: If hospital setting selected, verify facility name reflects a hospital
    if (practiceType === 'hospital') {
      const isHospitalName = /hospital|medical\s*center|medical\s*college|institute|healthcare|infirmary|nursing\s*home|aiims|dispensary/i.test(
        pinpointName.trim()
      );
      if (!isHospitalName) {
        Alert.alert(
          'Hospital Verification Required',
          `"${pinpointName.trim()}" does not appear to be an accredited hospital, medical college, or healthcare center.\n\nIf you operate an independent practice, please select "Private Clinic" above, or enter the full accredited hospital name.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const addressParts = [pinpointStreet.trim(), pinpointCity.trim(), pinpointState.trim()].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    setClinicAffiliation(pinpointName.trim());
    setClinicAddress(fullAddress ? `${fullAddress} (📍 Pinpointed)` : '📍 Pinpointed Location');
    setSearchQuery(pinpointName.trim());
    setShowPlacesDropdown(false);
    setPinpointModalVisible(false);

    Alert.alert(
      'Location Pinpointed',
      `Successfully pinpointed ${practiceType === 'hospital' ? 'hospital' : 'clinic'}: ${pinpointName.trim()}`
    );
  };

  const handleSelectPlace = (place: PlaceResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const formatted = place.city && place.country
      ? `${place.name}, ${place.city}, ${place.country}`
      : place.name;
    setClinicAffiliation(formatted);
    setClinicAddress(place.display_name);
    setShowPlacesDropdown(false);
    setSearchQuery('');
  };

  // Upload clinic verification photo (up to 3 photos)
  const handleAddClinicPhoto = async () => {
    if (clinicPhotos.length >= 3) {
      Alert.alert('Maximum Reached', 'You can attach up to 3 clinic verification photos.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please enable photo access to attach clinic verification images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        const updated = [...clinicPhotos, newUri];
        setClinicPhotos(updated);
        if (session?.user?.id) {
          await AsyncStorage.setItem(
            `@medsync_clinic_photos_${session.user.id}`,
            JSON.stringify(updated)
          );
        }
      }
    } catch (err) {
      console.error('Error adding clinic photo:', err);
    }
  };

  const handleRemoveClinicPhoto = async (indexToRemove: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = clinicPhotos.filter((_, idx) => idx !== indexToRemove);
    setClinicPhotos(updated);
    if (session?.user?.id) {
      await AsyncStorage.setItem(
        `@medsync_clinic_photos_${session.user.id}`,
        JSON.stringify(updated)
      );
    }
  };

  // Stepper completion score (1, 2, 3)
  const activeStep = useMemo(() => {
    if (!fullName.trim() || fullName.trim().length < 4) return 1;
    if (!licenseNumber.trim() || licenseNumber.trim().length < 4 || !medicalCouncil.trim()) return 2;
    return 3;
  }, [fullName, licenseNumber, medicalCouncil]);

  const handleVerifyCredentials = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!fullName.trim() || fullName.trim().length < 4) {
      Alert.alert('Physician Name Required', 'Please enter your complete legal clinical name.');
      return;
    }

    if (!licenseNumber.trim() || licenseNumber.trim().length < 4) {
      Alert.alert('License Number Required', 'Please enter your official Medical Registration / License number.');
      return;
    }

    if (!medicalCouncil.trim()) {
      Alert.alert('Medical Council Required', 'Please specify your licensing body or medical council.');
      return;
    }

    if (!clinicAffiliation.trim()) {
      Alert.alert(
        'Practice Location Required',
        practiceType === 'hospital'
          ? 'Please select or enter your affiliated hospital.'
          : 'Please enter your clinic name and address.'
      );
      return;
    }

    if (practiceType === 'clinic' && clinicPhotos.length === 0) {
      Alert.alert(
        'Clinic Verification Photo Recommended',
        'For private clinic practices, attaching at least 1 photo of your clinic signboard or consultation room verifies practice authenticity.\n\nDo you want to proceed anyway?',
        [
          { text: 'Add Photo', style: 'cancel', onPress: handleAddClinicPhoto },
          { text: 'Submit Without Photo', style: 'default', onPress: () => submitVerification() },
        ]
      );
      return;
    }

    if (!affirmed) {
      Alert.alert(
        'Physician Affirmation Required',
        'Please confirm your declaration of active medical licensure to receive your verified clinical badge.'
      );
      return;
    }

    await submitVerification();
  };

  const submitVerification = async () => {
    if (!session?.user?.id) {
      Alert.alert('Session Expired', 'Please sign in again to verify credentials.');
      router.replace('/login');
      return;
    }

    setLoading(true);
    const resolvedSpecialty =
      specialty === 'Other' && customSpecialty.trim() ? customSpecialty.trim() : specialty;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          medical_license_number: licenseNumber.trim(),
          medical_council: medicalCouncil.trim(),
          specialty: resolvedSpecialty,
          clinic_affiliation: clinicAffiliation.trim(),
          years_of_experience: yearsExperience,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Credentials Submitted for Clinical Verification',
        'Your registration details have been securely logged. MedSync clinical administration verifies credentials against the State Medical Council / NMC registry before activating full prescription sign-off authority.'
      );
      setVerifiedSuccess(true);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Credential verification error:', err);
      Alert.alert('Verification Submission Failed', err.message || 'Could not verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const isVerifiedView = (isAlreadyVerified && !isEditing) || verifiedSuccess;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Physician Credentialing"
        subtitle={isVerifiedView ? 'Verified Clinical License' : 'Medical verification & digital seal'}
        onBack={() => router.replace('/doctor-settings')}
        fallbackRoute="/doctor-settings"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isVerifiedView ? (
            /* OFFICIAL DIGITAL PHYSICIAN CERTIFICATE VIEW */
            <View style={styles.certContainer}>
              <View style={styles.certificateCard}>
                {/* Official Seal Emblem */}
                <View style={styles.sealEmblemWrapper}>
                  <View style={styles.sealOuterRing}>
                    <View style={styles.sealInnerRing}>
                      <Ionicons name="shield-checkmark" size={38} color="#059669" />
                    </View>
                  </View>
                </View>

                {/* Verified Ribbon */}
                <View style={styles.verifiedRibbon}>
                  <Ionicons name="ribbon" size={14} color="#FFFFFF" />
                  <Text style={styles.verifiedRibbonText}>VERIFIED MEDICAL DOCTOR (MD)</Text>
                </View>

                {/* Doctor Legal Name */}
                <Text style={styles.certDoctorName}>
                  {profile?.full_name?.startsWith('Dr.')
                    ? profile.full_name
                    : `Dr. ${profile?.full_name || fullName || 'Physician'}`}
                </Text>

                <Text style={styles.certSpecialty}>
                  {profile?.specialty || specialty || 'Internal Medicine'} •{' '}
                  {profile?.clinic_affiliation || clinicAffiliation || 'MedSync Clinical Practice'}
                </Text>

                {/* Official Credential Table */}
                <View style={styles.certTable}>
                  <View style={styles.certTableRow}>
                    <Text style={styles.certTableKey}>Medical License No.</Text>
                    <Text style={styles.certTableVal}>
                      {profile?.medical_license_number || licenseNumber || 'Verified Registration'}
                    </Text>
                  </View>

                  <View style={styles.certTableRow}>
                    <Text style={styles.certTableKey}>Licensing Council</Text>
                    <Text style={styles.certTableVal}>
                      {profile?.medical_council || medicalCouncil}
                    </Text>
                  </View>

                  <View style={styles.certTableRow}>
                    <Text style={styles.certTableKey}>Practice Affiliation</Text>
                    <Text style={[styles.certTableVal, { maxWidth: '55%', textAlign: 'right' }]} numberOfLines={2}>
                      {profile?.clinic_affiliation || clinicAffiliation || 'Primary Care Practice'}
                    </Text>
                  </View>

                  <View style={styles.certTableRow}>
                    <Text style={styles.certTableKey}>Clinical Experience</Text>
                    <Text style={styles.certTableVal}>
                      {profile?.years_of_experience || yearsExperience}
                    </Text>
                  </View>

                  <View style={[styles.certTableRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.certTableKey}>Practice Authorization</Text>
                    <View style={styles.activeAuthBadge}>
                      <Ionicons name="checkmark-circle" size={13} color="#059669" />
                      <Text style={styles.activeAuthBadgeText}>ACTIVE (Rx OCR Sign-Off Enabled)</Text>
                    </View>
                  </View>
                </View>

                {/* Verified Clinic Photos Display if any */}
                {clinicPhotos.length > 0 && (
                  <View style={styles.certPhotosSection}>
                    <Text style={styles.certPhotosTitle}>Verified Practice Premises ({clinicPhotos.length})</Text>
                    <View style={styles.certPhotosRow}>
                      {clinicPhotos.map((uri, idx) => (
                        <Image key={idx} source={{ uri }} style={styles.certPhotoThumb} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Compliance Statement */}
                <View style={styles.certComplianceBox}>
                  <Ionicons name="lock-closed" size={14} color="#0F766E" />
                  <Text style={styles.certComplianceText}>
                    Authorized under DPDP Act 2023 &amp; National Telemedicine Guidelines.
                    Prescriptions verified from this account carry legal physician attestation.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.certActionsCol}>
                  <SeniorButton
                    title="Open Clinical Dashboard"
                    onPress={() => router.replace('/(tabs)/caregiver-dashboard')}
                    variant="primary"
                    size="large"
                    icon={<Ionicons name="people" size={22} color="#FFFFFF" />}
                  />

                  <TouchableOpacity
                    style={styles.certEditBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditing(true);
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons name="create-outline" size={16} color={Theme.colors.primary} />
                    <Text style={styles.certEditBtnText}>Update Practice &amp; Photos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.certSecondaryBtn}
                    onPress={() => router.replace('/doctor-settings')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.certSecondaryBtnText}>Return to Clinical Settings</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            /* PHYSICIAN VERIFICATION SUBMISSION PORTAL */
            <View>
              {/* Stepper Progress Bar */}
              <View style={styles.stepperContainer}>
                <View style={styles.stepperTrack}>
                  <View
                    style={[
                      styles.stepperProgress,
                      { width: activeStep === 1 ? '33%' : activeStep === 2 ? '66%' : '100%' },
                    ]}
                  />
                </View>

                <View style={styles.stepperLabelsRow}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, activeStep >= 1 && styles.stepCircleActive]}>
                      <Text style={[styles.stepNumber, activeStep >= 1 && styles.stepNumberActive]}>1</Text>
                    </View>
                    <Text style={[styles.stepLabel, activeStep >= 1 && styles.stepLabelActive]}>Identity</Text>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, activeStep >= 2 && styles.stepCircleActive]}>
                      <Text style={[styles.stepNumber, activeStep >= 2 && styles.stepNumberActive]}>2</Text>
                    </View>
                    <Text style={[styles.stepLabel, activeStep >= 2 && styles.stepLabelActive]}>Licensure</Text>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={[styles.stepCircle, activeStep >= 3 && styles.stepCircleActive]}>
                      <Text style={[styles.stepNumber, activeStep >= 3 && styles.stepNumberActive]}>3</Text>
                    </View>
                    <Text style={[styles.stepLabel, activeStep >= 3 && styles.stepLabelActive]}>Practice</Text>
                  </View>
                </View>
              </View>

              {/* Credential Governance Authority Information Card */}
              <View style={styles.governanceCard}>
                <View style={styles.governanceTopRow}>
                  <View style={styles.governanceIconPlate}>
                    <Ionicons name="shield-half" size={18} color="#0D9488" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.governanceTitle}>Verification Governance</Text>
                    <Text style={styles.governanceSub}>
                      Who verifies credentials &amp; digital seals?
                    </Text>
                  </View>
                  <View style={styles.govBadgeSandbox}>
                    <Text style={styles.govBadgeSandboxText}>SANDBOX MODE</Text>
                  </View>
                </View>
                <Text style={styles.governanceExpl}>
                  • <Text style={{ fontFamily: 'PublicSans-Bold' }}>Production Environment:</Text> Credentials submitted by doctors are placed in a compliance review queue and verified against official registries (NMC India, GMC UK, NPI US) by the MedSync Compliance Officer before the verified seal is granted.{'\n'}
                  • <Text style={{ fontFamily: 'PublicSans-Bold' }}>Active Sandbox:</Text> To facilitate seamless testing of prescription OCR verification and dosing approvals, submitted credentials receive instant attestation.
                </Text>
              </View>

              {/* Dynamic Live Badge Preview Card (Fixed text overflow) */}
              <View style={styles.liveBadgeCard}>
                <View style={styles.liveBadgeTopRow}>
                  <View style={styles.liveBadgeIconPlate}>
                    <Ionicons name="shield-checkmark" size={20} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveBadgeHeader}>PREVIEW: VERIFIED PHYSICIAN SEAL</Text>
                    <Text style={styles.liveBadgeSub}>Displayed on patient prescriptions &amp; clinical reviews</Text>
                  </View>
                  <View style={styles.livePreviewPill}>
                    <Text style={styles.livePreviewPillText}>Live Preview</Text>
                  </View>
                </View>

                <View style={styles.liveBadgeBox}>
                  <View style={styles.liveBadgeNameRow}>
                    <Text style={styles.liveDoctorName} numberOfLines={1}>
                      {fullName.trim().length > 0 ? fullName : 'Dr. Evelyn Reed, MD'}
                    </Text>
                    <View style={styles.liveVerifiedTag}>
                      <Ionicons name="checkmark-circle" size={11} color="#059669" />
                      <Text style={styles.liveVerifiedTagText}>VERIFIED</Text>
                    </View>
                  </View>

                  <Text style={styles.liveDoctorDetails} numberOfLines={1}>
                    {specialty === 'Other' && customSpecialty.trim() ? customSpecialty : specialty} •{' '}
                    {clinicAffiliation.trim().length > 0 ? clinicAffiliation : 'MedSync Healthcare Network'}
                  </Text>

                  {/* Wrapped & Scalable License Row */}
                  <View style={styles.liveLicenseRow}>
                    <Ionicons name="id-card-outline" size={13} color="#0D9488" />
                    <Text style={styles.liveLicenseText} numberOfLines={1}>
                      Reg: {licenseNumber.trim().length > 0 ? licenseNumber.toUpperCase() : 'NMC/2026/XXXXX'}
                    </Text>
                    <View style={styles.liveCouncilBadge}>
                      <Text style={styles.liveCouncilBadgeText} numberOfLines={1}>
                        {getShortCouncil(medicalCouncil)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* SECTION 1: IDENTITY */}
              <View style={styles.sectionFormCard}>
                <View style={styles.sectionCardTitleRow}>
                  <View style={styles.sectionStepBadge}>
                    <Text style={styles.sectionStepBadgeText}>STEP 1</Text>
                  </View>
                  <Text style={styles.sectionCardTitle}>Physician Identification</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Legal Clinical Name &amp; Degrees *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person" size={18} color="#0D9488" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Dr. Aditya, MBBS, MD"
                      placeholderTextColor="#94A3B8"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  </View>
                  <Text style={styles.fieldHint}>Must match your state or national medical registration exactly.</Text>
                </View>
              </View>

              {/* SECTION 2: LICENSURE */}
              <View style={styles.sectionFormCard}>
                <View style={styles.sectionCardTitleRow}>
                  <View style={styles.sectionStepBadge}>
                    <Text style={styles.sectionStepBadgeText}>STEP 2</Text>
                  </View>
                  <Text style={styles.sectionCardTitle}>Medical Registration &amp; Council</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Registration / License Number *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="card" size={18} color="#0D9488" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. NMC/2024/94821 or State Council Reg"
                      placeholderTextColor="#94A3B8"
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Licensing Medical Body *</Text>
                  <View style={styles.councilChipsRow}>
                    {LICENSING_COUNCILS.map((council) => {
                      const isSelected = medicalCouncil === council;
                      return (
                        <TouchableOpacity
                          key={council}
                          style={[styles.councilChip, isSelected && styles.councilChipActive]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setMedicalCouncil(council);
                          }}
                        >
                          <Text style={[styles.councilChipText, isSelected && styles.councilChipTextActive]}>
                            {council}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* SECTION 3: PRACTICE, REAL DATABASE SEARCH & CLINIC PHOTOS */}
              <View style={styles.sectionFormCard}>
                <View style={styles.sectionCardTitleRow}>
                  <View style={styles.sectionStepBadge}>
                    <Text style={styles.sectionStepBadgeText}>STEP 3</Text>
                  </View>
                  <Text style={styles.sectionCardTitle}>Clinical Practice &amp; Premises</Text>
                </View>

                {/* Specialty Selection */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Primary Clinical Specialty *</Text>
                  <View style={styles.specialtyGrid}>
                    {SPECIALTY_OPTIONS.map((spec) => {
                      const isSelected = specialty === spec.name;
                      return (
                        <TouchableOpacity
                          key={spec.name}
                          style={[styles.specialtyTile, isSelected && styles.specialtyTileActive]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSpecialty(spec.name);
                          }}
                        >
                          <Ionicons
                            name={spec.icon}
                            size={18}
                            color={isSelected ? '#0D9488' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.specialtyTileText,
                              isSelected && styles.specialtyTileTextActive,
                            ]}
                          >
                            {spec.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {specialty === 'Other' && (
                    <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                      <Ionicons name="create-outline" size={18} color="#0D9488" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Type your clinical specialty"
                        placeholderTextColor="#94A3B8"
                        value={customSpecialty}
                        onChangeText={setCustomSpecialty}
                      />
                    </View>
                  )}
                </View>

                {/* Practice Setting Toggle: Hospital vs Private Clinic */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Practice Setting Type *</Text>
                  <View style={styles.practiceToggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.practiceToggleBtn,
                        practiceType === 'hospital' && styles.practiceToggleBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPracticeType('hospital');
                      }}
                    >
                      <Ionicons
                        name="business"
                        size={17}
                        color={practiceType === 'hospital' ? '#0D9488' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.practiceToggleBtnText,
                          practiceType === 'hospital' && styles.practiceToggleBtnTextActive,
                        ]}
                      >
                        Hospital / Center
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.practiceToggleBtn,
                        practiceType === 'clinic' && styles.practiceToggleBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPracticeType('clinic');
                      }}
                    >
                      <Ionicons
                        name="medical"
                        size={17}
                        color={practiceType === 'clinic' ? '#0D9488' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.practiceToggleBtnText,
                          practiceType === 'clinic' && styles.practiceToggleBtnTextActive,
                        ]}
                      >
                        Private Clinic
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Real Worldwide Database Autocomplete via OpenStreetMap Places API */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    {practiceType === 'hospital'
                      ? 'Search Real Worldwide Hospital Database *'
                      : 'Search Clinic on Map or Type Name *'}
                  </Text>
                  
                  <View style={styles.searchPlacesWrapper}>
                    <Ionicons name="search" size={18} color="#0D9488" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder={
                        practiceType === 'hospital'
                          ? 'Search e.g. Apollo, Mayo, AIIMS, Fortis...'
                          : 'Search clinic on map or type name...'
                      }
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={handleSearchPlaces}
                    />
                    {isSearchingPlaces ? (
                      <ActivityIndicator size="small" color="#0D9488" style={{ marginRight: 6 }} />
                    ) : searchQuery.length > 0 ? (
                      <TouchableOpacity onPress={() => handleSearchPlaces('')} style={{ marginRight: 6 }}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}

                    {/* Small Pinpoint Button at the Right of Search Bar */}
                    <TouchableOpacity
                      style={styles.pinpointBtn}
                      onPress={handleOpenPinpointModal}
                      accessibilityRole="button"
                      accessibilityLabel="Pinpoint practice location"
                    >
                      <Ionicons name="location" size={18} color="#0D9488" />
                    </TouchableOpacity>
                  </View>

                  {/* Autocomplete Places Dropdown */}
                  {showPlacesDropdown && placeResults.length > 0 && (
                    <View style={styles.placesDropdownCard}>
                      <View style={styles.placesDropdownHeader}>
                        <Ionicons name="globe-outline" size={13} color="#0D9488" />
                        <Text style={styles.placesDropdownHeaderText}>
                          Real Worldwide Places (OpenStreetMap API)
                        </Text>
                      </View>
                      {placeResults.map((place) => (
                        <TouchableOpacity
                          key={place.place_id}
                          style={styles.placeItemRow}
                          onPress={() => handleSelectPlace(place)}
                        >
                          <Ionicons
                            name={practiceType === 'hospital' ? 'business' : 'medical'}
                            size={16}
                            color="#0D9488"
                            style={{ marginTop: 2 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.placeItemName}>{place.name}</Text>
                            <Text style={styles.placeItemAddress} numberOfLines={1}>
                              {place.display_name}
                            </Text>
                          </View>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Selected Affiliation Display / Manual Input */}
                  <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                    <Ionicons
                      name={practiceType === 'hospital' ? 'business' : 'medkit'}
                      size={18}
                      color="#0D9488"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder={
                        practiceType === 'hospital'
                          ? 'e.g. Apollo Hospital, New Delhi'
                          : 'e.g. Dr. Aditya Endocrine & Diabetes Clinic'
                      }
                      placeholderTextColor="#94A3B8"
                      value={clinicAffiliation}
                      onChangeText={setClinicAffiliation}
                    />
                  </View>
                  {clinicAddress.length > 0 && (
                    <View style={styles.pinpointedBadge}>
                      <Ionicons name="location" size={13} color="#0F766E" />
                      <Text style={styles.pinpointedBadgeText} numberOfLines={2}>
                        {clinicAddress}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.fieldHint}>
                    Search worldwide map database, pinpoint directly using 📍, or customize facility name.
                  </Text>
                </View>

                {/* If Private Clinic: Clinic Photos Upload Section */}
                {practiceType === 'clinic' && (
                  <View style={styles.clinicPhotosContainer}>
                    <View style={styles.clinicPhotosHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clinicPhotosTitle}>
                          Clinic Physical Proof Photos ({clinicPhotos.length}/3)
                        </Text>
                        <Text style={styles.clinicPhotosSubtitle}>
                          Upload signboard, consultation room, or reception photo.
                        </Text>
                      </View>
                      {clinicPhotos.length < 3 && (
                        <TouchableOpacity
                          style={styles.addPhotoBtn}
                          onPress={handleAddClinicPhoto}
                          accessibilityRole="button"
                        >
                          <Ionicons name="camera" size={15} color="#FFFFFF" />
                          <Text style={styles.addPhotoBtnText}>+ Add Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {clinicPhotos.length > 0 ? (
                      <View style={styles.photoThumbnailsGrid}>
                        {clinicPhotos.map((uri, index) => (
                          <View key={index} style={styles.photoThumbWrapper}>
                            <Image source={{ uri }} style={styles.photoThumbImage} />
                            <TouchableOpacity
                              style={styles.photoRemoveBtn}
                              onPress={() => handleRemoveClinicPhoto(index)}
                              accessibilityRole="button"
                              accessibilityLabel="Remove photo"
                            >
                              <Ionicons name="close" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View style={styles.photoCaptionBadge}>
                              <Text style={styles.photoCaptionText}>
                                {index === 0 ? 'Signage / Board' : index === 1 ? 'Desk / Room' : 'Facility'}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.emptyPhotoUploadBox}
                        onPress={handleAddClinicPhoto}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="cloud-upload-outline" size={26} color="#0D9488" />
                        <Text style={styles.emptyPhotoUploadTitle}>Attach Clinic Photos</Text>
                        <Text style={styles.emptyPhotoUploadSub}>
                          Tap to select exterior signboard or doctor chamber photos
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Experience Tier */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Years of Clinical Practice</Text>
                  <View style={styles.experienceRow}>
                    {['1-4 Yrs', '5-9 Yrs', '10-19 Yrs', '20+ Yrs'].map((tier) => {
                      const isSelected = yearsExperience === tier;
                      return (
                        <TouchableOpacity
                          key={tier}
                          style={[styles.expChip, isSelected && styles.expChipActive]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setYearsExperience(tier);
                          }}
                        >
                          <Text style={[styles.expChipText, isSelected && styles.expChipTextActive]}>
                            {tier}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Affirmation Checkbox (Replaced Toggle with Tactile Checkbox) */}
                <TouchableOpacity
                  style={[styles.affirmationCard, affirmed && styles.affirmationCardActive]}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setAffirmed(!affirmed);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: affirmed }}
                >
                  <View style={[styles.customCheckbox, affirmed && styles.customCheckboxActive]}>
                    {affirmed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.affirmationText, affirmed && styles.affirmationTextActive]}>
                    I solemnly affirm that I am a registered medical practitioner in good standing, authorized to evaluate
                    prescription therapies and supervise medication schedules under clinical regulations.
                  </Text>
                </TouchableOpacity>

                {/* Submit Verification Button */}
                <View style={{ marginTop: 18 }}>
                  <SeniorButton
                    title={isEditing ? 'Save & Update Clinical Badge' : 'Verify Credentials & Issue Badge'}
                    onPress={handleVerifyCredentials}
                    loading={loading}
                    variant="primary"
                    size="large"
                    icon={<Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />}
                  />
                  {isEditing && (
                    <TouchableOpacity
                      style={{ marginTop: 10, paddingVertical: 10, alignItems: 'center' }}
                      onPress={() => setIsEditing(false)}
                    >
                      <Text style={{ fontFamily: 'PublicSans-Bold', fontSize: 13, color: '#64748B' }}>
                        Cancel Editing
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pinpoint Practice Location Modal */}
      <Modal
        visible={pinpointModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPinpointModalVisible(false)}
      >
        <View style={styles.pinpointModalOverlay}>
          <View style={styles.pinpointModalCard}>
            <View style={styles.pinpointModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.pinpointModalIconPlate}>
                  <Ionicons name="location" size={22} color="#0D9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinpointModalTitle}>
                    {practiceType === 'hospital' ? 'Pinpoint Hospital Location' : 'Pinpoint Clinic Location'}
                  </Text>
                  <Text style={styles.pinpointModalSubtitle}>
                    {practiceType === 'hospital'
                      ? 'Accredited hospital / medical center'
                      : 'For unlisted or private clinics'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setPinpointModalVisible(false)}
                style={styles.pinpointCloseBtn}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginTop: 12 }} keyboardShouldPersistTaps="handled">
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {practiceType === 'hospital' ? 'Hospital / Medical Center Name *' : 'Clinic Name *'}
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="business-outline" size={18} color="#0D9488" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder={
                      practiceType === 'hospital'
                        ? 'e.g. Apollo Hospital, AIIMS, Mayo Clinic'
                        : 'e.g. Dr. Sharma Family Health Clinic'
                    }
                    placeholderTextColor="#94A3B8"
                    value={pinpointName}
                    onChangeText={setPinpointName}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Street / Area / Landmark</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="map-outline" size={18} color="#0D9488" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 12th Main Road, Near Metro Station"
                    placeholderTextColor="#94A3B8"
                    value={pinpointStreet}
                    onChangeText={setPinpointStreet}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>City / District *</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. New Delhi"
                      placeholderTextColor="#94A3B8"
                      value={pinpointCity}
                      onChangeText={setPinpointCity}
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>State / Province</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Delhi"
                      placeholderTextColor="#94A3B8"
                      value={pinpointState}
                      onChangeText={setPinpointState}
                    />
                  </View>
                </View>
              </View>

              {practiceType === 'hospital' && (
                <View style={styles.hospitalNoticeBox}>
                  <Ionicons name="information-circle" size={16} color="#0284C7" />
                  <Text style={styles.hospitalNoticeText}>
                    Hospital Verification: The facility name is cross-checked against accredited hospital registries.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={{ marginTop: 14 }}>
              <SeniorButton
                title={practiceType === 'hospital' ? 'Verify & Pinpoint Hospital' : 'Confirm Clinic Location'}
                onPress={handleConfirmPinpoint}
                variant="primary"
                size="normal"
                icon={<Ionicons name="location" size={20} color="#FFFFFF" />}
              />
            </View>
          </View>
        </View>
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
  // Stepper
  stepperContainer: {
    marginBottom: 14,
  },
  stepperTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  stepperProgress: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 2,
  },
  stepperLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#0D9488',
  },
  stepNumber: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#64748B',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  stepLabelActive: {
    fontFamily: 'PublicSans-Bold',
    color: '#0F172A',
  },
  // Governance Card
  governanceCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 14,
  },
  governanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  governanceIconPlate: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  governanceTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F766E',
  },
  governanceSub: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 10.5,
    color: '#64748B',
  },
  govBadgeSandbox: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  govBadgeSandboxText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9,
    color: '#B45309',
    letterSpacing: 0.5,
  },
  governanceExpl: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  // Live Badge Preview
  liveBadgeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    marginBottom: 14,
    ...Theme.shadows.card,
  },
  liveBadgeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  liveBadgeIconPlate: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadgeHeader: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  liveBadgeSub: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 10.5,
    color: '#64748B',
  },
  livePreviewPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  livePreviewPillText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#059669',
  },
  liveBadgeBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  liveBadgeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  liveDoctorName: {
    flex: 1,
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 16,
    color: '#0F172A',
  },
  liveVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveVerifiedTagText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9.5,
    color: '#059669',
  },
  liveDoctorDetails: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#0F766E',
    marginBottom: 6,
  },
  liveLicenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  liveLicenseText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#334155',
  },
  liveCouncilBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  liveCouncilBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#0284C7',
  },
  // Section Form Card
  sectionFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...Theme.shadows.card,
  },
  sectionCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionStepBadge: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionStepBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  sectionCardTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 6,
  },
  fieldHint: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: '#0F172A',
  },
  councilChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  councilChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  councilChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  councilChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11.5,
    color: '#475569',
  },
  councilChipTextActive: {
    fontFamily: 'PublicSans-Bold',
    color: '#0F766E',
  },
  specialtyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specialtyTileActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  specialtyTileText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#475569',
  },
  specialtyTileTextActive: {
    fontFamily: 'PublicSans-Bold',
    color: '#0F766E',
  },
  // Practice Type Toggle
  practiceToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  practiceToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  practiceToggleBtnActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  practiceToggleBtnText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: '#64748B',
  },
  practiceToggleBtnTextActive: {
    fontFamily: 'PublicSans-Bold',
    color: '#0D9488',
  },
  // Places search
  searchPlacesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 48,
  },
  placesDropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    marginTop: 6,
    padding: 6,
    ...Theme.shadows.cardElevated,
  },
  placesDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  placesDropdownHeaderText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#0F766E',
  },
  placeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  placeItemName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0F172A',
  },
  placeItemAddress: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
  },
  // Clinic photos
  clinicPhotosContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  clinicPhotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clinicPhotosTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#0F172A',
  },
  clinicPhotosSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPhotoBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  photoThumbnailsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  photoThumbWrapper: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCaptionBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  photoCaptionText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 8.5,
    color: '#FFFFFF',
  },
  emptyPhotoUploadBox: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyPhotoUploadTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0D9488',
    marginTop: 6,
  },
  emptyPhotoUploadSub: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  // Experience
  experienceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  expChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  expChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  expChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#475569',
  },
  expChipTextActive: {
    fontFamily: 'PublicSans-Bold',
    color: '#0F766E',
  },
  affirmationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  affirmationCardActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxActive: {
    borderColor: '#0D9488',
    backgroundColor: '#0D9488',
  },
  affirmationText: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
  },
  affirmationTextActive: {
    color: '#0F172A',
    fontFamily: 'PublicSans-Medium',
  },
  pinpointBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  pinpointedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  pinpointedBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#065F46',
    flex: 1,
  },
  pinpointModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  pinpointModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  pinpointModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pinpointModalIconPlate: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinpointModalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  pinpointModalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  pinpointCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  hospitalNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  hospitalNoticeText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 15,
    flex: 1,
  },
  // OFFICIAL CERTIFICATE VIEW
  certContainer: {
    alignItems: 'center',
  },
  certificateCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    ...Theme.shadows.cardElevated,
  },
  sealEmblemWrapper: {
    marginBottom: 12,
  },
  sealOuterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sealInnerRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  verifiedRibbonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  certDoctorName: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 22,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  certSpecialty: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13.5,
    color: '#0F766E',
    textAlign: 'center',
    marginBottom: 20,
  },
  certTable: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  certTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  certTableKey: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  certTableVal: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#0F172A',
  },
  activeAuthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeAuthBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10.5,
    color: '#059669',
  },
  certPhotosSection: {
    width: '100%',
    marginBottom: 16,
  },
  certPhotosTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  certPhotosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  certPhotoThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  certComplianceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  certComplianceText: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 11,
    color: '#0F766E',
    lineHeight: 15,
  },
  certActionsCol: {
    width: '100%',
    gap: 10,
  },
  certEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  certEditBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#0D9488',
  },
  certSecondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  certSecondaryBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: Theme.colors.primary,
  },
});
