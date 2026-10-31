import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, type RootStack } from '../session';
import { createGroup } from '../api';
import { C, EMOJIS, fmtDate } from '../theme';
import { Icon } from '../icons';
import { Btn, Header, IconBtn, s } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'NewGroup'>;

function nye() { const n = new Date(); let t = new Date(n.getFullYear(), 11, 31, 23, 59); if (t <= n) t = new Date(n.getFullYear() + 1, 11, 31, 23, 59); return t; }
function midsummer() {
  const n = new Date();
  const mk = (y: number) => { for (let d = 19; d <= 25; d++) { const x = new Date(y, 5, d, 18, 0); if (x.getDay() === 5) return x; } return new Date(y, 5, 21, 18); };
  let t = mk(n.getFullYear()); if (t <= n) t = mk(n.getFullYear() + 1); return t;
}
function inAYear() { const t = new Date(); t.setFullYear(t.getFullYear() + 1); return t; }
const QUICK: [string, () => Date][] = [['New Year’s Eve', nye], ['Midsummer', midsummer], ['In 1 year', inAYear]];

export default function NewGroupScreen({ navigation }: Props) {
  const { uid } = useSession();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [when, setWhen] = useState<Date>(nye());
  const [quick, setQuick] = useState<string | null>(QUICK[0][0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  function pickAndroid() {
    DateTimePickerAndroid.open({
      value: when, mode: 'date', minimumDate: new Date(),
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        DateTimePickerAndroid.open({ value: d, mode: 'time', is24Hour: true, onChange: (e2, t) => { if (e2.type === 'set' && t) { setWhen(t); setQuick(null); } } });
      },
    });
  }

  async function create() {
    const n = name.trim();
    if (!n) { setErr('Give the group a name.'); return; }
    if (when.getTime() <= Date.now() + 60000) { setErr('Pick a time in the future.'); return; }
    setBusy(true); setErr('');
    try { const g = await createGroup(uid, n, emoji, when); setCreated({ id: g.id, code: g.code }); }
    catch { setErr('Couldn’t create the group. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  const invite = (code: string) => Share.share({ message: `Join "${name.trim()}" on Capsule. Everything we snap stays sealed until ${fmtDate(when.getTime())} 🔒\nCode: ${code}` });

  if (created) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', gap: 16 }}>
        <View style={st.bigAvatar}><Text style={{ fontSize: 46 }}>{emoji}</Text></View>
        <Text style={[s.h1, { textAlign: 'center' }]}>{name.trim()}</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>Send this code to your friends so they can join.</Text>
        <Pressable style={st.codeBox} onPress={() => invite(created.code)}>
          <Text style={st.code}>{created.code}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="share" size={16} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '800' }}>Share invite</Text></View>
        </Pressable>
        <Btn title="Chat with Group" onPress={() => navigation.replace('Thread', { id: created.id })} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Header title="New Group" left={<IconBtn name="close" label="Close" onPress={() => navigation.goBack()} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Group name</Text>
          <TextInput value={name} onChangeText={setName} placeholder={`The gang ${new Date().getFullYear() + 1}`} placeholderTextColor={C.faint} style={s.input} maxLength={40} autoFocus />
        </View>
        <View>
          <Text style={s.label}>Icon</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} style={[st.emoji, emoji === e && st.emojiOn]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View>
          <Text style={s.label}>Opens</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {QUICK.map(([label, fn]) => (
              <Pressable key={label} onPress={() => { setWhen(fn()); setQuick(label); }} style={[st.chip, quick === label && st.chipOn]}>
                <Text style={{ color: quick === label ? C.accent : C.text, fontWeight: '800' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {Platform.OS === 'ios' ? (
            <DateTimePicker value={when} mode="datetime" display="spinner" themeVariant="light" minimumDate={new Date()}
              onChange={(_, d) => { if (d) { setWhen(d); setQuick(null); } }} />
          ) : (
            <Pressable onPress={pickAndroid} style={s.input}><Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{fmtDate(when.getTime())}</Text></Pressable>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Icon name="lock" size={14} color={C.muted} />
          <Text style={[s.muted, { flex: 1, fontSize: 13 }]}>Everything sent to this group stays sealed for everyone until {fmtDate(when.getTime())}. The date can’t be changed later.</Text>
        </View>
        {!!err && <Text style={{ color: C.danger, fontWeight: '700' }}>{err}</Text>}
        <Btn title="Create Group" onPress={create} loading={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  emoji: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  emojiOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chip: { borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  bigAvatar: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  codeBox: { backgroundColor: C.accentSoft, borderRadius: 18, paddingVertical: 20, alignItems: 'center', gap: 8 },
  code: { color: C.accent, fontSize: 38, fontWeight: '900', letterSpacing: 8 },
});
