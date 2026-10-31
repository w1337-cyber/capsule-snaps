import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, type RootStack } from '../session';
import { joinByCode } from '../api';
import { C } from '../theme';
import { Btn, Header, IconBtn, s } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Join'>;

export default function JoinScreen({ navigation }: Props) {
  const { uid } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function join() {
    setBusy(true); setErr('');
    try {
      const gid = await joinByCode(uid, code);
      navigation.replace('Thread', { id: gid });
    } catch (e: any) {
      setErr(e?.message?.startsWith('No capsule') ? 'No group found with that code.' : 'Couldn’t join. Check the code and your connection.');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Header title="Join with Code" left={<IconBtn name="close" label="Close" onPress={() => navigation.goBack()} />} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 16, padding: 16 }}>
        <Text style={[s.muted, { textAlign: 'center' }]}>Enter the 6-letter code a friend sent you.</Text>
        <TextInput
          value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false}
          maxLength={6} placeholder="ABC123" placeholderTextColor={C.line} autoFocus onSubmitEditing={join}
          style={{ color: C.accent, fontSize: 44, fontWeight: '900', letterSpacing: 10, textAlign: 'center', paddingVertical: 12 }}
        />
        {!!err && <Text style={{ color: C.danger, textAlign: 'center', fontWeight: '700' }}>{err}</Text>}
        <Btn title="Join Group" onPress={join} disabled={code.trim().length < 6} loading={busy} />
      </View>
    </SafeAreaView>
  );
}
