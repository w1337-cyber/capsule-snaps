import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, type RootStack } from '../session';
import { subscribeSnaps, mediaUrl, type Group, type Snap } from '../api';
import { C, shortLeft } from '../theme';
import { Icon } from '../icons';
import { Header, TabBar, s } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Memories'>;
const CARD = (Dimensions.get('window').width - 28 - 10) / 2;

export default function MemoriesScreen({ navigation }: Props) {
  const { groups } = useSession();
  const now = Date.now();
  const opened = groups.filter((g) => g.unlockAt <= now).sort((a, b) => b.unlockAt - a.unlockAt);
  const sealed = groups.filter((g) => g.unlockAt > now);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header title="Memories" />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {!groups.length && (
            <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
              <Text style={s.h2}>Nothing here yet</Text>
              <Text style={[s.muted, { textAlign: 'center' }]}>When a group opens, its snaps show up here to watch back.</Text>
            </View>
          )}
          {opened.length > 0 && <Text style={st.sect}>Opened</Text>}
          <View style={st.grid}>{opened.map((g) => <OpenCard key={g.id} g={g} onPress={(n) => n && navigation.navigate('Viewer', { groupId: g.id, start: 0 })} />)}</View>
          {sealed.length > 0 && <Text style={st.sect}>Still sealed</Text>}
          <View style={st.grid}>{sealed.map((g) => <SealedCard key={g.id} g={g} onPress={() => navigation.navigate('Thread', { id: g.id })} />)}</View>
        </ScrollView>
      </SafeAreaView>
      <TabBar current="Memories" />
    </View>
  );
}

function useSnaps(gid: string) {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  useEffect(() => subscribeSnaps(gid, setSnaps, () => {}), [gid]);
  return snaps;
}

function OpenCard({ g, onPress }: { g: Group; onPress: (count: number) => void }) {
  const snaps = useSnaps(g.id);
  const [cover, setCover] = useState<string | null>(null);
  const first = snaps.find((x) => x.kind === 'image');
  useEffect(() => { if (first) mediaUrl(first.path).then(setCover).catch(() => {}); }, [first?.path]);
  return (
    <Pressable onPress={() => onPress(snaps.length)} style={st.card}>
      {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <View style={[StyleSheet.absoluteFill, st.center]}><Text style={{ fontSize: 40 }}>{g.emoji}</Text></View>}
      <View style={st.overlay}>
        <Text style={st.cardTitle} numberOfLines={1}>{g.name}</Text>
        <Text style={st.cardSub}>{snaps.length} snaps · {new Date(g.unlockAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
      </View>
    </Pressable>
  );
}

function SealedCard({ g, onPress }: { g: Group; onPress: () => void }) {
  const snaps = useSnaps(g.id);
  return (
    <Pressable onPress={onPress} style={[st.card, st.sealed]}>
      <Text style={{ fontSize: 34 }}>{g.emoji}</Text>
      <View>
        <Text style={[st.cardTitle, { color: C.text }]} numberOfLines={1}>{g.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="lock" size={12} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '800', fontSize: 12 }}>{snaps.length} sealed · {shortLeft(g.unlockAt)} left</Text>
        </View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  sect: { color: C.muted, fontWeight: '900', fontSize: 13, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 },
  card: { width: CARD, height: CARD * 1.33, borderRadius: 16, overflow: 'hidden', backgroundColor: C.soft },
  sealed: { padding: 12, justifyContent: 'space-between', borderWidth: 1, borderColor: C.line, backgroundColor: '#f7f7f8' },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  cardTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cardSub: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 12 },
});
