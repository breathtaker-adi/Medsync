// src/components/ErrorBoundary.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { crashReporter } from '../lib/crashReporter';
import { Theme } from '../theme';
import { SeniorButton } from './SeniorButton';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    crashReporter.captureException(error, { componentStack: errorInfo.componentStack });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconPlate}>
              <Ionicons name="alert-circle" size={44} color={Theme.colors.error} />
            </View>

            <Text style={styles.title}>Something Went Wrong</Text>
            <Text style={styles.subtitle}>
              MedSync encountered an unexpected issue while rendering this view.
            </Text>

            <View style={styles.buttonWrapper}>
              <SeniorButton
                title="Try Again"
                onPress={this.handleReset}
                variant="primary"
                size="normal"
                icon={<Ionicons name="refresh" size={20} color="#FFFFFF" />}
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: Theme.colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.outlineVariant,
    ...Theme.shadows.cardElevated,
  },
  iconPlate: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 22,
    color: Theme.colors.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonWrapper: {
    width: '100%',
  },
});

export default ErrorBoundary;
