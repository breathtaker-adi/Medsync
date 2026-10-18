import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PulseView } from '../../components/PulseView';
import { SeniorButton } from '../../components/SeniorButton';
import { useAuth } from '../../context/authcontext';
import { supabase } from '../../lib/supabase';
import { prescriptionService } from '../../services/prescriptionService';
import { Theme } from '../../theme';
import { showErrorAlert } from '../../utils/errorHandler';

export default function UploadsScreen() {
  const { session, profile } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'pending' | 'approved'>('idle');

  // Optional manual medication details (allows patient to specify or assist OCR)
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

  // Multi-doctor routing state
  interface ConnectedDoc {
    id: string;
    full_name: string;
    specialty?: string;
  }
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoc[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoctors() {
      if (!session?.user?.id) return;
      try {
        const { data: links } = await supabase
          .from('patient_caregivers')
          .select('caregiver_id')
          .eq('patient_id', session.user.id)
          .not('caregiver_id', 'is', null);

        if (links && links.length > 0) {
          const cIds = links.map((l: any) => l.caregiver_id);
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, specialty')
            .in('id', cIds);

          if (profs) {
            setConnectedDoctors(
              profs.map((p: any) => ({
                id: p.id,
                full_name: p.full_name?.startsWith('Dr.') ? p.full_name : `Dr. ${p.full_name || 'Physician'}`,
                specialty: p.specialty || 'General Practice',
              }))
            );
          }
        }
      } catch (err) {
        console.error('Failed to load connected doctors for upload:', err);
      }
    }
    loadDoctors();
  }, [session?.user?.id]);

  const pickImage = async (fromCamera: boolean) => {
    let result;
    if (fromCamera) {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
        base64: true,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
        base64: true,
      });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setBase64Image(asset.base64 || null);
      setUploadStatus('idle');
    }
  };

  const executeUpload = async () => {
    setIsUploading(true);

    const userId = session?.user?.id || 'anonymous';
    const patientName = profile?.full_name || 'Patient';

    const res = await prescriptionService.uploadAndSubmitPrescription({
      userId,
      patientName,
      base64Image: base64Image!,
      targetDoctorId: selectedDoctorId || null,
      medicineName: medicineName.trim() || undefined,
      dosage: dosage.trim() || undefined,
      duration: duration.trim() || undefined,
      patientNotes: patientNotes.trim() || undefined,
    });

    setIsUploading(false);

    if (res.success) {
      setUploadStatus('pending');
      setMedicineName('');
      setDosage('');
      setDuration('');
      setPatientNotes('');
      Alert.alert(
        'Prescription Submitted',
        'Your prescription slip has been uploaded and queued for your supervising caregiver / doctor to review and approve.'
      );
    } else {
      showErrorAlert(res.error, 'Upload Failed');
    }
  };

  const handleUploadAndScan = async () => {
    if (!base64Image) {
      Alert.alert('No Image', 'Please capture or select a prescription photo first.');
      return;
    }

    // DPDP Act 2023 Consent Check for AI OCR Data Processing
    try {
      const hasConsented = await AsyncStorage.getItem('dpdp_ocr_consent');
      if (hasConsented === 'true') {
        await executeUpload();
      } else {
        Alert.alert(
          'AI Prescription Scan Consent',
          'Under India\'s DPDP Act 2023, your prescription slip will be processed over encrypted channels by our AI service solely to extract medicine names and dosage directions for your doctor\'s review. No images are retained for model training.\n\nDo you consent to proceed?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'I Consent & Scan',
              onPress: async () => {
                await AsyncStorage.setItem('dpdp_ocr_consent', 'true');
                await executeUpload();
              },
            },
          ]
        );
      }
    } catch {
      await executeUpload();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Scan Prescription</Text>
        <Text style={styles.subHeaderText}>
          Take a clear photo of your prescription slip. AI will parse the details and send them to your doctor for approval.
        </Text>
      </View>

      {/* Helpful Instructions for Seniors */}
      <View style={styles.guideCard}>
        <View style={styles.guideRow}>
          <View style={styles.guideStepCircle}>
            <Text style={styles.guideStepNum}>1</Text>
          </View>
          <Text style={styles.guideText}>Lay slip flat under good lighting</Text>
        </View>
        <View style={styles.guideRow}>
          <View style={styles.guideStepCircle}>
            <Text style={styles.guideStepNum}>2</Text>
          </View>
          <Text style={styles.guideText}>Hold steady and fit within the frame</Text>
        </View>
        <View style={styles.guideRow}>
          <View style={styles.guideStepCircle}>
            <Text style={styles.guideStepNum}>3</Text>
          </View>
          <Text style={styles.guideText}>Tap "Submit" to send to your doctor</Text>
        </View>
      </View>

      {/* Status Banner */}
      {uploadStatus === 'pending' && (
        <View style={styles.statusBadge}>
          <Ionicons name="time" size={20} color="#92400E" style={{ marginRight: 8 }} />
          <Text style={styles.statusText}>
            Prescription queued! Waiting for supervisor approval.
          </Text>
        </View>
      )}

      {/* Image Preview / Viewfinder */}
      <View style={[styles.previewContainer, imageUri && styles.previewContainerHasImage]}>
        {imageUri ? (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => {
                setImageUri(null);
                setBase64Image(null);
              }}
              accessibilityLabel="Remove and retake photo"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.placeholder}
            onPress={() => pickImage(true)}
            accessibilityRole="button"
            accessibilityLabel="Tap to open camera and scan prescription"
          >
            <View style={styles.cameraIconPlate}>
              <Ionicons name="camera" size={44} color={Theme.colors.primary} />
            </View>
            <Text style={styles.placeholderTitle}>Tap to Open Camera</Text>
            <Text style={styles.placeholderText}>Or choose from photo gallery below</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonsGroup}>
        <SeniorButton
          title={imageUri ? "Retake with Camera" : "Snap Prescription Photo"}
          onPress={() => pickImage(true)}
          size="large"
          variant={imageUri ? "outline" : "primary"}
          icon={<Ionicons name="camera" size={24} color={imageUri ? Theme.colors.primary : "#FFFFFF"} />}
          style={{ marginBottom: 14 }}
        />

        <SeniorButton
          title="Upload from Photo Gallery"
          onPress={() => pickImage(false)}
          size="normal"
          variant="secondary"
          icon={<Ionicons name="images-outline" size={22} color={Theme.colors.primary} />}
          style={{ marginBottom: 16 }}
        />

        {imageUri && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Ionicons name="create-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.detailsTitle}>Prescription Details (Optional)</Text>
            </View>
            <Text style={styles.detailsSubtitle}>
              You may specify medication details below, or leave blank to let AI OCR scan the photo for your doctor.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Medication Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Metformin 500mg, Amoxicillin"
                placeholderTextColor="#94A3B8"
                value={medicineName}
                onChangeText={setMedicineName}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Dosage / Frequency</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 1 tablet twice daily"
                  placeholderTextColor="#94A3B8"
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Duration</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 7 days, 30 days"
                  placeholderTextColor="#94A3B8"
                  value={duration}
                  onChangeText={setDuration}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes / Instructions</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g., Take after food with water. Prescribed for fever."
                placeholderTextColor="#94A3B8"
                value={patientNotes}
                onChangeText={setPatientNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {imageUri && connectedDoctors.length > 0 && (
          <View style={styles.doctorSelectCard}>
            <View style={styles.doctorSelectHeader}>
              <Ionicons name="medical" size={18} color={Theme.colors.primary} />
              <Text style={styles.doctorSelectTitle}>Route Prescription To:</Text>
            </View>

            {/* Option: Any Supervising Doctor */}
            <TouchableOpacity
              style={[
                styles.doctorOptionChip,
                selectedDoctorId === null && styles.doctorOptionChipSelected,
              ]}
              onPress={() => setSelectedDoctorId(null)}
            >
              <Ionicons
                name={selectedDoctorId === null ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={selectedDoctorId === null ? Theme.colors.primary : "#94A3B8"}
              />
              <Text style={[styles.doctorOptionText, selectedDoctorId === null && styles.doctorOptionTextSelected]}>
                Any Connected Doctor (Practice Queue)
              </Text>
            </TouchableOpacity>

            {/* Individual Doctor Options */}
            {connectedDoctors.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[
                  styles.doctorOptionChip,
                  selectedDoctorId === doc.id && styles.doctorOptionChipSelected,
                ]}
                onPress={() => setSelectedDoctorId(doc.id)}
              >
                <Ionicons
                  name={selectedDoctorId === doc.id ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={selectedDoctorId === doc.id ? Theme.colors.primary : "#94A3B8"}
                />
                <Text style={[styles.doctorOptionText, selectedDoctorId === doc.id && styles.doctorOptionTextSelected]}>
                  {doc.full_name} ({doc.specialty})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {imageUri && (
          <PulseView active={!isUploading} minScale={0.98} maxScale={1.02}>
            <SeniorButton
              title="Submit for Doctor Review"
              onPress={handleUploadAndScan}
              size="large"
              variant="success"
              loading={isUploading}
              icon={<Ionicons name="checkmark-done-circle" size={24} color="#FFFFFF" />}
            />
          </PulseView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailsTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  detailsSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  doctorSelectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.card,
  },
  doctorSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  doctorSelectTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#0F172A',
  },
  doctorOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  doctorOptionChipSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: Theme.colors.primary,
  },
  doctorOptionText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: '#334155',
  },
  doctorOptionTextSelected: {
    fontFamily: 'PublicSans-Bold',
    color: Theme.colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 16,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 30,
    color: Theme.colors.onSurface,
    marginBottom: 6,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    lineHeight: 22,
    color: Theme.colors.onSurfaceVariant,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Theme.rounded.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10,
    ...Theme.shadows.card,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideStepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNum: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.primary,
  },
  guideText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: Theme.rounded.md,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#92400E',
    flex: 1,
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: Theme.rounded.xl,
    height: 280,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#0D7377',
    borderStyle: 'dashed',
    ...Theme.shadows.card,
  },
  previewContainerHasImage: {
    borderStyle: 'solid',
    borderColor: '#A7F3D0',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  retakeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  retakeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
    height: '100%',
  },
  cameraIconPlate: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  placeholderTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 20,
    color: Theme.colors.primary,
    marginBottom: 4,
  },
  placeholderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 15,
    color: Theme.colors.outline,
  },
  buttonsGroup: {
    width: '100%',
  },
});