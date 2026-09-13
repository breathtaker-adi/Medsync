// src/theme/index.ts
export const Theme = {
  colors: {
    surface: '#fcf9f8',
    surfaceDim: '#dcd9d9',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f6f3f2',
    surfaceContainer: '#f0eded',
    surfaceContainerHigh: '#eae7e7',       // <-- Added here
    surfaceContainerHighest: '#e4e1e1',    // <-- Added here for MD3 completeness
    onSurface: '#1b1c1c',
    onSurfaceVariant: '#3e4949',
    outline: '#6e7979',
    outlineVariant: '#bec9c9',
    onSecondaryContainer: '#261a00',


    primary: '#00595c',
    onPrimary: '#ffffff',
    primaryContainer: '#0d7377',

    secondary: '#795900',
    onSecondary: '#ffffff',
    secondaryContainer: '#ffbf00', // Alert/Warning Amber

    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    successContainer: '#d1e7dd',   // <-- Added (Light green pill background)
    onSuccessContainer: '#0f5132',
    onErrorContainer: '#410002',

    // Semantic Colors from Design Doc
    success: '#2D7D46',
    danger: '#C62828',
  },
  typography: {
    headlineLg: { fontFamily: 'PublicSans-Bold', fontSize: 28, lineHeight: 36 },
    headlineMd: { fontFamily: 'PublicSans-Bold', fontSize: 22, lineHeight: 28 },
    bodyLg: { fontFamily: 'PublicSans-Medium', fontSize: 18, lineHeight: 26 },
    bodyMd: { fontFamily: 'PublicSans-Regular', fontSize: 16, lineHeight: 24 },
    labelBold: { fontFamily: 'PublicSans-Bold', fontSize: 16, lineHeight: 20, letterSpacing: 0.5 },
    timeDisplay: { fontFamily: 'PublicSans-ExtraBold', fontSize: 32, lineHeight: 40 },
  },
  spacing: {
    touchTargetMin: 48,
    pageMargin: 20,
    gutterCard: 16,
    stackGap: 12,
  },
  rounded: {
    sm: 4,
    DEFAULT: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};