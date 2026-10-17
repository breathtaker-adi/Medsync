// src/app/role-selection.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../theme';
import { supabase } from '../lib/supabase';
import { MedSyncLogo } from '../components/MedSyncLogo';
import { BackButton } from '../components/BackButton';

const RoleOptionCard = ({
  icon,
  title,
  desc,
  badgeText,
  badgeColor,
  onPress,
}: {
  icon: any;
  title: string;
  desc: string;
  badgeText: string;
  badgeColor: string;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 14, stiffness: 220 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 14, stiffness: 220 });
  };

  const handlePress = () => {
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
        style={styles.roleCard}
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
        <BackButton fallbackRoute="/(tabs)" />
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

        <View style={styles.cardContainer}>
          {/* Patient Option */}
          <RoleOptionCard
            icon="person"
            title="I'm a Patient"
            desc="Large-font daily schedule, audio reminders, and 1-tap dose confirmation."
            badgeText="Daily Care"
            badgeColor="#E6F4F4"
            onPress={() => router.replace('/(tabs)/patient-dashboard')}
          />

          {/* Caregiver Option */}
          <RoleOptionCard
            icon="shield-checkmark"
            title="I'm a Caregiver"
            desc="Review prescriptions, monitor compliance streaks, and receive missed dose alerts."
            badgeText="Supervision"
            badgeColor="#FEF3C7"
            onPress={() => router.replace('/(tabs)/caregiver-dashboard')}
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
    marginBottom: 20,
    paddingHorizontal: 8,
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
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roleTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  miniBadge: {
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 10,
    color: Theme.colors.primary,
  },
  roleDesc: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Theme.colors.onSurfaceVariant,
  },
  chevronWrapper: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: Theme.colors.error,
  },
});