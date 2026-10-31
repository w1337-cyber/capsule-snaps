import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStack } from '../session';
import { C } from '../theme';
import { Icon, type IconName } from '../icons';
import { Header, IconBtn } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'NewChat'>;

export default function NewChatScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 8 }}>
      <Header title="New Chat" right={<IconBtn name="close" label="Close" onPress={() => navigation.goBack()} />} />
      <View style={{ paddingHorizontal: 16 }}>
        <Option icon="group" accent title="New Group" sub="Pick a name and when it opens"
          onPress={() => { navigation.goBack(); navigation.navigate('NewGroup'); }} />
        <Option icon="key" title="Join with Code" sub="Got a 6-letter code from a friend?"
          onPress={() => { navigation.goBack(); navigation.navigate('Join'); }} />
      </View>
    </View>
  );
}

function Option({ icon, title, sub, onPress, accent }: { icon: IconName; title: string; sub: string; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.opt, pressed && { opacity: 0.6 }]}>
      <View style={[st.oi, accent && { backgroundColor: C.accentSoft }]}><Icon name={icon} size={22} color={accent ? C.accent : C.text} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>{title}</Text>
        <Text style={st.sub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  oi: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontWeight: '800', fontSize: 16 },
  sub: { color: C.muted, fontWeight: '600', fontSize: 13, marginTop: 1 },
});
