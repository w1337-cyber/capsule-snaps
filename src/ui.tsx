import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Group } from './api';
import { useSession, type RootStack } from './session';
import { C, colorOf } from './theme';
import { Icon, type IconName } from './icons';

/* ---------- buttons ---------- */

export function Btn({ title, onPress, kind = 'primary', disabled, loading, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'soft';
  disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = kind === 'primary' ? C.accent : C.soft;
  const fg = kind === 'primary' ? '#fff' : C.text;
  return (
    <Pressable onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

/** Round icon button. `dark` = translucent for use over the camera. */
export function IconBtn({ name, label, onPress, dark, size = 38, color, bg, style }: {
  name: IconName; label: string; onPress: () => void; dark?: boolean; size?: number; color?: string; bg?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg ?? (dark ? 'rgba(255,255,255,0.14)' : C.soft), opacity: pressed ? 0.7 : 1,
      }, style]}>
      <Icon name={name} size={size * 0.52} color={color ?? (dark ? '#fff' : C.text)} />
    </Pressable>
  );
}

/* ---------- avatars ---------- */

export function Avatar({ id, label, size = 46 }: { id: string; label: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorOf(id), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.4 }}>{(label || '?').trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function GroupAvatar({ g, size = 50 }: { g: Group; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorOf(g.id), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.48 }}>{g.emoji}</Text>
    </View>
  );
}

export function MeAvatar({ size = 38, onPress }: { size?: number; onPress?: () => void }) {
  const { uid, name } = useSession();
  return <Pressable onPress={onPress} accessibilityLabel="You"><Avatar id={uid} label={name} size={size} /></Pressable>;
}

/** Small status square, like a chat app's "new snap / new chat" marker. */
export function Square({ kind }: { kind: 'sealed' | 'open' | 'chat' | 'empty' }) {
  const color = kind === 'sealed' ? C.accent : kind === 'open' ? C.open : kind === 'chat' ? C.chat : 'transparent';
  return <View style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: color, borderWidth: kind === 'empty' ? 2 : 0, borderColor: '#c7c9ce' }} />;
}

/* ---------- header + bottom nav ---------- */

export function Header({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <View style={[s.side, { justifyContent: 'flex-start' }]}>{left}</View>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={[s.side, { justifyContent: 'flex-end' }]}>{right}</View>
    </View>
  );
}

type Tab = 'Chat' | 'Camera' | 'Memories';

export function TabBar({ current, dark }: { current: Tab; dark?: boolean }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const { groups } = useSession();
  const sealed = groups.filter((g) => g.unlockAt > Date.now()).length;
  const tabs: { key: Tab; icon: IconName }[] = [
    { key: 'Chat', icon: 'chat' }, { key: 'Camera', icon: 'camera' }, { key: 'Memories', icon: 'memories' },
  ];
  return (
    <View style={[s.tabbar, { paddingBottom: insets.bottom + 6 }, dark ? { backgroundColor: '#000' } : { backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line }]}>
      {tabs.map((t) => {
        const on = t.key === current;
        const color = dark ? (on ? '#fff' : 'rgba(255,255,255,0.6)') : on ? C.text : C.faint;
        return (
          <Pressable key={t.key} accessibilityLabel={t.key} accessibilityState={{ selected: on }} style={s.tab}
            onPress={() => { if (!on) nav.replace(t.key); }}>
            <Icon name={t.icon} size={28} color={color} />
            {t.key === 'Chat' && sealed > 0 && (
              <View style={s.dot}><Text style={s.dotText}>{sealed}</Text></View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 17, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: C.text, textAlign: 'center', maxWidth: '55%' },
  tabbar: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 },
  tab: { width: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 2, right: 12, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  h1: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  h2: { color: C.text, fontSize: 19, fontWeight: '900' },
  muted: { color: C.muted, fontSize: 14, fontWeight: '600' },
  label: { color: C.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input: { backgroundColor: C.soft, color: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, fontWeight: '700' },
  sep: { height: 1, backgroundColor: C.line },
});
