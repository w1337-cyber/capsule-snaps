import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, type RootStack } from '../session';
import { sendSnap } from '../api';
import { C, shortLeft } from '../theme';
import { Icon } from '../icons';
import { Btn, GroupAvatar, Header, IconBtn, Square, s } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'SendTo'>;

export default function SendToScreen({ navigation, route }: Props) {
  const { media, caption, preselect } = route.params;
  const insets = useSafeAreaInsets();
  const { uid, groups } = useSession();
  const locked = useMemo(() => groups.filter((g) => g.unlockAt > Date.now()), [groups]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>(
    preselect && locked.some((g) => g.id === preselect) ? [preselect] : locked.length === 1 ? [locked[0].id] : [],
  );
  const [progress, setProgress] = useState<number | null>(null);
  const list = locked.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function send() {
    const total = picked.length * media.length;
    let done = 0; const failed = new Set<string>();
    setProgress(0);
    for (const gid of picked) {
      for (const m of media) {
        try { await sendSnap(uid, gid, m, caption, (p) => setProgress((done + p) / total)); }
        catch { failed.add(groups.find((g) => g.id === gid)?.name || 'a group'); }
        done++; setProgress(done / total);
      }
    }
    setProgress(null);
    if (failed.size) {
      Alert.alert('Some snaps didn’t send', `Couldn’t send to ${[...failed].join(', ')}. Check your connection and try again.`);
      return;
    }
    // Land in the chat, like after sending a snap
    const routes: any[] = [{ name: 'Chat' }];
    if (picked.length === 1) routes.push({ name: 'Thread', params: { id: picked[0] } });
    navigation.dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <Header title="Send To" left={<IconBtn name="back" label="Back" onPress={() => navigation.goBack()} />} />
      <View style={st.search}>
        <Icon name="search" size={16} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={C.muted} style={st.searchInput} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={locked.length ? <Text style={st.sect}>Groups</Text> : null}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        ListEmptyComponent={!locked.length ? (
          <View style={{ alignItems: 'center', gap: 10, padding: 40 }}>
            <Text style={s.h2}>No groups yet</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>Make a group first, then send your snap to it.</Text>
            <Btn title="New Group" onPress={() => navigation.navigate('NewGroup')} />
          </View>
        ) : <Text style={[s.muted, { padding: 16 }]}>No groups match.</Text>}
        renderItem={({ item: g }) => {
          const on = picked.includes(g.id);
          return (
            <Pressable onPress={() => toggle(g.id)} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.soft }]}>
              <GroupAvatar g={g} size={46} />
              <View style={st.rowMeta}>
                <View style={{ flex: 1 }}>
                  <Text style={st.name} numberOfLines={1}>{g.name}</Text>
                  <View style={st.statusRow}><Square kind="sealed" /><Text style={st.status}>opens in {shortLeft(g.unlockAt)}</Text></View>
                </View>
                <View style={[st.pick, on && st.pickOn]}>{on && <Icon name="check" size={14} color="#fff" />}</View>
              </View>
            </Pressable>
          );
        }}
      />

      {picked.length > 0 && (
        <View>
          {progress !== null && <View style={st.track}><View style={[st.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>}
          <View style={[st.sendBar, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={st.sendNames} numberOfLines={1}>
              {picked.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ')}
            </Text>
            <Pressable accessibilityLabel="Seal and send" onPress={send} disabled={progress !== null} style={st.sendBtn}>
              <Icon name="send" size={20} color={C.accent} />
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.soft, borderRadius: 12, marginHorizontal: 14, marginBottom: 4, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text },
  sect: { color: C.muted, fontWeight: '900', fontSize: 13, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  rowMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  name: { color: C.text, fontWeight: '800', fontSize: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  status: { color: C.muted, fontSize: 13, fontWeight: '600' },
  pick: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#c7c9ce', alignItems: 'center', justifyContent: 'center' },
  pickOn: { backgroundColor: C.accent, borderColor: C.accent },
  track: { height: 4, backgroundColor: '#ffd3b8' },
  fill: { height: 4, backgroundColor: C.accentDark },
  sendBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.accent, paddingHorizontal: 14, paddingTop: 12 },
  sendNames: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
