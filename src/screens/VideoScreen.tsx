import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Linking, PanResponder, useWindowDimensions, Alert,
} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

interface VideoItem {
  id: string;
  uri: string;
  title: string;
  duration: number;  // ms
  width?: number;
  height?: number;
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoScreen() {
  const { width } = useWindowDimensions();
  const VIDEO_H   = Math.round(width * 9 / 16);

  const [videos, setVideos]           = useState<VideoItem[]>([]);
  const [current, setCurrent]         = useState<VideoItem | null>(null);
  const [perm, setPerm]               = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [loading, setLoading]         = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [pos, setPos]                 = useState(0);
  const [dur, setDur]                 = useState(0);
  const [fullscreen, setFullscreen]   = useState(false);

  const videoRef      = useRef<Video>(null);
  const durRef        = useRef(dur);
  const seekBarWidth  = useRef(1);
  const seekPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarWidth.current));
      videoRef.current?.setPositionAsync(pct * durRef.current * 1000).catch(() => {});
    },
    onPanResponderMove: (e) => {
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarWidth.current));
      videoRef.current?.setPositionAsync(pct * durRef.current * 1000).catch(() => {});
    },
  })).current;

  /* ─── Load videos ─── */
  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      // requestPermissionsAsync returns immediately if already granted (no dialog)
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setPerm(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') { setLoading(false); return; }

      let all: MediaLibrary.Asset[] = [];
      let after: string | undefined;
      do {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.video,
          first: 200,
          after,
          sortBy: [MediaLibrary.SortBy.creationTime, false],
        });
        all = [...all, ...page.assets];
        after = page.hasNextPage ? page.endCursor : undefined;
      } while (after);

      const items: VideoItem[] = [];
      for (const a of all) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(a);
          items.push({
            id: a.id,
            uri: info.localUri ?? info.uri,
            title: a.filename.replace(/\.[^.]+$/, ''),
            duration: Math.round(a.duration * 1000),
            width: a.width, height: a.height,
          });
        } catch {
          items.push({
            id: a.id, uri: a.uri,
            title: a.filename.replace(/\.[^.]+$/, ''),
            duration: Math.round(a.duration * 1000),
            width: a.width, height: a.height,
          });
        }
      }
      setVideos(items);
    } catch (e) {
      Alert.alert('Ошибка загрузки видео', String(e));
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadVideos();
    return () => {};
  }, [loadVideos]));

  /* ─── Playback status ─── */
  const onPlaybackStatus = useCallback((st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    const d = Math.floor((st.durationMillis ?? 0) / 1000);
    setPos(Math.floor((st.positionMillis ?? 0) / 1000));
    setDur(d); durRef.current = d;
    setIsPlaying(st.isPlaying);
  }, []);

  /* ─── Toggle play ─── */
  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    const st = await v.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    if (st.isPlaying) await v.pauseAsync(); else await v.playAsync();
  }, []);


  const toggleFullscreen = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (fullscreen) {
      await v.dismissFullscreenPlayer();
    } else {
      await v.presentFullscreenPlayer();
    }
    setFullscreen(f => !f);
  }, [fullscreen]);

  /* ─── Render ─── */
  const renderItem = ({ item }: { item: VideoItem }) => {
    const active = current?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.row, active && styles.rowActive]}
        onPress={() => { setCurrent(item); setPos(0); setDur(0); }}
        activeOpacity={0.75}
      >
        <View style={[styles.rowIcon, { backgroundColor: active ? '#40c4ff22' : '#1a1a24' }]}>
          <Ionicons name={active ? 'videocam' : 'videocam-outline'} size={18} color={active ? '#40c4ff' : '#555'} />
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.rowTitle, active && { color: '#40c4ff' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowMeta}>
            {fmtMs(item.duration)}
            {item.width && item.height ? `  ·  ${item.width}×${item.height}` : ''}
          </Text>
        </View>
        {active && isPlaying && (
          <Ionicons name="pulse" size={16} color="#40c4ff" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── Video player ── */}
      <View style={[styles.player, { height: VIDEO_H + 100 }]}>
        {current ? (
          <Video
            ref={videoRef}
            source={{ uri: current.uri }}
            style={[styles.video, { height: VIDEO_H }]}
            resizeMode={'contain' as any}
            shouldPlay
            onPlaybackStatusUpdate={onPlaybackStatus}
            onFullscreenUpdate={({ fullscreenUpdate }) =>
              setFullscreen(fullscreenUpdate === 1 || fullscreenUpdate === 2)
            }
          />
        ) : (
          <View style={[styles.videoPlaceholder, { height: VIDEO_H }]}>
            <Ionicons name="film-outline" size={48} color="#2a2a3a" />
            <Text style={styles.placeholderText}>Tap a video to play</Text>
          </View>
        )}

        {/* Controls overlay */}
        {current && (
          <View style={styles.overlay}>
            <Text style={styles.videoTitle} numberOfLines={1}>{current.title}</Text>

            {/* Seek bar */}
            <View style={styles.seekRow}>
              <Text style={styles.seekTime}>{fmtMs(pos * 1000)}</Text>
              <View
                style={styles.seekTrack}
                onLayout={e => { seekBarWidth.current = e.nativeEvent.layout.width; }}
                {...seekPan.panHandlers}
              >
                <View style={styles.seekBg} />
                <View style={[styles.seekFill, { width: dur > 0 ? `${(pos / dur) * 100}%` : '0%' }]} />
                <View style={[styles.seekThumb, { left: dur > 0 ? `${(pos / dur) * 100}%` : '0%' }]} />
              </View>
              <Text style={styles.seekTime}>{fmtMs(dur * 1000)}</Text>
            </View>

            {/* Buttons */}
            <View style={styles.ctrlRow}>
              <TouchableOpacity
                onPress={() => videoRef.current?.setPositionAsync(Math.max(0, pos - 10) * 1000)}
                style={styles.ctrlBtn}
              >
                <Ionicons name="play-back" size={22} color="#ccc" />
                <Text style={styles.ctrlLabel}>−10s</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => videoRef.current?.setPositionAsync(Math.min(dur, pos + 10) * 1000)}
                style={styles.ctrlBtn}
              >
                <Ionicons name="play-forward" size={22} color="#ccc" />
                <Text style={styles.ctrlLabel}>+10s</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleFullscreen} style={[styles.ctrlBtn, { marginLeft: 8 }]}>
                <Ionicons name={fullscreen ? 'contract' : 'expand'} size={22} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Video list ── */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>VIDEOS ON DEVICE ({videos.length})</Text>
        {perm === 'denied' && (
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={styles.permLink}>Allow access →</Text>
          </TouchableOpacity>
        )}
        {perm === 'granted' && (
          <TouchableOpacity onPress={loadVideos}>
            <Ionicons name="refresh" size={16} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={videos}
        keyExtractor={v => v.id}
        renderItem={renderItem}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {loading ? 'Загрузка…' : perm === 'denied'
                ? 'Нет доступа к медиабиблиотеке'
                : 'Видео не найдены'}
            </Text>
            {!loading && perm === 'denied' && (
              <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.permBtn}>
                <Text style={styles.permLink}>Открыть настройки →</Text>
              </TouchableOpacity>
            )}
            {!loading && perm === 'granted' && videos.length === 0 && (
              <Text style={styles.hintText}>
                Видео ищутся в галерее (DCIM, Movies, Download).{'\n'}
                Нажмите ↻ чтобы обновить.
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  player: {
    width: '100%',
    backgroundColor: '#000', position: 'relative',
  },
  video: { width: '100%' },
  videoPlaceholder: {
    width: '100%',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d0d14',
  },
  placeholderText: { color: '#2a2a3a', fontSize: 13, marginTop: 10 },

  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#000000cc', paddingHorizontal: 12, paddingVertical: 8,
  },
  videoTitle: { color: '#bbb', fontSize: 12, fontWeight: '600', marginBottom: 6 },

  seekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  seekTime: { color: '#777', fontSize: 9, width: 30, textAlign: 'center' },
  seekTrack: { flex: 1, height: 16, justifyContent: 'center' },
  seekBg: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#333', borderRadius: 2 },
  seekFill: { position: 'absolute', left: 0, height: 3, backgroundColor: '#40c4ff', borderRadius: 2 },
  seekThumb: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#40c4ff', top: -4.5, marginLeft: -6 },

  ctrlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  ctrlBtn: { alignItems: 'center', padding: 8 },
  ctrlLabel: { color: '#555', fontSize: 9, marginTop: 1 },
  playBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#40c4ff22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#40c4ff44', marginHorizontal: 12,
  },

  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  listTitle: { color: '#444', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  permLink: { color: '#ff5252', fontSize: 10, fontWeight: '700' },

  list: { flex: 1, paddingHorizontal: 10 },
  emptyWrap: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { color: '#444', fontSize: 13, textAlign: 'center' },
  hintText:  { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18 },
  permBtn:   { marginTop: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111118', borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#1e1e28' },
  rowActive: { borderColor: '#40c4ff44', backgroundColor: '#40c4ff08' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowTitle: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  rowMeta: { color: '#444', fontSize: 10, marginTop: 2 },
});
