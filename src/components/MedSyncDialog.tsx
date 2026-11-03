// src/components/MedSyncDialog.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme } from '../theme';

export type DialogType = 'error' | 'warning' | 'info' | 'success';

export interface DialogAction {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogOptions {
  title: string;
  message: string;
  type?: DialogType;
  actions?: DialogAction[];
  dismissible?: boolean;
}

type DialogListener = (dialog: DialogOptions | null) => void;

class DialogManager {
  private listener: DialogListener | null = null;
  private currentDialog: DialogOptions | null = null;

  register(listener: DialogListener) {
    this.listener = listener;
    if (this.currentDialog) {
      listener(this.currentDialog);
    }
  }

  unregister() {
    this.listener = null;
  }

  show(options: DialogOptions) {
    this.currentDialog = options;
    if (this.listener) {
      this.listener(options);
    }
  }

  hide() {
    this.currentDialog = null;
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const dialogManager = new DialogManager();

export function showDialog(options: DialogOptions) {
  dialogManager.show(options);
}

export function hideDialog() {
  dialogManager.hide();
}

export const MedSyncDialogContainer: React.FC = () => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  useEffect(() => {
    dialogManager.register(setDialog);
    return () => dialogManager.unregister();
  }, []);

  if (!dialog) return null;

  const {
    title,
    message,
    type = 'info',
    actions = [{ text: 'OK', style: 'default' }],
    dismissible = true,
  } = dialog;

  const handleAction = (action?: DialogAction) => {
    if (action?.style === 'destructive') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    dialogManager.hide();
    if (action?.onPress) {
      action.onPress();
    }
  };

  const handleBackdrop = () => {
    if (dismissible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dialogManager.hide();
    }
  };

  const getIconConfig = () => {
    switch (type) {
      case 'error':
        return {
          name: 'alert-circle' as const,
          color: '#DC2626',
          bg: '#FEE2E2',
          border: '#FECACA',
        };
      case 'warning':
        return {
          name: 'warning' as const,
          color: '#D97706',
          bg: '#FEF3C7',
          border: '#FDE68A',
        };
      case 'success':
        return {
          name: 'checkmark-circle' as const,
          color: '#0D9488',
          bg: '#CCFBF1',
          border: '#99F6E4',
        };
      case 'info':
      default:
        return {
          name: 'information-circle' as const,
          color: '#0284C7',
          bg: '#E0F2FE',
          border: '#BAE6FD',
        };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal
      transparent
      visible={true}
      animationType="fade"
      onRequestClose={handleBackdrop}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleBackdrop}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Icon Badge */}
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: iconConfig.bg, borderColor: iconConfig.border },
                ]}
              >
                <Ionicons name={iconConfig.name} size={30} color={iconConfig.color} />
              </View>

              {/* Title & Message */}
              <Text style={styles.title} textBreakStrategy="simple">
                {title}
              </Text>
              <Text style={styles.message} textBreakStrategy="simple">
                {message}
              </Text>

              {/* Action Buttons */}
              <View
                style={[
                  styles.actionsContainer,
                  actions.length > 2 && styles.actionsContainerColumn,
                ]}
              >
                {actions.map((act, index) => {
                  const isCancel = act.style === 'cancel';
                  const isDestructive = act.style === 'destructive';
                  const isPrimary = !isCancel && !isDestructive;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isPrimary && styles.buttonPrimary,
                        isCancel && styles.buttonCancel,
                        isDestructive && styles.buttonDestructive,
                        actions.length <= 2 && { flex: 1 },
                      ]}
                      onPress={() => handleAction(act)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={act.text}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isPrimary && styles.buttonTextPrimary,
                          isCancel && styles.buttonTextCancel,
                          isDestructive && styles.buttonTextDestructive,
                        ]}
                      >
                        {act.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    ...Theme.shadows.cardElevated,
    elevation: 12,
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  actionsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  actionsContainerColumn: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: Theme.colors.primary,
  },
  buttonCancel: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  buttonDestructive: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: '#475569',
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});

