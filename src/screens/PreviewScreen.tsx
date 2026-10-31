import React, { useState } from 'react';
import { Dimensions, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStack } from '../session';
import type { Media } from '../api';
import { C } from '../theme';
import { Icon } from '../icons';
import { IconBtn } from '../ui';

type Props = NativeStackScreenProps<RootStack, 'Preview'>;
const { width: W } = Dimensions.get('window');

export default function PreviewScreen({ navigation, route }: Props) {
  const { media, preselect } = route.params;
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <FlatList
        data={media} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={(m, i) => m.uri + i}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item, index }) => <Slide m={item} active={index === page} />}
      />

      <View style={[st.top, { paddingTop: insets.top + 8 }]}>
        <IconBtn dark name="close" label="Discard" size={40} onPress={() => navigation.goBack()} />
        <View style={st.rail}>
          <Pressable accessibilityLabel="Add caption" onPress={() => setEditing(true)} style={st.railBtn}><Icon name="text" size={22} color="#fff" /></Pressable>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.captionWrap} pointerEvents="box-none">
        {(editing || !!caption) && (
          <TextInput value={caption} onChangeText={setCaption} autoFocus={editing} onBlur={() => setEditing(false)}
            placeholder="" maxLength={120} style={st.caption} returnKeyType="done" submitBehavior="blurAndSubmit" />
        )}
      </KeyboardAvoidingView>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={14} color="#fff" />
          <Text style={st.hint}>{media.length > 1 ? `${page + 1} of ${media.length} · ` : ''}sealed when sent</Text>
        </View>
        <Pressable style={({ pressed }) => [st.sendBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate('SendTo', { media, caption: caption.trim(), preselect })}>
          <Text style={st.sendText}>Send To</Text>
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function Slide({ m, active }: { m: Media; active: boolean }) {
  if (m.kind === 'image') return <Image source={{ uri: m.uri }} style={{ width: W, height: '100%' }} contentFit="cover" />;
  return <VideoSlide uri={m.uri} active={active} />;
}

function VideoSlide({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  React.useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <VideoView player={player} style={{ width: W, height: '100%' }} contentFit="cover" nativeControls={false} />;
}

const st = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rail: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 24, padding: 6 },
  railBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  captionWrap: { position: 'absolute', left: 0, right: 0, top: '58%' },
  caption: { backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { color: '#fff', fontWeight: '800', fontSize: 13, textShadowColor: '#000', textShadowRadius: 6 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13 },
  sendText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
