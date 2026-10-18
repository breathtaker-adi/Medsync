// src/app/role-selection.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { useAuth } from '../context/authcontext';
import { supabase } from '../lib/supabase';
import { Theme } from '../theme';

const RoleOptionCard = ({
  icon,
  title,
  desc,
  badgeText,
  badgeColor,
  disabled,
  onPress,
}: {
  icon: any;
  title: string;
  desc: string;
  badgeText: string;
  badgeColor: string;
  disabled?: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.97, { damping: 14, stiffness: 220 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1.0, { damping: 14, stiffness: 220 });
  };

  const handlePress = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onPress();
  };

  return (
    <Animated.View style={[animatedStyle, { width: '100%', marginBottom: 12 }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        style={[styles.roleCard, disabled && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${desc}`}
      >
        <View style={[styles.iconPlate, { backgroundColor: badgeColor }]}>
          <Ionicons name={icon} size={24} color={Theme.colors.primary} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.roleTitle}>{title}</Text>
            <View style={styles.miniBadge}>
              <Text style={styles.miniBadgeText}>{badgeText}</Text>
            </View>
          </View>
          <Text style={styles.roleDesc}>{desc}</Text>
        </View>

        <View style={styles.chevronWrapper}>
          <Ionicons name="chevron-forward" size={18} color={Theme.colors.primary} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const [savingRole, setSavingRole] = useState(false);

  const handleSelectRole = async (chosenRole: 'patient' | 'caregiver') => {
    setSavingRole(true);
    try {
      if (session?.user?.id) {
        const { error } = await supabase.from('profiles').upsert(
          {
            id: session.user.id,
            role: chosenRole,
            full_name:
              profile?.full_name ||
              session.user.user_metadata?.full_name ||
              (chosenRole === 'caregiver' ? 'Caregiver' : 'User'),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        await supabase.auth.updateUser({
          data: {
            role: chosenRole,
          },
        });

        if (error) {
          console.warn('[role-selection] Profile upsert error:', error);
        }
        await refreshProfile();
      }

      if (chosenRole === 'patient') {
        router.replace('/(tabs)/patient-dashboard');
      } else {
        router.replace('/(tabs)/caregiver-dashboard');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select role.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleLogout = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', 'Failed to log out.');
    } else {
      router.replace('/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <BackButton
          fallbackRoute={
            profile?.role === 'patient'
              ? '/(tabs)/patient-dashboard'
              : profile?.role
              ? '/(tabs)/caregiver-dashboard'
              : '/login'
          }
        />
      </View>

      <View style={styles.content}>
        {/* Vectorized Branded Logo */}
        <View style={styles.logoWrapper}>
          <MedSyncLogo size={54} variant="stacked" animated={true} />
        </View>

        <Text style={styles.headerText}>How will you use MedSync?</Text>
        <Text style={styles.subHeaderText}>
          Choose your role for a tailored, senior-accessible healthcare experience.
        </Text>

        {savingRole && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={Theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.loadingBannerText}>Configuring your workspace...</Text>
          </View>
        )}

        <View style={styles.cardContainer}>
          {/* Patient Option */}
          <RoleOptionCard
            icon="person"
            title="I'm a Patient"
            desc="Large-font daily schedule, audio reminders, and 1-tap dose confirmation."
            badgeText="Daily Care"
            badgeColor="#E6F4F4"
            disabled={savingRole}
            onPress={() => handleSelectRole('patient')}
          />

          {/* Caregiver Option */}
          <RoleOptionCard
            icon="heart-half"
            title="I'm a Caregiver"
            desc="Surveillance dashboard, roster, prescription review & missed dose alerts. Verify doctor credentials anytime to unlock Physician status."
            badgeText="Care & Clinical"
            badgeColor="#FEF3C7"
            disabled={savingRole}
            onPress={() => handleSelectRole('caregiver')}
          />
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out of account"
      >
        <Ionicons name="log-out-outline" size={18} color={Theme.colors.error} style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Sign Out & Switch Account</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 14,
  },
  headerText: {
    fontFamily: 'PublicSans-ExtraBold',
    fontSize: 21,
    color: Theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 4,
  },
  subHeaderText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#0D7377',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  loadingBannerText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: '#0D7377',
  },
  cardContainer: {
    width: '100%',
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Theme.shadows.cardElevated,
  },
  iconPlate: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  roleTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  miniBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 9.5,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  roleDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.onSurfaceVariant,
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  logoutText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13,
    color: Theme.colors.error,
  },
});