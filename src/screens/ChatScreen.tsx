import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, type RootStack } from '../session';
import { subscribeSnaps, subscribeLastMsg, namesFor, type Group, type Msg, type Snap } from '../api';
import { C, ago, shortLeft } from '../theme';
import { Icon } from '../icons';
import { Btn, GroupAvatar, Header, IconBtn, MeAvatar, Square, TabBar, s } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Chat'>;

export default function ChatScreen({ navigation }: Props) {
  const { groups, groupsLoaded } = useSession();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  const list = groups
    .filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (activity[b.id] ?? 0) - (activity[a.id] ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header
          title="Chat"
          left={<><MeAvatar /><IconBtn name="search" label="Search" onPress={() => setSearching((x) => !x)} /></>}
          right={<IconBtn name="newchat" label="New chat" onPress={() => navigation.navigate('NewChat')} />}
        />
        {searching && (
          <View style={st.search}>
            <Icon name="search" size={16} color={C.muted} />
            <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search groups" placeholderTextColor={C.muted} style={st.searchInput} />
          </View>
        )}
        <FlatList
          data={list}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={groupsLoaded ? (
            q ? <Text style={[s.muted, { padding: 16 }]}>No groups match.</Text> : (
              <View style={st.empty}>
                <View style={st.emptyIcon}><Icon name="group" size={34} color={C.text} /></View>
                <Text style={s.h2}>No groups yet</Text>
                <Text style={[s.muted, { textAlign: 'center' }]}>Make a group, pick when it opens, and snap away. Nobody sees anything until then.</Text>
                <Btn title="New Group" onPress={() => navigation.navigate('NewGroup')} style={{ marginTop: 6 }} />
              </View>
            )
          ) : <Text style={[s.muted, { padding: 16 }]}>Loading…</Text>}
          renderItem={({ item }) => (
            <ChatRow g={item}
              onActivity={(at) => setActivity((a) => (a[item.id] === at ? a : { ...a, [item.id]: at }))}
              onOpen={() => navigation.navigate('Thread', { id: item.id })}
              onSnap={() => navigation.replace('Camera', { preselect: item.id })} />
          )}
        />
      </SafeAreaView>
      <TabBar current="Chat" />
    </View>
  );
}

function ChatRow({ g, onOpen, onSnap, onActivity }: { g: Group; onOpen: () => void; onSnap: () => void; onActivity: (at: number) => void }) {
  const { uid } = useSession();
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [last, setLast] = useState<Msg | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => subscribeSnaps(g.id, setSnaps, () => {}), [g.id]);
  useEffect(() => subscribeLastMsg(g.id, async (m) => { setLast(m); if (m) setNames(await namesFor([m.by])); }), [g.id]);

  const lastSnapAt = snaps.length ? snaps[snaps.length - 1].at : 0;
  const lastAt = Math.max(lastSnapAt, last?.at ?? 0);
  useEffect(() => { onActivity(lastAt); }, [lastAt]);

  const open = g.unlockAt <= Date.now();
  const n = snaps.length;
  let sq: 'sealed' | 'open' | 'chat' | 'empty' = 'empty';
  let line: React.ReactNode = `Tap to snap · opens in ${shortLeft(g.unlockAt)}`;
  if (open) {
    sq = n ? 'open' : 'empty';
    line = n ? <><Text style={{ color: C.open, fontWeight: '800' }}>Opened</Text> · {n} snap{n === 1 ? '' : 's'} to watch</> : 'Opened · nothing was sealed';
  } else if (last && last.at >= lastSnapAt) {
    sq = 'chat';
    line = <><Text style={{ color: C.chat, fontWeight: '800' }}>{last.by === uid ? 'Me' : names[last.by] || 'Friend'}:</Text> {last.text} · {ago(last.at)}</>;
  } else if (n) {
    sq = 'sealed';
    line = <><Text style={{ color: C.accent, fontWeight: '800' }}>{n} sealed</Text> · opens in {shortLeft(g.unlockAt)} · {ago(lastSnapAt)}</>;
  }

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.soft }]}>
      <GroupAvatar g={g} size={50} />
      <View style={st.meta}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>{g.name}</Text>
          <View style={st.statusRow}>
            <Square kind={sq} />
            <Text style={st.status} numberOfLines={1}>{line}</Text>
          </View>
        </View>
        {!open && (
          <Pressable accessibilityLabel={`Snap to ${g.name}`} onPress={onSnap} hitSlop={10} style={{ padding: 6 }}>
            <Icon name="camera" size={22} color={C.faint} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.soft, borderRadius: 12, marginHorizontal: 14, marginBottom: 6, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  meta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  name: { color: C.text, fontWeight: '800', fontSize: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  status: { flex: 1, color: C.muted, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 8, paddingHorizontal: 36, paddingTop: 70 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
