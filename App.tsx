import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { TabBarVisibilityProvider, useTabBarVisibility } from './src/context/TabBarVisibility';
import TunerScreen from './src/screens/TunerScreen';
import RecorderScreen from './src/screens/RecorderScreen';
import StudioScreen from './src/screens/StudioScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import VideoScreen from './src/screens/VideoScreen';
import ChordsScreen from './src/screens/ChordsScreen';
import AILabScreen from './src/screens/AILabScreen';

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
    <View style={{ flex: 1 }}>
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
                Recorder: ['mic', 'mic-outline'],
                Studio:   ['layers', 'layers-outline'],
                Player:   ['headset', 'headset-outline'],
                Video:    ['film', 'film-outline'],
                Chords:   ['musical-note', 'musical-note-outline'],
                AILab:    ['flask', 'flask-outline'],
              };
              const [on, off] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
              const iconName = focused ? on : off;
              const activeColor = route.name === 'Player' ? '#7c4dff'
                : route.name === 'Video'   ? '#40c4ff'
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
              if (route.name === 'Player') return '#7c4dff';
              if (route.name === 'Video')  return '#40c4ff';
              if (route.name === 'Chords') return '#ff9800';
              if (route.name === 'AILab')  return '#00bcd4';
              return ACTIVE;
            })(),
          })}
        >
          <Tab.Screen name="Tuner"    component={TunerScreen} />
          <Tab.Screen name="Recorder" component={RecorderScreen} />
          <Tab.Screen name="Studio"   component={StudioScreen} />
          <Tab.Screen name="Player"   component={PlayerScreen} />
          <Tab.Screen name="Video"    component={VideoScreen} />
          <Tab.Screen name="Chords"   component={ChordsScreen} />
          <Tab.Screen name="AILab"    component={AILabScreen}  options={{ title: 'AI Lab' }} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <TabBarVisibilityProvider>
          <AppInner />
        </TabBarVisibilityProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
