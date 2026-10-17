import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Theme } from '../theme';
import { BackButton, BackButtonProps } from './BackButton';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  fallbackRoute?: string;
  backButtonProps?: Partial<BackButtonProps>;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  fallbackRoute,
  backButtonProps,
  rightAction,
  style,
  titleStyle,
  subtitleStyle,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.leftContainer}>
        {showBack && (
          <BackButton
            onPress={onBack}
            fallbackRoute={fallbackRoute}
            {...backButtonProps}
            style={[styles.backButton, backButtonProps?.style]}
          />
        )}
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, titleStyle]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text
              style={[styles.subtitle, subtitleStyle]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {rightAction ? (
        <View style={styles.rightContainer}>{rightAction}</View>
      ) : (
        showBack ? <View style={styles.placeholder} /> : null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 6 : 4,
    paddingBottom: 8,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.outlineVariant,
    minHeight: 50,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  backButton: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 17,
    color: Theme.colors.onSurface,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  placeholder: {
    width: 0,
  },
});

export default ScreenHeader;
