import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, type RootStack } from '../session';
import { subscribeSnaps, subscribeMsgs, sendMsg, namesFor, type Msg, type Snap } from '../api';
import { C, colorOf, fmtDate, fmtDay, fmtShort, longLeft } from '../theme';
import { Icon } from '../icons';
import { Avatar, GroupAvatar, IconBtn, Square, s } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Thread'>;
type Item = ({ type: 'snap' } & Snap) | ({ type: 'msg' } & Msg);
type Block = { key: string; day?: string; by: string; items: Item[] };

export default function ThreadScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { uid, groups } = useSession();
  const g = groups.find((x) => x.id === id);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [info, setInfo] = useState(false);
  const [now, setNow] = useState(Date.now());
  const list = useRef<FlatList<Block>>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => subscribeSnaps(id, setSnaps, () => {}), [id]);
  useEffect(() => subscribeMsgs(id, setMsgs, () => {}), [id]);
  useEffect(() => { namesFor([...snaps.map((x) => x.by), ...msgs.map((x) => x.by), ...(g?.members ?? [])]).then(setNames); }, [snaps.length, msgs.length, g?.members.length]);

  // Group consecutive items by sender, with a day label when the day changes
  const blocks = useMemo(() => {
    const items: Item[] = [...snaps.map((x) => ({ ...x, type: 'snap' as const })), ...msgs.map((x) => ({ ...x, type: 'msg' as const }))].sort((a, b) => a.at - b.at);
    const out: Block[] = []; let lastDay = '';
    for (const it of items) {
      const day = new Date(it.at).toDateString();
      const prev = out[out.length - 1];
      if (day !== lastDay || !prev || prev.by !== it.by) {
        out.push({ key: it.id, day: day !== lastDay ? fmtDay(it.at) : undefined, by: it.by, items: [it] });
        lastDay = day;
      } else prev.items.push(it);
    }
    return out;
  }, [snaps, msgs]);

  if (!g) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={s.muted}>Loading…</Text>
        <Pressable onPress={() => navigation.goBack()}><Text style={{ color: C.accent, fontWeight: '800' }}>Back</Text></Pressable>
      </SafeAreaView>
    );
  }

  const open = now >= g.unlockAt;
  const who = (u: string) => (u === uid ? 'Me' : names[u] || 'Friend');
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Chat'));

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setText('');
    try { await sendMsg(uid, id, t); } catch { setText(t); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={st.head}>
          <IconBtn name="back" label="Back" onPress={back} />
          <Pressable style={st.headMid} onPress={() => setInfo(true)}>
            <GroupAvatar g={g} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={st.title} numberOfLines={1}>{g.name}</Text>
              <Text style={st.sub}>{g.members.length} {g.members.length === 1 ? 'member' : 'members'} · {snaps.length} snap{snaps.length === 1 ? '' : 's'}</Text>
            </View>
          </Pressable>
          {open && snaps.length > 0 && <IconBtn name="play" label="Play all" bg={C.open} color="#fff" onPress={() => navigation.navigate('Viewer', { groupId: id, start: 0 })} />}
          <IconBtn name="info" label="Group info" onPress={() => setInfo(true)} />
        </View>
      </SafeAreaView>

      <View style={[st.lockbar, open && { backgroundColor: C.openSoft }]}>
        {open
          ? <Text style={[st.lockText, { color: '#127a37' }]}>Opened {fmtDate(g.unlockAt)} · tap a snap to watch</Text>
          : <><Icon name="lock" size={13} color={C.accentDark} /><Text style={st.lockText}>Opens in {longLeft(g.unlockAt)}</Text></>}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={blocks}
          keyExtractor={(b) => b.key}
          contentContainerStyle={{ paddingVertical: 10, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={st.empty}>
              <GroupAvatar g={g} size={72} />
              <Text style={s.h2}>{g.name}</Text>
              <Text style={[s.muted, { textAlign: 'center' }]}>{open ? 'This group is open, but nothing was sealed.' : `Send the first snap. It stays sealed until ${fmtDate(g.unlockAt)}.`}</Text>
            </View>
          }
          renderItem={({ item: b }) => {
            const color = colorOf(b.by);
            return (
              <View>
                {b.day && <Text style={st.day}>{b.day}</Text>}
                <View style={st.blk}>
                  <Text style={[st.who, { color }]}>{who(b.by)}</Text>
                  <View style={[st.lines, { borderLeftColor: color }]}>
                    {b.items.map((it) => {
                      if (it.type === 'msg') return <Text key={it.id} style={st.msg}>{it.text}</Text>;
                      if (!open) {
                        return (
                          <View key={it.id} style={st.snapLine}>
                            <Square kind="sealed" />
                            <Text style={[st.snapText, { color: C.accent }]}>Sealed {it.kind === 'video' ? 'Video' : 'Snap'}</Text>
                            <Text style={st.snapSub}>· opens {fmtShort(g.unlockAt)}</Text>
                          </View>
                        );
                      }
                      const index = snaps.findIndex((x) => x.id === it.id);
                      return (
                        <Pressable key={it.id} onPress={() => navigation.navigate('Viewer', { groupId: id, start: index })}>
                          <View style={st.snapLine}>
                            <Square kind="open" />
                            <Text style={[st.snapText, { color: C.open }]}>{it.kind === 'video' ? 'Video' : 'Snap'}</Text>
                            <Text style={st.snapSub}>· tap to view</Text>
                          </View>
                          {!!it.caption && <Text style={[st.msg, { color: C.muted }]}>“{it.caption}”</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          }}
        />

        <View style={[st.composer, { paddingBottom: insets.bottom + 8 }]}>
          {!open && (
            <Pressable accessibilityLabel="Send a snap" onPress={() => navigation.navigate('Camera', { preselect: id })} style={[st.cbtn, { backgroundColor: C.accent }]}>
              <Icon name="camera" size={22} color="#fff" />
            </Pressable>
          )}
          <TextInput value={text} onChangeText={setText} placeholder="Send a chat" placeholderTextColor={C.muted}
            style={st.input} maxLength={500} onSubmitEditing={submit} returnKeyType="send" submitBehavior="submit" />
          <Pressable accessibilityLabel="Send" onPress={submit} style={[st.cbtn, { backgroundColor: text.trim() ? C.chat : C.soft }]}>
            <Icon name="send" size={18} color={text.trim() ? '#fff' : C.faint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={info} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInfo(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><IconBtn name="close" label="Close" onPress={() => setInfo(false)} /></View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <GroupAvatar g={g} size={84} />
            <Text style={s.h1}>{g.name}</Text>
            <Text style={s.muted}>{open ? 'Opened' : 'Opens'} {fmtDate(g.unlockAt)}</Text>
          </View>
          <Pressable style={st.code} onPress={() => Share.share({ message: `Join "${g.name}" on Capsule. Everything we snap stays sealed until ${fmtDate(g.unlockAt)} 🔒\nCode: ${g.code}` })}>
            <View>
              <Text style={s.label}>Invite code</Text>
              <Text style={{ color: C.accent, fontSize: 26, fontWeight: '900', letterSpacing: 5 }}>{g.code}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="share" size={18} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '900' }}>Share</Text></View>
          </Pressable>
          <View>
            <Text style={s.label}>Members</Text>
            {g.members.map((m) => (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Avatar id={m} label={who(m)} size={38} />
                <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{who(m)}</Text>
                {m === g.createdBy && <Text style={s.muted}>· made the group</Text>}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  headMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: C.text, fontWeight: '900', fontSize: 17 },
  sub: { color: C.muted, fontWeight: '700', fontSize: 12 },
  lockbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: C.accentSoft },
  lockText: { color: C.accentDark, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  day: { textAlign: 'center', color: C.muted, fontWeight: '900', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  blk: { paddingHorizontal: 14, paddingVertical: 4 },
  who: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  lines: { borderLeftWidth: 2, paddingLeft: 9, gap: 6 },
  msg: { color: C.text, fontSize: 16 },
  snapLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  snapText: { fontWeight: '800', fontSize: 15 },
  snapSub: { color: C.muted, fontWeight: '600', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 36 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  cbtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: C.soft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16, fontWeight: '600', color: C.text },
  code: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.accentSoft, borderRadius: 16, padding: 16 },
});
