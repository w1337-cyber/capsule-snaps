import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isConfigured } from './src/firebase';
import { waitForUser, getMyName, subscribeMyGroups, askNotificationPermission, type Group } from './src/api';
import { SessionCtx, type RootStack } from './src/session';
import { C } from './src/theme';
import Onboarding from './src/screens/Onboarding';
import CameraScreen from './src/screens/CameraScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import SendToScreen from './src/screens/SendToScreen';
import ChatScreen from './src/screens/ChatScreen';
import MemoriesScreen from './src/screens/MemoriesScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import NewGroupScreen from './src/screens/NewGroupScreen';
import JoinScreen from './src/screens/JoinScreen';
import ThreadScreen from './src/screens/ThreadScreen';
import ViewerScreen from './src/screens/ViewerScreen';

const Stack = createNativeStackNavigator<RootStack>();
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.text, primary: C.accent, border: C.line } };

export default function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  useEffect(() => {
    if (!isConfigured) { setErr('Firebase isn’t set up yet. Add your keys to .env (see README).'); return; }
    (async () => {
      try {
        const u = await waitForUser();
        setUid(u.uid);
        setName(await getMyName(u.uid));
        askNotificationPermission();
      } catch {
        setErr('Couldn’t sign in. Check your connection and that Anonymous sign-in is enabled in Firebase.');
      } finally { setReady(true); }
    })();
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeMyGroups(uid, (g) => { setGroups(g); setGroupsLoaded(true); }, () => setGroupsLoaded(true));
  }, [uid]);

  if (err) return <Center><Text style={{ color: C.text, textAlign: 'center', fontSize: 16, fontWeight: '600' }}>{err}</Text></Center>;
  if (!ready || !uid) return <Center><ActivityIndicator color={C.accent} /></Center>;

  return (
    <SafeAreaProvider>
      <SessionCtx.Provider value={{ uid, name: name || '', groups, groupsLoaded, setName }}>
        {!name ? (
          <Onboarding />
        ) : (
          <NavigationContainer theme={theme}>
            <Stack.Navigator initialRouteName="Camera" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
              {/* the three tabs swap instantly, like a camera app */}
              <Stack.Screen name="Camera" component={CameraScreen} options={{ animation: 'none', contentStyle: { backgroundColor: '#000' } }} />
              <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'none' }} />
              <Stack.Screen name="Memories" component={MemoriesScreen} options={{ animation: 'none' }} />
              <Stack.Screen name="Preview" component={PreviewScreen} options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
              <Stack.Screen name="SendTo" component={SendToScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="Thread" component={ThreadScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="NewChat" component={NewChatScreen} options={{ presentation: 'formSheet', sheetAllowedDetents: [0.36], sheetGrabberVisible: true }} />
              <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="Join" component={JoinScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="Viewer" component={ViewerScreen} options={{ animation: 'fade', presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#000' } }} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </SessionCtx.Provider>
    </SafeAreaProvider>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</View>;
}
