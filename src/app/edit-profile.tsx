// src/app/edit-profile.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { avatarHelper } from '../utils/avatarHelper';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Others'];

const SPECIALTY_OPTIONS = [
  'Internal Medicine',
  'Geriatrics',
  'Cardiology',
  'General Physician',
  'Family Medicine',
  'Pediatrics',
  'Neurology',
  'Endocrinology',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const { triggerHaptic } = useAccessibility();

  const isDoctorOrCaregiver =
    profile?.role === 'doctor' ||
    profile?.role === 'caregiver' ||
    profile?.is_verified_doctor === true;

  // Avatar state
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);

  // Common fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [phone, setPhone] = useState(session?.user?.user_metadata?.phone || '');

  // Patient-specific fields
  const [bloodGroup, setBloodGroup] = useState<string>(profile?.blood_group || '');
  const [customBloodGroup, setCustomBloodGroup] = useState<string>('');
  const [allergies, setAllergies] = useState<string>(profile?.allergies || '');
  const [emergencyContactName, setEmergencyContactName] = useState<string>(
    session?.user?.user_metadata?.emergency_contact_name || ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>(
    session?.user?.user_metadata?.emergency_contact_phone || ''
  );
  const [age, setAge] = useState<string>(
    profile?.age != null
      ? String(profile.age)
      : session?.user?.user_metadata?.age
      ? String(session.user.user_metadata.age)
      : ''
  );

  // Doctor-specific fields
  const [specialty, setSpecialty] = useState<string>(profile?.specialty || '');
  const [clinicAffiliation, setClinicAffiliation] = useState<string>(
    profile?.clinic_affiliation || ''
  );
  const [licenseNumber, setLicenseNumber] = useState<string>(
    profile?.medical_license_number || ''
  );
  const [medicalCouncil, setMedicalCouncil] = useState<string>(
    profile?.medical_council || ''
  );
  const [yearsExperience, setYearsExperience] = useState<string>(
    profile?.years_of_experience || ''
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUri(profile.avatar_url);
    } else if (session?.user?.id) {
      avatarHelper.getLocalAvatar(session.user.id).then((local) => {
        if (local) setAvatarUri(local);
      });
    }
  }, [session?.user?.id, profile?.avatar_url]);

  const handlePickAvatar = async () => {
    if (!session?.user?.id) return;
    triggerHaptic();
    const newAvatar = await avatarHelper.promptPickAvatar(session.user.id);
    if (newAvatar) {
      setAvatarUri(newAvatar);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No authenticated session found.');
      return;
    }

    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    triggerHaptic();

    try {
      // 1. Update public.profiles
      const profileUpdates: any = {
        full_name: fullName.trim(),
        avatar_url: avatarUri,
        updated_at: new Date().toISOString(),
      };

      if (isDoctorOrCaregiver) {
        profileUpdates.specialty = specialty.trim();
        profileUpdates.clinic_affiliation = clinicAffiliation.trim();
        profileUpdates.medical_license_number = licenseNumber.trim();
        profileUpdates.medical_council = medicalCouncil.trim();
        profileUpdates.years_of_experience = yearsExperience.trim();
      } else {
        const resolvedBloodGroup =
          bloodGroup === 'Others' && customBloodGroup.trim()
            ? customBloodGroup.trim()
            : bloodGroup.trim();
        profileUpdates.blood_group = resolvedBloodGroup;
        profileUpdates.allergies = allergies.trim();
        if (age.trim()) {
          const parsedAge = parseInt(age.trim(), 10);
          if (!isNaN(parsedAge)) {
            profileUpdates.age = parsedAge;
          }
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', session.user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // 2. Update email in auth if user modified it
      const trimmedEmail = email.trim();
      const currentEmail = session.user.email || '';
      let emailUpdateInitiated = false;

      if (trimmedEmail && trimmedEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });
        if (emailErr) {
          throw new Error(`Email update failed: ${emailErr.message}`);
        }
        emailUpdateInitiated = true;
      }

      // 3. Update user metadata for emergency contact & phone
      const metadataUpdates: any = {
        full_name: fullName.trim(),
        phone: phone.trim(),
      };

      if (!isDoctorOrCaregiver) {
        metadataUpdates.emergency_contact_name = emergencyContactName.trim();
        metadataUpdates.emergency_contact_phone = emergencyContactPhone.trim();
        metadataUpdates.age = age.trim();
        metadataUpdates.blood_group = profileUpdates.blood_group;
      }

      await supabase.auth.updateUser({
        data: metadataUpdates,
      });

      // 4. Refresh in-app profile state
      await refreshProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const emailNotice = emailUpdateInitiated
        ? '\n\nA verification email has been sent to your new email address. Please click the confirmation link in your inbox to complete the email change.'
        : '';
      Alert.alert(
        'Profile Updated',
        (isDoctorOrCaregiver
          ? 'Your clinical practice details have been saved successfully.'
          : 'Your medical profile and emergency contacts have been saved.') + emailNotice,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={isDoctorOrCaregiver ? 'Clinical Profile Details' : 'Medical Profile Details'}
        subtitle={
          isDoctorOrCaregiver
            ? 'Practice information & credentials'
            : 'Personal health & emergency contacts'
        }
        fallbackRoute={isDoctorOrCaregiver ? '/doctor-settings' : '/settings'}
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
          {/* Avatar Card */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarPlate}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons
                  name={isDoctorOrCaregiver ? 'medical' : 'person'}
                  size={36}
                  color={Theme.colors.primary}
                />
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickAvatar}>
              <Ionicons name="image-outline" size={15} color={Theme.colors.primary} />
              <Text style={styles.changePhotoText}>Change Profile Picture</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Personal Identification</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {isDoctorOrCaregiver ? 'Doctor Full Name' : 'Patient Full Name'} *
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name={isDoctorOrCaregiver ? 'medkit-outline' : 'person-outline'}
                  size={18}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={isDoctorOrCaregiver ? 'e.g. Dr. Rajesh Sharma' : 'e.g. Ramesh Sharma'}
                  placeholderTextColor="#94A3B8"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              {email.trim().toLowerCase() !== (session?.user?.email || '').toLowerCase() && (
                <Text style={styles.fieldHint}>
                  Changing email will send a confirmation link to the new address before taking effect.
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contact Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>
          </View>

          {/* DOCTOR / CAREGIVER CLINICAL DETAILS */}
          {isDoctorOrCaregiver ? (
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Clinical Practice &amp; Credentials</Text>

              {/* Specialty */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Medical Specialty</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="fitness-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Internal Medicine & Geriatrics"
                    placeholderTextColor="#94A3B8"
                    value={specialty}
                    onChangeText={setSpecialty}
                  />
                </View>
                {/* Specialty Quick Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {SPECIALTY_OPTIONS.map((spec) => (
                    <TouchableOpacity
                      key={spec}
                      style={[styles.specChip, specialty === spec && styles.specChipActive]}
                      onPress={() => {
                        triggerHaptic();
                        setSpecialty(spec);
                      }}
                    >
                      <Text
                        style={[styles.specChipText, specialty === spec && styles.specChipTextActive]}
                      >
                        {spec}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Clinic Affiliation */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Hospital / Clinic Affiliation &amp; Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="business-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Apollo Hospital / City Heart Care Clinic"
                    placeholderTextColor="#94A3B8"
                    value={clinicAffiliation}
                    onChangeText={setClinicAffiliation}
                  />
                </View>
              </View>

              {/* Medical License */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Medical License / Registration No.</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="card-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. MCI-2018-94821"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                  />
                </View>
              </View>

              {/* Medical Council */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>State / National Medical Council</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="ribbon-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Delhi Medical Council / NMC"
                    placeholderTextColor="#94A3B8"
                    value={medicalCouncil}
                    onChangeText={setMedicalCouncil}
                  />
                </View>
              </View>

              {/* Years of Experience */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Years of Clinical Experience</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="time-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 12 years"
                    placeholderTextColor="#94A3B8"
                    value={yearsExperience}
                    onChangeText={setYearsExperience}
                  />
                </View>
              </View>
            </View>
          ) : (
            /* PATIENT MEDICAL & EMERGENCY DETAILS */
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Medical Vitals &amp; Emergency</Text>

              {/* Blood Group */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Blood Group</Text>
                <View style={styles.bloodGroupRow}>
                  {BLOOD_GROUPS.map((bg) => {
                    const isSelected = bloodGroup === bg;
                    return (
                      <TouchableOpacity
                        key={bg}
                        style={[styles.bloodGroupPill, isSelected && styles.bloodGroupPillActive]}
                        onPress={() => {
                          triggerHaptic();
                          setBloodGroup(bg);
                        }}
                      >
                        <Text
                          style={[styles.bloodGroupText, isSelected && styles.bloodGroupTextActive]}
                        >
                          {bg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {bloodGroup === 'Others' && (
                  <View style={[styles.inputWrapper, { marginTop: 10 }]}>
                    <Ionicons name="water-outline" size={18} color="#DC2626" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Specify rare blood type (e.g. Bombay group, Rh-null) or leave blank"
                      placeholderTextColor="#94A3B8"
                      value={customBloodGroup}
                      onChangeText={setCustomBloodGroup}
                    />
                  </View>
                )}
              </View>

              {/* Allergies */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Known Drug Allergies &amp; Health Conditions</Text>
                <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 10 }]}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color="#D97706"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="e.g. Penicillin, Sulfa drugs, Aspirin sensitivity, Diabetes Type 2"
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={allergies}
                    onChangeText={setAllergies}
                  />
                </View>
              </View>

              {/* Age */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Age (years)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="hourglass-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 68"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={3}
                    value={age}
                    onChangeText={setAge}
                  />
                </View>
              </View>

              {/* Emergency Contact Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Emergency Contact Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="people-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Sunita Sharma (Daughter / Caregiver)"
                    placeholderTextColor="#94A3B8"
                    value={emergencyContactName}
                    onChangeText={setEmergencyContactName}
                  />
                </View>
              </View>

              {/* Emergency Contact Phone */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Emergency Contact Phone</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={18} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="+91 98111 22334"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={emergencyContactPhone}
                    onChangeText={setEmergencyContactPhone}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Save Button */}
          <View style={styles.submitSection}>
            {saving ? (
              <ActivityIndicator size="large" color={Theme.colors.primary} />
            ) : (
              <SeniorButton
                title="Save & Update Information"
                onPress={handleSave}
                variant="primary"
                size="large"
                icon={<Ionicons name="save" size={20} color="#FFFFFF" />}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  avatarPlate: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E6FFFA',
    borderWidth: 2.5,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Theme.shadows.level1,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0D9488',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E6FFFA',
  },
  changePhotoText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12,
    color: '#0D9488',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...Theme.shadows.level1,
  },
  cardHeaderTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 10,
  },
  fieldHint: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 11.5,
    color: '#D97706',
    marginTop: 4,
    lineHeight: 16,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginTop: 8,
  },
  specChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  specChipText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  specChipTextActive: {
    color: '#0F766E',
    fontFamily: 'PublicSans-Bold',
  },
  bloodGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodGroupPill: {
    minWidth: 48,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodGroupPillActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  bloodGroupText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#475569',
  },
  bloodGroupTextActive: {
    color: '#DC2626',
  },
  submitSection: {
    marginTop: 8,
    marginBottom: 24,
  },
});
