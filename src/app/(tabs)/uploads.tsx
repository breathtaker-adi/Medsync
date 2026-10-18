import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
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

interface ConnectedDoc {
  id: string;
  full_name: string;
  specialty?: string;
  clinic?: string;
}

export default function UploadsScreen() {
  const router = useRouter();
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
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoc[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [doctorModalVisible, setDoctorModalVisible] = useState(false);

  useEffect(() => {
    async function loadDoctors() {
      if (!session?.user?.id) return;
      try {
        // 1. Fetch actively linked doctors/caregivers for this patient
        const { data: links } = await supabase
          .from('patient_caregivers')
          .select('caregiver_id')
          .eq('patient_id', session.user.id)
          .not('caregiver_id', 'is', null);

        let docs: ConnectedDoc[] = [];

        if (links && links.length > 0) {
          const cIds = links.map((l: any) => l.caregiver_id);
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, specialty, clinic_affiliation')
            .in('id', cIds);

          if (profs && profs.length > 0) {
            docs = profs.map((p: any) => ({
              id: p.id,
              full_name: p.full_name?.startsWith('Dr.') ? p.full_name : `Dr. ${p.full_name || 'Physician'}`,
              specialty: p.specialty || 'General Practice',
              clinic: p.clinic_affiliation || 'Clinical Practice',
            }));
          }
        }

        // 2. If patient has no connected doctors yet in patient_caregivers,
        // load registered verified platform doctors so patient has clear choices
        if (docs.length === 0) {
          const { data: allDocs } = await supabase
            .from('profiles')
            .select('id, full_name, specialty, clinic_affiliation')
            .or('role.eq.doctor,is_verified_doctor.eq.true')
            .limit(10);

          if (allDocs && allDocs.length > 0) {
            docs = allDocs.map((p: any) => ({
              id: p.id,
              full_name: p.full_name?.startsWith('Dr.') ? p.full_name : `Dr. ${p.full_name || 'Physician'}`,
              specialty: p.specialty || 'General Practice',
              clinic: p.clinic_affiliation || 'Clinical Practice',
            }));
          }
        }

        setConnectedDoctors(docs);

        // Auto-select if exactly 1 doctor is connected
        if (docs.length === 1) {
          setSelectedDoctorId(docs[0].id);
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

  const executeUpload = async (targetDocId?: string | null) => {
    setIsUploading(true);

    const userId = session?.user?.id || 'anonymous';
    const patientName = profile?.full_name || 'Patient';
    const finalDoctorId = targetDocId !== undefined ? targetDocId : selectedDoctorId;

    const res = await prescriptionService.uploadAndSubmitPrescription({
      userId,
      patientName,
      base64Image: base64Image!,
      targetDoctorId: finalDoctorId || null,
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

      const isFlagged =
        res.data.ocrStatus === 'failed' ||
        (res.data.extractedData?.medicine_name && (
          res.data.extractedData.medicine_name.includes('⚠️') ||
          res.data.extractedData.medicine_name.includes('Unrecognized')
        ));

      const alertTitle = isFlagged ? 'Prescription Queued with Notice' : 'Prescription Submitted';
      const alertMsg = isFlagged
        ? 'Your prescription slip was uploaded. The AI could not clearly extract prescription text (or flagged it), but it has been queued for your doctor to review manually.'
        : 'Your prescription slip has been uploaded and queued for your supervising doctor to review and approve.';

      Alert.alert(
        alertTitle,
        alertMsg,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'View History',
            onPress: () => router.push('/prescription-history' as any),
          },
        ]
      );
    } else {
      showErrorAlert(res.error, 'Upload Failed');
    }
  };

  const proceedWithConsentAndUpload = async (targetDocId?: string | null) => {
    try {
      const hasConsented = await AsyncStorage.getItem('dpdp_ocr_consent');
      if (hasConsented === 'true') {
        if (session?.user?.id) {
          supabase
            .from('user_consents')
            .upsert({
              user_id: session.user.id,
              consent_type: 'dpdp_ocr_processing',
              consent_version: '1.0',
              consented_at: new Date().toISOString(),
            })
            .then(() => {});
        }
        await executeUpload(targetDocId);
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
                if (session?.user?.id) {
                  supabase
                    .from('user_consents')
                    .upsert({
                      user_id: session.user.id,
                      consent_type: 'dpdp_ocr_processing',
                      consent_version: '1.0',
                      consented_at: new Date().toISOString(),
                    })
                    .then(() => {});
                }
                await executeUpload(targetDocId);
              },
            },
          ]
        );
      }
    } catch {
      await executeUpload(targetDocId);
    }
  };

  const handleUploadAndScan = async () => {
    if (!base64Image) {
      Alert.alert('No Image', 'Please capture or select a prescription photo first.');
      return;
    }

    // Ask patient which doctor to send to if multiple doctors are connected and none explicitly chosen
    if (connectedDoctors.length > 1 && !selectedDoctorId) {
      setDoctorModalVisible(true);
      return;
    }

    await proceedWithConsentAndUpload(selectedDoctorId);
  };

  const selectedDoctorObj = connectedDoctors.find((d) => d.id === selectedDoctorId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header with History Action */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerText}>Scan Prescription</Text>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push('/prescription-history' as any)}
            accessibilityRole="button"
            accessibilityLabel="View submitted prescriptions history"
          >
            <Ionicons name="time-outline" size={17} color={Theme.colors.primary} />
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.guideText}>Select doctor and tap "Submit"</Text>
        </View>
      </View>

      {/* Status Banner */}
      {uploadStatus === 'pending' && (
        <View style={styles.statusBadge}>
          <Ionicons name="time" size={22} color="#92400E" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusText}>
              Prescription queued! Waiting for supervisor approval.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/prescription-history' as any)}
              style={styles.statusHistoryLink}
            >
              <Text style={styles.statusHistoryLinkText}>
                View Submission Status &rarr;
              </Text>
            </TouchableOpacity>
          </View>
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

        {/* Doctor Selection Card */}
        {imageUri && connectedDoctors.length > 0 && (
          <View style={styles.doctorSelectCard}>
            <View style={styles.doctorSelectHeader}>
              <Ionicons name="medical" size={20} color={Theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.doctorSelectTitle}>Which Doctor Should Approve This?</Text>
                <Text style={styles.doctorSelectSubtitle}>
                  {connectedDoctors.length > 1
                    ? `You are connected to ${connectedDoctors.length} doctors. Select who receives this:`
                    : 'Your connected supervising physician:'}
                </Text>
              </View>
            </View>

            {/* Individual Connected Doctor Options */}
            {connectedDoctors.map((doc) => {
              const isSelected = selectedDoctorId === doc.id;
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[
                    styles.doctorOptionChip,
                    isSelected && styles.doctorOptionChipSelected,
                  ]}
                  onPress={() => setSelectedDoctorId(doc.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.doctorAvatarBadge}>
                    <Ionicons
                      name="person"
                      size={18}
                      color={isSelected ? Theme.colors.primary : '#64748B'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.doctorOptionName, isSelected && styles.doctorOptionNameSelected]}>
                      {doc.full_name}
                    </Text>
                    <Text style={styles.doctorOptionSpecialty}>
                      {doc.specialty} {doc.clinic ? `• ${doc.clinic}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={isSelected ? Theme.colors.primary : "#94A3B8"}
                  />
                </TouchableOpacity>
              );
            })}

            {/* Option: Any Supervising Doctor / Practice Queue */}
            <TouchableOpacity
              style={[
                styles.doctorOptionChip,
                selectedDoctorId === null && styles.doctorOptionChipSelected,
              ]}
              onPress={() => setSelectedDoctorId(null)}
              activeOpacity={0.8}
            >
              <View style={styles.doctorAvatarBadge}>
                <Ionicons
                  name="people"
                  size={18}
                  color={selectedDoctorId === null ? Theme.colors.primary : '#64748B'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.doctorOptionName, selectedDoctorId === null && styles.doctorOptionNameSelected]}>
                  Practice Clinical Queue
                </Text>
                <Text style={styles.doctorOptionSpecialty}>
                  Any available doctor in the practice will review
                </Text>
              </View>
              <Ionicons
                name={selectedDoctorId === null ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={selectedDoctorId === null ? Theme.colors.primary : "#94A3B8"}
              />
            </TouchableOpacity>
          </View>
        )}

        {imageUri && (
          <PulseView active={!isUploading} minScale={0.98} maxScale={1.02}>
            <SeniorButton
              title={
                selectedDoctorObj
                  ? `Send to ${selectedDoctorObj.full_name}`
                  : "Submit for Doctor Review"
              }
              onPress={handleUploadAndScan}
              size="large"
              variant="success"
              loading={isUploading}
              icon={<Ionicons name="checkmark-done-circle" size={24} color="#FFFFFF" />}
            />
          </PulseView>
        )}
      </View>

      {/* Interactive Modal: Ask which doctor when multiple are connected */}
      <Modal
        visible={doctorModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDoctorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconWrap}>
                <Ionicons name="medical" size={24} color={Theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Choose Doctor for Approval</Text>
                <Text style={styles.modalSubtitle}>
                  You are connected to multiple doctors. Please choose who should review this prescription:
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDoctorModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
              {connectedDoctors.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.modalDoctorItem}
                  onPress={async () => {
                    setSelectedDoctorId(doc.id);
                    setDoctorModalVisible(false);
                    await proceedWithConsentAndUpload(doc.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalDocIconBox}>
                    <Ionicons name="person" size={22} color={Theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalDocName}>{doc.full_name}</Text>
                    <Text style={styles.modalDocMeta}>
                      {doc.specialty} {doc.clinic ? `• ${doc.clinic}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.modalDoctorItem}
                onPress={async () => {
                  setSelectedDoctorId(null);
                  setDoctorModalVisible(false);
                  await proceedWithConsentAndUpload(null);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.modalDocIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="people" size={22} color="#475569" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalDocName}>Practice Clinical Queue</Text>
                  <Text style={styles.modalDocMeta}>Any available physician</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setDoctorModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 26,
    color: '#0F172A',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E6F4F4',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  historyBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.primary,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 14.5,
    color: '#64748B',
    lineHeight: 20,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
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
    fontSize: 14.5,
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
  },
  statusHistoryLink: {
    marginTop: 6,
  },
  statusHistoryLinkText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: '#B45309',
    textDecorationLine: 'underline',
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: Theme.rounded.xl,
    height: 280,
    marginBottom: 20,
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
    fontSize: 14.5,
    color: Theme.colors.outline,
  },
  buttonsGroup: {
    width: '100%',
  },
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
    gap: 12,
  },
  inputLabel: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  doctorSelectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    ...Theme.shadows.card,
  },
  doctorSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  doctorSelectTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  doctorSelectSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  doctorOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  doctorOptionChipSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#F0FDFA',
  },
  doctorAvatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorOptionName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#1E293B',
  },
  doctorOptionNameSelected: {
    color: Theme.colors.primary,
  },
  doctorOptionSpecialty: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
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
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalDoctorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  modalDocIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDocName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14.5,
    color: '#0F172A',
  },
  modalDocMeta: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#64748B',
  },
});