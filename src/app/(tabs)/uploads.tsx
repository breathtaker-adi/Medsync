import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PulseView } from '../../components/PulseView';
import { SeniorButton } from '../../components/SeniorButton';
import { useAuth } from '../../context/authcontext';
import { prescriptionService } from '../../services/prescriptionService';
import { Theme } from '../../theme';
import { showErrorAlert } from '../../utils/errorHandler';

export default function UploadsScreen() {
  const { session, profile } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'pending' | 'approved'>('idle');

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
    });

    setIsUploading(false);

    if (res.success) {
      setUploadStatus('pending');
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