// src/app/pending-reviews.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { prescriptionService } from '../services/prescriptionService';
import { Theme } from '../theme';
import { PendingReview } from '../types/review';
import { getPrescriptionPublicUrlSync, usePrescriptionImageUrl } from '../utils/prescriptionHelper';
import { Image } from 'expo-image';

function ReviewCardItem({
  item,
  isAccessibilityMode,
  isDoctor,
  triggerHaptic,
  onPress,
}: {
  item: PendingReview;
  isAccessibilityMode: boolean;
  isDoctor: boolean;
  triggerHaptic: () => void;
  onPress: () => void;
}) {
  const { url: thumbUrl } = usePrescriptionImageUrl(item.image_url);
  const isSuspectedNonRx =
    item.ocr_status === 'failed' ||
    item.medication?.includes('⚠️') ||
    item.medication?.toLowerCase().includes('unrecognized');

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isAccessibilityMode && styles.cardHighContrast,
        isSuspectedNonRx && styles.cardSuspect,
      ]}
      activeOpacity={0.8}
      onPress={() => {
        triggerHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Review prescription for ${item.patient_name}, medication ${item.medication}. Tap to inspect and approve.`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.patientBadge}>
          <Ionicons name="person-circle" size={18} color={Theme.colors.primary} />
          <Text style={styles.patientName} numberOfLines={1}>
            {item.patient_name || 'Patient'}
          </Text>
        </View>

        {isSuspectedNonRx ? (
          <View style={styles.suspectTag}>
            <Ionicons name="warning" size={13} color="#DC2626" />
            <Text style={styles.suspectTagText}>Inspect Photo</Text>
          </View>
        ) : (
          <View style={styles.ocrTag}>
            <MaterialCommunityIcons name="line-scan" size={13} color="#0D9488" />
            <Text style={styles.ocrTagText}>OCR Pre-Scanned</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        {thumbUrl ? (
          <View style={styles.thumbWrapper}>
            <Image
              source={{ uri: thumbUrl }}
              style={styles.thumbImage}
              contentFit="cover"
            />
            <View style={styles.thumbBadge}>
              <Ionicons name="document-text" size={10} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          <View style={styles.medIconWrap}>
            <Ionicons name="document-text" size={22} color="#0D9488" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[styles.medName, isAccessibilityMode && styles.largeText]} numberOfLines={1}>
            {item.medication || 'Prescription Slip Review'}
          </Text>
          <Text style={styles.dosageText} numberOfLines={1}>
            Dosage: {item.dosage || 'See uploaded slip'}
          </Text>
          {item.duration ? (
            <Text style={styles.durationText} numberOfLines={1}>
              Course: {item.duration}
            </Text>
          ) : null}
          {item.time_ago ? (
            <Text style={styles.timeAgoText}>Submitted {item.time_ago}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.ctaText}>
          {isDoctor ? 'Clinical Review & Sign-Off' : 'Inspect Photo & Approve Routine'}
        </Text>
        <Ionicons name="arrow-forward-circle" size={22} color={Theme.colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function PendingReviewsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { isAccessibilityMode, triggerHaptic } = useAccessibility();

  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReviews = useCallback(async () => {
    try {
      if (session?.user?.id) {
        const res = await prescriptionService.fetchPendingReviewsForCaregiver(session.user.id);
        if (res.success && res.data) {
          setReviews(res.data);
        } else {
          // Fallback direct query
          const { data } = await supabase
            .from('pending_reviews')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          setReviews((data as PendingReview[]) || []);
        }
      } else {
        const res = await prescriptionService.fetchPendingReviews();
        if (res.success && res.data) {
          setReviews(res.data);
        }
      }
    } catch (err) {
      console.warn('Error fetching pending reviews:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchReviews();

    // Subscribe to realtime changes in pending_reviews
    const channel = supabase
      .channel('pending-reviews-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_reviews' },
        () => {
          fetchReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReviews]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReviews();
  };

  const filteredReviews = reviews.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const medMatch = item.medication?.toLowerCase().includes(q);
    const patMatch = item.patient_name?.toLowerCase().includes(q);
    return medMatch || patMatch;
  });

  const isDoctor = profile?.role === 'doctor' || profile?.is_verified_doctor === true;

  const renderReviewItem = ({ item }: { item: PendingReview }) => (
    <ReviewCardItem
      item={item}
      isAccessibilityMode={isAccessibilityMode}
      isDoctor={isDoctor}
      triggerHaptic={triggerHaptic}
      onPress={() => router.push(`/review-details?id=${item.id}`)}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Pending Reviews"
        subtitle="Prescription OCR triage & verification"
        onBack={() => router.replace('/(tabs)/caregiver-dashboard')}
        fallbackRoute="/(tabs)/caregiver-dashboard"
      />

      {/* Info Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIconWrap}>
          <Ionicons name="shield-checkmark" size={22} color="#0D766E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>
            {reviews.length} {reviews.length === 1 ? 'Prescription' : 'Prescriptions'} Awaiting Sign-Off
          </Text>
          <Text style={styles.bannerSubtitle}>
            Review AI-extracted medication names, verify dosages, and approve to schedule alarms on the patient&apos;s device.
          </Text>
        </View>
      </View>

      {/* Search Input */}
      {reviews.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by patient or medicine name..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading prescription review queue...</Text>
        </View>
      ) : filteredReviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="checkmark-done-circle" size={52} color="#0D9488" />
          </View>
          <Text style={styles.emptyTitle}>Queue All Clear!</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? `No pending reviews matched "${searchQuery}".`
              : 'There are no prescription scans waiting for review. When patients scan prescription sheets in the Camera tab, they appear here instantly.'}
          </Text>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => router.replace('/(tabs)/caregiver-dashboard')}
          >
            <Text style={styles.returnBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderReviewItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Theme.colors.primary]}
              tintColor={Theme.colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#CCFBF1',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    padding: 14,
  },
  bannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#0F766E',
  },
  bannerSubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: '#115E59',
    marginTop: 2,
    lineHeight: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PublicSans-Regular',
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Theme.shadows.level1,
  },
  cardHighContrast: {
    borderColor: '#0D7377',
    borderWidth: 2,
  },
  cardSuspect: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  patientName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 13.5,
    color: '#0F172A',
  },
  ocrTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ocrTagText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#0D9488',
  },
  suspectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  suspectTagText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 11,
    color: '#DC2626',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  medIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#E6FFFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrapper: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(13, 148, 136, 0.85)',
    borderRadius: 4,
    padding: 2,
  },
  durationText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 12,
    color: '#0D9488',
    marginTop: 2,
  },
  medName: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 15,
    color: '#0F172A',
  },
  largeText: {
    fontSize: 17,
  },
  dosageText: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  timeAgoText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  ctaText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  loadingText: {
    fontFamily: 'PublicSans-Medium',
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  returnBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  returnBtnText: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
