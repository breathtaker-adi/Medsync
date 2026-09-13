// src/app/(tabs)/uploads.tsx
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/authcontext';
import { supabase } from '../../lib/supabase';
import { Theme } from '../../theme';

export default function UploadsScreen() {
  const { session, profile } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'pending' | 'approved'>('idle');

  // The AI Scanner Function — routes through Supabase Edge Function
  // so the OpenAI API key is never exposed in the client bundle.
  const scanPrescriptionWithAI = async (base64: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('scan-prescription', {
        body: { base64Image: base64 },
      });

      if (error) throw error;

      return {
        medicine_name: data.medicine_name || 'Unknown Medicine',
        dosage: data.dosage || 'See prescription',
        duration: data.duration || 'Not specified',
      };
    } catch (error) {
      console.error('AI Scan Error:', error);
      Alert.alert('AI Scan Failed', 'Could not read prescription with AI. Uploading image only.');
      return null;
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    let result;
    if (fromCamera) {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Crucial for AI & Supabase
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setBase64Image(asset.base64 || null);
      setUploadStatus('idle'); // Reset status if new image is picked
    }
  };

  const handleUploadAndScan = async () => {
    if (!base64Image) {
      Alert.alert('No Image', 'Please select or scan a prescription first.');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload image to Supabase Storage
      const fileName = `prescription_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(fileName, decode(base64Image), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: urlData } = supabase.storage
        .from('prescriptions')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 3. Scan with AI
      const aiData = await scanPrescriptionWithAI(base64Image);
      const extractedData = aiData || {
        medicine_name: 'Pending AI Review',
        dosage: null,
        duration: null,
      };

      // 4. Insert into pending_reviews with actual patient profile and session
      const { error: dbError } = await supabase
        .from('pending_reviews')
        .insert({
          patient_name: profile?.full_name || 'Unknown Patient',
          patient_id: session?.user?.id, // Links prescription to logged-in patient
          medication: extractedData.medicine_name,
          dosage: extractedData.dosage,
          duration: extractedData.duration,
          image_url: publicUrl,
          time_ago: 'Just now',
          status: 'pending',
        });

      if (dbError) throw dbError;

      // --- PUSH NOTIFICATION TO DOCTOR ---
      try {
        // 1. Get the doctor's push token using the database view
        const { data: doctorData } = await supabase
          .from('doctor_push_tokens')
          .select('push_token')
          .eq('patient_id', session?.user?.id);

        if (doctorData && doctorData.length > 0) {
          const doctorToken = doctorData[0].push_token;

          // 2. Send the notification via Expo's Push API
          if (doctorToken) {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: doctorToken,
                title: '📋 New Prescription Review',
                body: `${profile?.full_name || 'A patient'} just uploaded a prescription for ${extractedData.medicine_name}.`,
                priority: 'high',
                sound: 'default',
              }),
            });
          }
        }
      } catch (notifError) {
        console.error('Failed to send push notification:', notifError);
        // Silently handle error so successful upload isn't blocked
      }
      // --- END PUSH NOTIFICATION ---

      Alert.alert('Success', 'Prescription uploaded and sent to doctor for review!');
      setUploadStatus('pending'); // Show the pending badge
      setImageUri(null); // Clear preview
      setBase64Image(null);
    } catch (error: any) {
      console.error('Upload Error:', error);
      Alert.alert('Error', error.message || 'Failed to upload prescription.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Upload Prescription</Text>
      <Text style={styles.subHeaderText}>Scan or upload your prescription for doctor review</Text>

      {/* Status Badge */}
      {uploadStatus === 'pending' && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Pending: Waiting for Dr. Sharma approval for Metformin 500mg</Text>
        </View>
      )}

      {/* Image Preview Area */}
      <View style={styles.previewContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="document-text-outline" size={64} color={Theme.colors.outline} />
            <Text style={styles.placeholderText}>No prescription selected</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity style={styles.scanButton} onPress={() => pickImage(true)}>
        <Ionicons name="camera-outline" size={24} color={Theme.colors.onPrimary} />
        <Text style={[styles.buttonText, { color: Theme.colors.onPrimary }]}>Scan Prescription</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.galleryButton} onPress={() => pickImage(false)}>
        <Ionicons name="images-outline" size={24} color={Theme.colors.primary} />
        <Text style={[styles.buttonText, { color: Theme.colors.primary }]}>Upload from Gallery</Text>
      </TouchableOpacity>

      {/* Submit Button */}
      {imageUri && (
        <TouchableOpacity style={styles.submitButton} onPress={handleUploadAndScan} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit for Review</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.surface, padding: 20, paddingTop: 60 },
  headerText: { fontFamily: 'PublicSans-ExtraBold', fontSize: 28, color: Theme.colors.onSurface, marginBottom: 4 },
  subHeaderText: { fontFamily: 'PublicSans-Regular', fontSize: 16, color: Theme.colors.onSurfaceVariant, marginBottom: 20 },

  statusBadge: {
    backgroundColor: Theme.colors.secondaryContainer,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusText: { fontFamily: 'PublicSans-Medium', fontSize: 14, color: Theme.colors.onSecondaryContainer },

  previewContainer: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 16,
    height: 300,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Theme.colors.outlineVariant,
    borderStyle: 'dashed',
  },
  previewImage: { width: '100%', height: '100%', borderRadius: 14 },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontFamily: 'PublicSans-Regular', fontSize: 16, color: Theme.colors.outline, marginTop: 8 },

  scanButton: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  galleryButton: {
    backgroundColor: 'transparent',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    marginBottom: 24,
  },
  buttonText: { fontFamily: 'PublicSans-Bold', fontSize: 16, marginLeft: 8 },

  submitButton: {
    backgroundColor: Theme.colors.success,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: { fontFamily: 'PublicSans-Bold', fontSize: 18, color: '#fff' },
});