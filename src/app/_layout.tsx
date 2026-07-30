import '../global.css';

import { DarkTheme, Redirect, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { WelcomeScreen } from '@/components/mixology/WelcomeScreen';
import { ContentProvider } from '@/state/ContentState';
import { AuthenticatedMixologyBridge } from '@/state/AuthenticatedMixologyBridge';
import { AiProvider } from '@/state/AiState';
import { AuthProvider, useAuth } from '@/state/AuthState';
import { MixologyProvider, useMixology } from '@/state/MixologyState';
import { colors } from '@/styles/mixologyTheme';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { isHydrated, localState } = useMixology();
  const { status } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (isHydrated) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated]);

  if (!isHydrated || status === 'restoring') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.pink} />
        <Text style={styles.loadingText}>正在读取本地隐私设置</Text>
      </View>
    );
  }

  if (!localState.ageVerified) {
    return <WelcomeScreen />;
  }

  if (pathname === '/ai' && status !== 'signedIn') {
    return <Redirect href="/login" />;
  }

  return <AppTabs />;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <ContentProvider>
        <AuthProvider>
          <MixologyProvider>
            <AuthenticatedMixologyBridge>
              <AiProvider>
                <RootContent />
              </AiProvider>
            </AuthenticatedMixologyBridge>
          </MixologyProvider>
        </AuthProvider>
      </ContentProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});
