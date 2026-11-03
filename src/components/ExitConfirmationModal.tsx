import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Theme } from '../theme';
import { SeniorButton } from './SeniorButton';

export interface ExitConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmExit?: () => void;
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirmExit,
}) => {
  const handleStay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleExit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (onConfirmExit) {
      onConfirmExit();
    } else {
      BackHandler.exitApp();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleStay}
    >
      <TouchableWithoutFeedback onPress={handleStay}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Icon Badge */}
              <View style={styles.iconPlate}>
                <Ionicons
                  name="shield-checkmark"
                  size={42}
                  color={Theme.colors.primary}
                />
              </View>

              {/* Title & Comforting Message */}
              <Text style={styles.title}>Exit MedSync?</Text>
              <Text style={styles.bodyText}>
                Your scheduled medication alarms and reminders will continue to run
                safely in the background.
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {/* Stay in App Button (Primary senior action) */}
                <SeniorButton
                  title="Stay in App"
                  icon="checkmark-circle"
                  variant="primary"
                  onPress={handleStay}
                  style={styles.actionBtn}
                />

                {/* Exit App Button */}
                <SeniorButton
                  title="Exit App"
                  icon="exit-outline"
                  variant="outline"
                  onPress={handleExit}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    ...Theme.shadows.cardElevated,
    elevation: 12,
  },
  iconPlate: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#CCFBF1',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 24,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 10,
  },
  bodyText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  actionBtn: {
    width: '100%',
  },
});
