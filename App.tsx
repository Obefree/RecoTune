import React, { Suspense } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { TabBarVisibilityProvider, useTabBarVisibility } from './src/context/TabBarVisibility';
import { LocaleProvider } from './src/context/LocaleContext';
import SnippetAnalyzerEngine from './src/components/SnippetAnalyzerEngine';
import ExpoAvRequiredScreen from './src/screens/ExpoAvRequiredScreen';
import { initMediaRemoteControls } from './src/utils/mediaRemoteControls';
import { initSongLibrary } from './src/services/initSongLibrary';
import { ensureAutoChordProxySettings } from './src/providers/autoChordProxy';
import { isExpoAvNativeAvailable } from './src/utils/expoAvAvailable';

/** Lazy tabs — expo-av throws at import when ExponentAV is missing (Expo Go SDK 55+). */
const TunerScreen = React.lazy(() => import('./src/screens/TunerScreen'));
const StudioScreen = React.lazy(() => import('./src/screens/StudioScreen'));
const ChordsScreen = React.lazy(() => import('./src/screens/ChordsScreen'));
const MelodyScreen = React.lazy(() => import('./src/screens/MelodyScreen'));
const MediaScreen = React.lazy(() => import('./src/screens/MediaScreen'));
const AILabScreen = React.lazy(() => import('./src/screens/AILabScreen'));

const Tab = createBottomTabNavigator();

const DARK_BG = '#0a0a0f';
/** Как фон экрана — иначе под Chords видна «лишняя» тёмная полоса между контентом и системной зоной */
const TAB_BG = DARK_BG;
const BORDER = '#1e1e2a';
const ACTIVE = '#00e676';
const INACTIVE = '#3a3a4a';

function AppInner() {
  const insets = useSafeAreaInsets();
  const { tabBarHidden } = useTabBarVisibility();

  React.useEffect(() => {
    initMediaRemoteControls();
    initSongLibrary().catch((err) => {
      if (__DEV__) console.warn('[RecoTune] initSongLibrary failed on mount', err);
    });
    ensureAutoChordProxySettings().catch((err) => {
      if (__DEV__) console.warn('[RecoTune] auto chord proxy settings failed', err);
    });
  }, []);
  const tabBarHeight = tabBarHidden ? 0 : 56 + insets.bottom;

  const tabSafeInsets = React.useMemo(
    () => ({
      top: insets.top,
      left: insets.left,
      right: insets.right,
      bottom: 0,
    }),
    [insets.top, insets.left, insets.right],
  );

  return (
    <View style={[styles.root, { backgroundColor: DARK_BG }]}>
      <View style={[styles.navFill, { backgroundColor: DARK_BG }]}>
      <Suspense fallback={<View style={styles.bootFallback}><ActivityIndicator color={ACTIVE} /></View>}>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: ACTIVE,
            background: DARK_BG,
            card: TAB_BG,
            text: '#e0e0e0',
            border: BORDER,
            notification: '#ff5252',
          },
          fonts: {
            regular: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontWeight: '400' },
            medium: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontWeight: '500' },
            bold: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontWeight: '700' },
            heavy: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', fontWeight: '900' },
          },
        }}
      >
        <Tab.Navigator
          /* Android Back: previous tab, not always Tuner (overlays handled in screens) */
          backBehavior="history"
          /* Сцена не должна дублировать нижний safe area — его даёт tabBarStyle.paddingBottom */
          safeAreaInsets={tabSafeInsets}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: TAB_BG,
              borderTopColor: BORDER,
              borderTopWidth: tabBarHidden ? 0 : 1,
              height: tabBarHeight,
              paddingBottom: tabBarHidden ? 0 : insets.bottom || 8,
              paddingTop: tabBarHidden ? 0 : 4,
              display: tabBarHidden ? 'none' : 'flex',
              overflow: 'hidden',
            },
            tabBarInactiveTintColor: INACTIVE,
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 1,
              textTransform: 'uppercase',
            },
            tabBarIcon: ({ focused, color, size }) => {
              type IoniconName = keyof typeof Ionicons.glyphMap;
              const icons: Record<string, [IoniconName, IoniconName]> = {
                Tuner:    ['musical-notes', 'musical-notes-outline'],
                Studio:   ['layers', 'layers-outline'],
                Chords:   ['musical-note', 'musical-note-outline'],
                Melody:   ['pulse', 'pulse-outline'],
                Media:    ['albums', 'albums-outline'],
                AILab:    ['flask', 'flask-outline'],
              };
              const [on, off] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
              const iconName = focused ? on : off;
              const activeColor = route.name === 'Melody' ? '#7c4dff'
                : route.name === 'Media'   ? '#40c4ff'
                : route.name === 'Chords'  ? '#ff9800'
                : route.name === 'AILab'   ? '#00bcd4' : ACTIVE;
              return (
                <View style={{
                  width: 36, height: 26, alignItems: 'center', justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: focused ? `${activeColor}22` : 'transparent',
                }}>
                  <Ionicons name={iconName} size={size - 2} color={color} />
                </View>
              );
            },
            tabBarActiveTintColor: (() => {
              if (route.name === 'Melody') return '#7c4dff';
              if (route.name === 'Media')  return '#40c4ff';
              if (route.name === 'Chords') return '#ff9800';
              if (route.name === 'AILab')  return '#00bcd4';
              return ACTIVE;
            })(),
          })}
        >
          <Tab.Screen name="Tuner"    component={TunerScreen} />
          <Tab.Screen name="Studio"   component={StudioScreen} />
          <Tab.Screen name="Chords"   component={ChordsScreen} />
          <Tab.Screen name="Melody"   component={MelodyScreen} options={{ title: 'Melody' }} />
          <Tab.Screen name="Media"    component={MediaScreen}  options={{ title: 'Media' }} />
          <Tab.Screen name="AILab"    component={AILabScreen}  options={{ title: 'AI Lab' }} />
        </Tab.Navigator>
      </NavigationContainer>
      </Suspense>
      </View>
      {/* WebView вне flex-колонки с навигатором — иначе на Android ~50% экрана «белая зона» и таб-бар посередине */}
      <View style={styles.analyzerOverlay} pointerEvents="box-none">
        <SnippetAnalyzerEngine />
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navFill: { flex: 1 },
  bootFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG },
  analyzerOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

export default function App() {
  if (!isExpoAvNativeAvailable()) {
    return (
      <SafeAreaProvider style={{ flex: 1 }}>
        <ExpoAvRequiredScreen />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <LocaleProvider>
          <TabBarVisibilityProvider>
            <AppInner />
          </TabBarVisibilityProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
