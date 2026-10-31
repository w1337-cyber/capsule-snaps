import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useSession, type RootStack } from '../session';
import { subscribeSnaps, namesFor, mediaUrl, type Snap } from '../api';
import { C, fmtDate } from '../theme';
import { Avatar, IconBtn } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Viewer'>;
const PHOTO_MS = 5000;

export default function ViewerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { uid } = useSession();
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [i, setI] = useState(route.params.start);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => subscribeSnaps(route.params.groupId, async (l) => { setSnaps(l); setNames(await namesFor(l.map((x) => x.by))); }, () => {}), [route.params.groupId]);

  const snap = snaps[i];
  useEffect(() => {
    if (!snap) return;
    setUrl(null); setFailed(false);
    mediaUrl(snap.path).then(setUrl).catch(() => setFailed(true));
    // prefetch next
    const n = snaps[i + 1];
    if (n) mediaUrl(n.path).then((u) => n.kind === 'image' && Image.prefetch(u)).catch(() => {});
  }, [snap?.id]);

  const next = () => (i < snaps.length - 1 ? setI(i + 1) : navigation.goBack());
  const prev = () => i > 0 && setI(i - 1);

  // photos auto-advance like stories
  useEffect(() => {
    if (!snap || snap.kind !== 'image' || !url) return;
    const t = setTimeout(next, PHOTO_MS);
    return () => clearTimeout(t);
  }, [url, i]);

  if (!snap) return <View style={st.fill}><ActivityIndicator color="#fff" style={{ flex: 1 }} /></View>;
  const who = snap.by === uid ? 'Me' : names[snap.by] || '…';

  return (
    <View style={st.fill}>
      <StatusBar style="light" />
      {failed ? (
        <View style={[st.fill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: C.muted }}>This snap couldn’t load.</Text></View>
      ) : !url ? (
        <ActivityIndicator color="#fff" style={{ flex: 1 }} />
      ) : snap.kind === 'image' ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : (
        <VideoSnap key={snap.id} uri={url} onEnd={next} />
      )}

      {/* tap zones */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <Pressable style={{ flex: 1 }} onPress={prev} accessibilityLabel="Previous snap" />
        <Pressable style={{ flex: 2 }} onPress={next} accessibilityLabel="Next snap" />
      </View>

      {/* story bars */}
      <View style={[st.bars, { top: insets.top + 6 }]} pointerEvents="none">
        {snaps.length <= 80
          ? snaps.map((x, k) => <View key={x.id} style={[st.bar, k <= i && { backgroundColor: '#fff' }]} />)
          : <View style={[st.bar, { flex: 1 }]}><View style={{ width: `${((i + 1) / snaps.length) * 100}%`, height: 3, backgroundColor: '#fff' }} /></View>}
      </View>

      <View style={[st.top, { top: insets.top + 16 }]}>
        <Avatar id={snap.by} label={who} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={st.who}>{who}</Text>
          <Text style={st.when}>{fmtDate(snap.at)} · {i + 1}/{snaps.length}</Text>
        </View>
        <IconBtn dark name="close" label="Close" onPress={() => navigation.goBack()} />
      </View>

      {!!snap.caption && (
        <View style={st.captionWrap} pointerEvents="none"><Text style={st.caption}>{snap.caption}</Text></View>
      )}
    </View>
  );
}

function VideoSnap({ uri, onEnd }: { uri: string; onEnd: () => void }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; p.play(); });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const ended = useRef(false);
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => { if (!ended.current) { ended.current = true; onEnd(); } });
    return () => sub.remove();
  }, [player]);
  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      {status === 'loading' && <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} />}
    </>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  bars: { position: 'absolute', left: 8, right: 8, flexDirection: 'row', gap: 3 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { color: '#fff', fontWeight: '900', fontSize: 15, textShadowColor: '#000', textShadowRadius: 4 },
  when: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textShadowColor: '#000', textShadowRadius: 4 },
  captionWrap: { position: 'absolute', left: 0, right: 0, top: '62%', backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 10, paddingHorizontal: 16 },
  caption: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
});
