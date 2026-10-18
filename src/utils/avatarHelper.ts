// src/utils/avatarHelper.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const AVATAR_KEY_PREFIX = '@medsync_avatar_';

export const avatarHelper = {
  /**
   * Retrieve locally cached avatar for the user
   */
  async getLocalAvatar(userId: string): Promise<string | null> {
    try {
      if (!userId) return null;
      return await AsyncStorage.getItem(`${AVATAR_KEY_PREFIX}${userId}`);
    } catch {
      return null;
    }
  },

  /**
   * Prompt user to pick a photo from library or take a photo with camera
   */
  async promptPickAvatar(userId: string): Promise<string | null> {
    if (!userId) return null;

    return new Promise((resolve) => {
      Alert.alert(
        'Update Profile Picture',
        'Choose how you would like to select your profile picture',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          {
            text: 'Take Photo',
            onPress: async () => {
              const res = await avatarHelper.captureCameraPhoto(userId);
              resolve(res);
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const res = await avatarHelper.pickFromGallery(userId);
              resolve(res);
            },
          },
        ]
      );
    });
  },

  /**
   * Pick photo from device gallery
   */
  async pickFromGallery(userId: string): Promise<string | null> {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Photo gallery permission is required to select a profile picture.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const avatarData = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        await avatarHelper.saveAvatar(userId, avatarData);
        return avatarData;
      }
      return null;
    } catch (err) {
      console.error('Gallery picker error:', err);
      Alert.alert('Error', 'Could not open photo gallery.');
      return null;
    }
  },

  /**
   * Capture photo with camera
   */
  async captureCameraPhoto(userId: string): Promise<string | null> {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take a profile picture.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const avatarData = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        await avatarHelper.saveAvatar(userId, avatarData);
        return avatarData;
      }
      return null;
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Error', 'Could not open camera.');
      return null;
    }
  },

  /**
   * Persist avatar to AsyncStorage & Supabase profiles
   */
  async saveAvatar(userId: string, avatarData: string): Promise<void> {
    try {
      // 1. Local instant cache
      await AsyncStorage.setItem(`${AVATAR_KEY_PREFIX}${userId}`, avatarData);

      // 2. Supabase profile update
      await supabase
        .from('profiles')
        .update({
          avatar_url: avatarData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (err) {
      console.warn('Avatar persistence note:', err);
    }
  },
};
