import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStack } from '../session';
import type { Media } from '../api';
import { C } from '../theme';
import { Icon } from '../icons';
import { IconBtn, MeAvatar, TabBar } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Camera'>;
const MAX_VIDEO_SEC = 60;

export default function CameraScreen({ navigation, route }: Props) {
  const preselect = route.params?.preselect;
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recording) { setSecs(0); progress.setValue(0); return; }
    Animated.timing(progress, { toValue: 1, duration: MAX_VIDEO_SEC * 1000, useNativeDriver: false }).start();
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const toPreview = (media: Media[]) => navigation.navigate('Preview', { media, preselect });

  async function shoot() {
    if (!videoMode) {
      const p = await cam.current?.takePictureAsync({ quality: 0.85 });
      if (p?.uri) toPreview([{ uri: p.uri, kind: 'image', mimeType: 'image/jpeg' }]);
      return;
    }
    if (recording) { cam.current?.stopRecording(); return; }
    if (!mic?.granted) { const r = await requestMic(); if (!r.granted) return; }
    setRecording(true);
    try {
      const v = await cam.current?.recordAsync({ maxDuration: MAX_VIDEO_SEC });
      if (v?.uri) toPreview([{ uri: v.uri, kind: 'video' }]);
    } finally { setRecording(false); }
  }

  async function pickFromLibrary() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 20, quality: 0.85, videoMaxDuration: MAX_VIDEO_SEC,
    });
    if (r.canceled || !r.assets.length) return;
    toPreview(r.assets.map((a) => ({ uri: a.uri, kind: a.type === 'video' ? 'video' : 'image', mimeType: a.mimeType ?? undefined })));
  }

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={st.fill}>
      <StatusBar style="light" />
      <View style={st.fill}>
        {perm?.granted && focused && (
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'}
            mode={videoMode ? 'video' : 'picture'} enableTorch={flash && facing === 'back'} videoQuality="1080p" />
        )}

        {perm && !perm.granted && (
          <View style={st.permBox}>
            <Text style={st.permTitle}>Turn on your camera</Text>
            <Text style={st.permBody}>So you can snap moments for your groups.</Text>
            <Pressable style={st.permBtn} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Allow camera</Text>
            </Pressable>
          </View>
        )}

        {/* top: avatar + search left, tool rail right */}
        <View style={[st.top, { paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <MeAvatar size={40} />
            <IconBtn dark name="search" label="Find a group" size={40} onPress={() => navigation.replace('Chat')} />
          </View>
          <View style={st.rail}>
            <RailBtn icon="flip" label="Flip camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
            <RailBtn icon={flash ? 'flash' : 'flashOff'} label="Flash" onPress={() => setFlash((f) => !f)} />
            <RailBtn icon="video" label={videoMode ? 'Switch to photo' : 'Switch to video'} active={videoMode} onPress={() => !recording && setVideoMode((v) => !v)} />
          </View>
        </View>

        {recording && (
          <View style={[st.recPill, { top: insets.top + 14 }]}><View style={st.recDot} /><Text style={st.recText}>{secs}s</Text></View>
        )}

        {/* shutter row */}
        <View style={st.bottom}>
          {recording && <View style={st.track}><Animated.View style={[st.trackFill, { width }]} /></View>}
          <View style={st.shutterRow}>
            <Pressable accessibilityLabel="Pick from your photos" onPress={pickFromLibrary} style={st.side} hitSlop={8}>
              <Icon name="gallery" size={28} color="#fff" />
            </Pressable>
            <Pressable accessibilityLabel={videoMode ? (recording ? 'Stop recording' : 'Record video') : 'Take a snap'} onPress={shoot}
              style={({ pressed }) => [st.shutter, videoMode && { borderColor: '#ff3b30' }, pressed && { transform: [{ scale: 0.92 }] }]}>
              {videoMode && <View style={[st.recInner, recording && st.recStop]} />}
            </Pressable>
            <View style={st.side} />
          </View>
        </View>
      </View>
      <TabBar current="Camera" dark />
    </View>
  );
}

function RailBtn({ icon, label, onPress, active }: { icon: 'flip' | 'flash' | 'flashOff' | 'video'; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={6} style={[st.railBtn, active && { backgroundColor: C.accent }]}>
      <Icon name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rail: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 24, padding: 6, gap: 6 },
  railBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  recPill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff3b30' },
  recText: { color: '#fff', fontWeight: '900' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center', gap: 14 },
  track: { width: '70%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: '#ff3b30' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 6, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recInner: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ff3b30' },
  recStop: { width: 26, height: 26, borderRadius: 6 },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  permTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  permBody: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center' },
  permBtn: { backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 13, marginTop: 8 },
});
