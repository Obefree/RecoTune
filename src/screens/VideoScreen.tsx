import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  PanResponder, useWindowDimensions, Modal, Alert,
  StatusBar, Platform,
} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

interface VideoItem {
  id: string;
  uri: string;
  title: string;
  duration: number;
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const VIDEO_H = Math.round(width * 9 / 16);

  const [videos, setVideos]         = useState<VideoItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [loading, setLoading]       = useState(false);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [pos, setPos]               = useState(0);
  const [dur, setDur]               = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const current = currentIdx >= 0 && currentIdx < videos.length ? videos[currentIdx] : null;

  const videoRef     = useRef<Video>(null);
  const durRef       = useRef(0);
  const seekBarW     = useRef(1);
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Auto-hide controls in fullscreen ── */
  function showControls() {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (fullscreen) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
    }
  }

  useEffect(() => {
    if (fullscreen) showControls();
    else { setControlsVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); }
  }, [fullscreen]);

  /* ── Lock orientation on fullscreen ── */
  const enterFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch {}
    setFullscreen(true);
    StatusBar.setHidden(true, 'fade');
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {}
    setFullscreen(false);
    StatusBar.setHidden(false, 'fade');
    setShowSwitcher(false);
  }, []);

  /* ── Restore portrait on blur ── */
  useFocusEffect(useCallback(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      StatusBar.setHidden(false, 'fade');
      setFullscreen(false);
    };
  }, []));

  /* ── Seek PanResponder ── */
  const seekPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarW.current));
      videoRef.current?.setPositionAsync(pct * durRef.current * 1000).catch(() => {});
    },
    onPanResponderMove: (e) => {
      const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarW.current));
      videoRef.current?.setPositionAsync(pct * durRef.current * 1000).catch(() => {});
    },
  })).current;

  /* ── Pick videos ── */
  const pickVideos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        multiple: true,
        copyToCacheDirectory: false,
      });
      if (!result.canceled) {
        const picked: VideoItem[] = result.assets.map(a => ({
          id: a.uri,
          uri: a.uri,
          title: (a.name ?? a.uri.split('/').pop() ?? 'Video').replace(/\.[^.]+$/, ''),
          duration: 0,
        }));
        setVideos(prev => {
          const existing = new Set(prev.map(v => v.uri));
          return [...prev, ...picked.filter(v => !existing.has(v.uri))];
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  /* ── Delete video ── */
  const deleteVideo = useCallback((id: string, idx: number) => {
    Alert.alert('Удалить из списка?', 'Файл на телефоне останется.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: () => {
          setVideos(prev => prev.filter(v => v.id !== id));
          if (currentIdx === idx) setCurrentIdx(-1);
          else if (currentIdx > idx) setCurrentIdx(i => i - 1);
        },
      },
    ]);
  }, [currentIdx]);

  /* ── Navigation ── */
  const playAt = useCallback((idx: number) => {
    if (idx < 0 || idx >= videos.length) return;
    setCurrentIdx(idx);
    setPos(0); setDur(0);
    setShowSwitcher(false);
    showControls();
  }, [videos.length]);

  const playPrev = useCallback(() => playAt(currentIdx - 1), [currentIdx, playAt]);
  const playNext = useCallback(() => playAt(currentIdx + 1), [currentIdx, playAt]);

  /* ── Playback status ── */
  const onStatus = useCallback((st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    const d = Math.floor((st.durationMillis ?? 0) / 1000);
    setPos(Math.floor((st.positionMillis ?? 0) / 1000));
    setDur(d); durRef.current = d;
    setIsPlaying(st.isPlaying);
    // Auto-advance
    if (st.didJustFinish && currentIdx < videos.length - 1) {
      playNext();
    }
  }, [currentIdx, videos.length, playNext]);

  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    const st = await v.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    st.isPlaying ? await v.pauseAsync() : await v.playAsync();
    showControls();
  }, []);

  /* ── Player dimensions ── */
  const fsW = fullscreen ? Math.max(width, height) : width;
  const fsH = fullscreen ? Math.min(width, height) : VIDEO_H;

  /* ─── Video controls component (used in both normal + fullscreen) ─── */
  function Controls() {
    if (!controlsVisible) return null;
    return (
      <View style={[styles.overlay, fullscreen && { paddingBottom: 16 }]}>
        {/* Title + close */}
        <View style={styles.overlayTop}>
          <Text style={styles.videoTitle} numberOfLines={1}>{current?.title}</Text>
          {fullscreen && (
            <TouchableOpacity onPress={exitFullscreen} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="contract" size={22} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>

        {/* Seek bar */}
        <View style={styles.seekRow}>
          <Text style={styles.seekTime}>{fmtMs(pos * 1000)}</Text>
          <View
            style={styles.seekTrack}
            onLayout={e => { seekBarW.current = e.nativeEvent.layout.width; }}
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
          {fullscreen && (
            <TouchableOpacity onPress={playPrev} style={styles.ctrlBtn} disabled={currentIdx <= 0}>
              <Ionicons name="play-skip-back" size={22} color={currentIdx > 0 ? '#ccc' : '#444'} />
            </TouchableOpacity>
          )}

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

          {fullscreen && (
            <TouchableOpacity onPress={playNext} style={styles.ctrlBtn} disabled={currentIdx >= videos.length - 1}>
              <Ionicons name="play-skip-forward" size={22} color={currentIdx < videos.length - 1 ? '#ccc' : '#444'} />
            </TouchableOpacity>
          )}

          {fullscreen ? (
            <TouchableOpacity
              onPress={() => setShowSwitcher(v => !v)}
              style={[styles.ctrlBtn, { marginLeft: 4 }]}
            >
              <Ionicons name="list" size={22} color="#40c4ff" />
              <Text style={[styles.ctrlLabel, { color: '#40c4ff' }]}>Список</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={enterFullscreen} style={[styles.ctrlBtn, { marginLeft: 8 }]}>
              <Ionicons name="expand" size={22} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  /* ─── Fullscreen view ─── */
  if (fullscreen && current) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent supportedOrientations={['landscape']}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.fsContainer, { width: fsW, height: fsH }]}
          onPress={showControls}
        >
          <Video
            ref={videoRef}
            source={{ uri: current.uri }}
            style={{ width: fsW, height: fsH }}
            resizeMode={'contain' as any}
            shouldPlay
            onPlaybackStatusUpdate={onStatus}
          />
          <Controls />

          {/* Floating video switcher */}
          {showSwitcher && (
            <View style={styles.switcher}>
              <Text style={styles.switcherTitle}>ВИДЕО</Text>
              <FlatList
                data={videos}
                keyExtractor={v => v.id}
                style={{ maxHeight: 220 }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.switchItem, index === currentIdx && styles.switchItemActive]}
                    onPress={() => playAt(index)}
                  >
                    <Ionicons
                      name={index === currentIdx ? 'videocam' : 'videocam-outline'}
                      size={14}
                      color={index === currentIdx ? '#40c4ff' : '#888'}
                    />
                    <Text style={[styles.switchItemText, index === currentIdx && { color: '#40c4ff' }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    );
  }

  /* ─── Normal view ─── */
  const renderItem = ({ item, index }: { item: VideoItem; index: number }) => {
    const active = currentIdx === index;
    return (
      <TouchableOpacity
        style={[styles.row, active && styles.rowActive]}
        onPress={() => playAt(index)}
        onLongPress={() => deleteVideo(item.id, index)}
        delayLongPress={450}
        activeOpacity={0.75}
      >
        <View style={[styles.rowIcon, { backgroundColor: active ? '#40c4ff22' : '#1a1a24' }]}>
          <Ionicons name={active ? 'videocam' : 'videocam-outline'} size={18} color={active ? '#40c4ff' : '#555'} />
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.rowTitle, active && { color: '#40c4ff' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowMeta}>{item.duration > 0 ? fmtMs(item.duration) : ''}</Text>
        </View>
        {active && isPlaying && <Ionicons name="pulse" size={16} color="#40c4ff" />}
        <TouchableOpacity
          onPress={() => deleteVideo(item.id, index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color="#2a2a3a" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Player */}
      <View style={[styles.player, { height: VIDEO_H + 90 }]}>
        {current ? (
          <Video
            ref={videoRef}
            source={{ uri: current.uri }}
            style={[styles.video, { height: VIDEO_H }]}
            resizeMode={'contain' as any}
            shouldPlay
            onPlaybackStatusUpdate={onStatus}
          />
        ) : (
          <TouchableOpacity style={[styles.videoPlaceholder, { height: VIDEO_H }]} onPress={pickVideos}>
            <Ionicons name="film-outline" size={48} color="#2a2a3a" />
            <Text style={styles.placeholderText}>Выберите видео из списка ниже</Text>
          </TouchableOpacity>
        )}
        {current && <Controls />}
      </View>

      {/* Video nav */}
      {current && videos.length > 1 && (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={playPrev} disabled={currentIdx <= 0} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={18} color={currentIdx > 0 ? '#40c4ff' : '#2a2a3a'} />
            <Text style={[styles.navText, { color: currentIdx > 0 ? '#40c4ff' : '#2a2a3a' }]}>Пред.</Text>
          </TouchableOpacity>
          <Text style={styles.navCount}>{currentIdx + 1} / {videos.length}</Text>
          <TouchableOpacity onPress={playNext} disabled={currentIdx >= videos.length - 1} style={styles.navBtn}>
            <Text style={[styles.navText, { color: currentIdx < videos.length - 1 ? '#40c4ff' : '#2a2a3a' }]}>След.</Text>
            <Ionicons name="chevron-forward" size={18} color={currentIdx < videos.length - 1 ? '#40c4ff' : '#2a2a3a'} />
          </TouchableOpacity>
        </View>
      )}

      {/* List header */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>ВИДЕО ({videos.length})</Text>
        <TouchableOpacity onPress={pickVideos} style={styles.addBtn}>
          <Ionicons name="add-circle-outline" size={22} color="#40c4ff" />
          <Text style={styles.addBtnText}>Добавить</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={videos}
        keyExtractor={v => v.id}
        renderItem={renderItem}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <TouchableOpacity style={styles.emptyWrap} onPress={pickVideos}>
            <Ionicons name="add-circle" size={48} color="#40c4ff33" />
            <Text style={styles.emptyText}>Нажмите чтобы выбрать видеофайлы</Text>
            <Text style={styles.hintText}>Долгое нажатие на трек — удалить из списка</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  player:    { width: '100%', backgroundColor: '#000', position: 'relative' },
  video:     { width: '100%' },
  videoPlaceholder: {
    width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d14',
  },
  placeholderText: { color: '#2a2a3a', fontSize: 13, marginTop: 10 },

  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#000000dd', paddingHorizontal: 12, paddingVertical: 8,
  },
  overlayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  videoTitle: { flex: 1, color: '#bbb', fontSize: 12, fontWeight: '600', marginRight: 8 },

  seekRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  seekTime: { color: '#777', fontSize: 9, width: 30, textAlign: 'center' },
  seekTrack:{ flex: 1, height: 16, justifyContent: 'center' },
  seekBg:   { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#333', borderRadius: 2 },
  seekFill: { position: 'absolute', left: 0, height: 3, backgroundColor: '#40c4ff', borderRadius: 2 },
  seekThumb:{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#40c4ff', top: -4.5, marginLeft: -6 },

  ctrlRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  ctrlBtn:  { alignItems: 'center', padding: 8 },
  ctrlLabel:{ color: '#555', fontSize: 9, marginTop: 1 },
  playBtn:  {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#40c4ff22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#40c4ff44', marginHorizontal: 8,
  },

  navRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#1a1a24' },
  navBtn:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navText:  { fontSize: 12 },
  navCount: { color: '#444', fontSize: 11 },

  listHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  listTitle: { color: '#444', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText:{ color: '#40c4ff', fontSize: 12, fontWeight: '700' },

  list:     { flex: 1, paddingHorizontal: 10 },
  emptyWrap:{ alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText:{ color: '#444', fontSize: 13, textAlign: 'center' },
  hintText: { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18 },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111118', borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#1e1e28' },
  rowActive:{ borderColor: '#40c4ff44', backgroundColor: '#40c4ff08' },
  rowIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo:  { flex: 1 },
  rowTitle: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  rowMeta:  { color: '#444', fontSize: 10, marginTop: 2 },

  /* Fullscreen */
  fsContainer: { backgroundColor: '#000', flex: 1, position: 'relative' },

  /* Floating switcher */
  switcher:     { position: 'absolute', right: 0, top: 0, bottom: 80, width: 220, backgroundColor: '#000000ee', padding: 10, borderLeftWidth: 1, borderColor: '#1e1e28' },
  switcherTitle:{ color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 6 },
  switchItem:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#111' },
  switchItemActive: { backgroundColor: '#40c4ff11' },
  switchItemText:   { flex: 1, color: '#888', fontSize: 12 },
});
