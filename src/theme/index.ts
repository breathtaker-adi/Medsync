// src/theme/index.ts
export const Theme = {
  colors: {
    surface: '#F8FAFB',
    surfaceDim: '#ECEFF1',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F4F7F8',
    surfaceContainer: '#EDF2F4',
    surfaceContainerHigh: '#E2E8F0',
    surfaceContainerHighest: '#CBD5E1',
    onSurface: '#0F172A',
    onSurfaceVariant: '#334155',
    outline: '#64748B',
    outlineVariant: '#CBD5E1',
    onSecondaryContainer: '#261a00',

    primary: '#00595C',
    onPrimary: '#FFFFFF',
    primaryContainer: '#0D7377',
    primarySoft: '#E6F4F4',

    secondary: '#795900',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFBF00', // Alert/Warning Amber
    secondarySoft: '#FEF9C3',

    error: '#DC2626',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',

    success: '#057A55',
    onSuccess: '#FFFFFF',
    successContainer: '#D1E7DD',
    onSuccessContainer: '#0F5132',
    successSoft: '#ECFDF5',

    danger: '#C62828',
    dangerSoft: '#FEF2F2',

    // Period colors for Elderly Schedule distinction
    periods: {
      morning: {
        bg: '#FEF3C7',
        border: '#FDE68A',
        text: '#92400E',
        icon: '#D97706',
      },
      afternoon: {
        bg: '#E0F2FE',
        border: '#BAE6FD',
        text: '#0369A1',
        icon: '#0284C7',
      },
      evening: {
        bg: '#FFEDD5',
        border: '#FED7AA',
        text: '#C2410C',
        icon: '#EA580C',
      },
      night: {
        bg: '#EDE9FE',
        border: '#DDD6FE',
        text: '#6D28D9',
        icon: '#7C3AED',
      },
    },
  },

  typography: {
    headlineXl: { fontFamily: 'PublicSans-ExtraBold', fontSize: 24, lineHeight: 30 },
    headlineLg: { fontFamily: 'PublicSans-Bold', fontSize: 20, lineHeight: 26 },
    headlineMd: { fontFamily: 'PublicSans-Bold', fontSize: 17, lineHeight: 22 },
    bodyXl: { fontFamily: 'PublicSans-Medium', fontSize: 16, lineHeight: 22 },
    bodyLg: { fontFamily: 'PublicSans-Medium', fontSize: 15, lineHeight: 20 },
    bodyMd: { fontFamily: 'PublicSans-Regular', fontSize: 13.5, lineHeight: 18 },
    bodySm: { fontFamily: 'PublicSans-Regular', fontSize: 12, lineHeight: 16 },
    labelBold: { fontFamily: 'PublicSans-Bold', fontSize: 13.5, lineHeight: 18, letterSpacing: 0.2 },
    labelLarge: { fontFamily: 'PublicSans-ExtraBold', fontSize: 15, lineHeight: 20, letterSpacing: 0.3 },
    timeDisplay: { fontFamily: 'PublicSans-ExtraBold', fontSize: 24, lineHeight: 30 },
  },

  spacing: {
    touchTargetMin: 42,
    touchTargetSenior: 46, // Ergonomic mobile button height
    pageMargin: 14,
    gutterCard: 12,
    stackGap: 10,
  },

  rounded: {
    sm: 6,
    DEFAULT: 10,
    md: 14,
    lg: 18,
    xl: 26,
    full: 9999,
  },

  shadows: {
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 3,
    },
    cardElevated: {
      shadowColor: '#00595C',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
    button: {
      shadowColor: '#00595C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 4,
    },
    level1: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    level2: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    level3: {
      shadowColor: '#00595C',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  elevation: {
    level1: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    level2: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    level3: {
      shadowColor: '#00595C',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};