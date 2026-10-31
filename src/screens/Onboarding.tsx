import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveMyName } from '../api';
import { useSession } from '../session';
import { C } from '../theme';
import { Btn, s } from '../ui';
import { Icon } from '../icons';
import { StatusBar } from 'expo-status-bar';

export default function Onboarding() {
  const { uid, setName } = useSession();
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    const n = val.trim();
    if (!n) return;
    setBusy(true); setErr('');
    try { await saveMyName(uid, n); setName(n); }
    catch { setErr('Couldn’t save your name. Check your connection and try again.'); setBusy(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ gap: 14, marginTop: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="lock" size={30} color="#fff" />
          </View>
          <Text style={s.h1}>Snaps that open later.</Text>
          <Text style={[s.muted, { fontSize: 16, lineHeight: 22 }]}>
            Shoot all year. Everything gets sealed until the day your group picked. Then you open it together.
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={s.label}>What do your friends call you?</Text>
          <TextInput
            value={val} onChangeText={setVal} placeholder="Your name" placeholderTextColor={C.faint}
            style={s.input} maxLength={30} autoFocus returnKeyType="done" onSubmitEditing={go}
          />
          {!!err && <Text style={{ color: C.danger, fontWeight: '700' }}>{err}</Text>}
          <Btn title="Let’s go" onPress={go} disabled={!val.trim()} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
