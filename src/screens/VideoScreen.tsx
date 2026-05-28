import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  useWindowDimensions, Alert,
  StatusBar, Pressable,
} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import SeekBar from '../components/SeekBar';
import * as DocumentPicker from 'expo-document-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useTabBarVisibility } from '../context/TabBarVisibility';

interface VideoItem {
  id: string; uri: string; title: string; duration: number;
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

/** Tap zone long-press threshold (slow / fast motion) */
const ZONE_LONG_MS = 450;
const TAP_SEEK_SEC = 10;

/**
 * Left third: tap — seek back. Center: short tap — show controls; long press — 0.25× (until release).
 * Right third: short tap — seek forward; long press — 2× (until release).
 */
function VideoTapZones({
  width: zw,
  height: zh,
  seekBack,
  seekForward,
  bumpControls,
  syncRate,
}: {
  width: number;
  height: number;
  seekBack: () => void;
  seekForward: () => void;
  bumpControls: () => void;
  syncRate: (rate: number) => void;
}) {
  const pressStartCenterRef = useRef(0);
  const pressStartRightRef = useRef(0);

  if (zw <= 0 || zh <= 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, width: zw, height: zh, flexDirection: 'row', zIndex: 1 }}
    >
      <Pressable style={{ flex: 1 }} onPress={seekBack} />
      <Pressable
        style={{ flex: 1 }}
        delayLongPress={ZONE_LONG_MS}
        onPressIn={() => { pressStartCenterRef.current = Date.now(); }}
        onLongPress={() => syncRate(0.25)}
        onPressOut={() => syncRate(1)}
        onPress={() => {
          if (Date.now() - pressStartCenterRef.current >= ZONE_LONG_MS) return;
          bumpControls();
        }}
      />
      <Pressable
        style={{ flex: 1 }}
        delayLongPress={ZONE_LONG_MS}
        onPressIn={() => { pressStartRightRef.current = Date.now(); }}
        onLongPress={() => syncRate(2)}
        onPressOut={() => syncRate(1)}
        onPress={() => {
          if (Date.now() - pressStartRightRef.current >= ZONE_LONG_MS) return;
          seekForward();
        }}
      />
    </View>
  );
}

export default function VideoScreen({ embedded }: { embedded?: boolean } = {}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setTabBarHidden, setMediaSegHidden } = useTabBarVisibility();

  const [videos, setVideos]         = useState<VideoItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [pos, setPos]               = useState(0);
  const [dur, setDur]               = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [ctrlsVis, setCtrlsVis]     = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  const current    = currentIdx >= 0 && currentIdx < videos.length ? videos[currentIdx] : null;
  const videoRef   = useRef<Video>(null);
  const durRef     = useRef(0);
  const videoSeekingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const VIDEO_H  = Math.round(width * 9 / 16);   // normal inline height
  // Fullscreen dimensions – larger axis = width when landscape
  const fsW = fullscreen ? Math.max(width, height) : width;
  const fsH = fullscreen ? Math.min(width, height) : VIDEO_H;

  /* ── Controls auto-hide in fullscreen ── */
  const bumpControls = useCallback(() => {
    setCtrlsVis(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (fullscreen) hideTimer.current = setTimeout(() => setCtrlsVis(false), 3500);
  }, [fullscreen]);

  useEffect(() => { bumpControls(); }, [fullscreen]);

  const syncRate = useCallback((r: number) => {
    setPlaybackRate(r);
    videoRef.current?.setRateAsync(r, true).catch(() => {});
  }, []);

  useEffect(() => {
    setPlaybackRate(1);
    videoRef.current?.setRateAsync(1, true).catch(() => {});
  }, [currentIdx]);

  /* ── Orientation lock ── */
  const enterFullscreen = useCallback(async () => {
    setFullscreen(true);
    StatusBar.setHidden(true, 'fade');
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch {}
  }, []);

  const exitFullscreen = useCallback(async () => {
    setPlaybackRate(1);
    videoRef.current?.setRateAsync(1, true).catch(() => {});
    setFullscreen(false);
    setShowSwitcher(false);
    StatusBar.setHidden(false, 'fade');
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch {}
  }, []);

  useEffect(() => {
    setTabBarHidden(fullscreen);
    setMediaSegHidden(fullscreen);
  }, [fullscreen, setTabBarHidden, setMediaSegHidden]);

  useFocusEffect(useCallback(() => () => {
    setFullscreen(false);
    StatusBar.setHidden(false, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    setTabBarHidden(false);
    setMediaSegHidden(false);
  }, [setTabBarHidden, setMediaSegHidden]));

  const handleVideoSeek = useCallback(async (seconds: number) => {
    const v = videoRef.current;
    if (!v || durRef.current <= 0) return;
    try {
      await v.setPositionAsync(Math.round(seconds * 1000));
      setPos(Math.round(seconds * 10) / 10);
    } catch {}
  }, []);

  /* ── Pick videos ── */
  const pickVideos = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['video/*'], multiple: true, copyToCacheDirectory: false });
      if (!res.canceled) {
        setVideos(prev => {
          const ex = new Set(prev.map(v => v.uri));
          const picked: VideoItem[] = res.assets
            .filter(a => !ex.has(a.uri))
            .map(a => ({ id: a.uri, uri: a.uri, duration: 0, title: (a.name ?? a.uri.split('/').pop() ?? 'Video').replace(/\.[^.]+$/, '') }));
          return [...prev, ...picked];
        });
      }
    } catch {}
  }, []);

  /* ── Delete ── */
  const deleteVideo = useCallback((id: string, idx: number) => {
    Alert.alert('Удалить из списка?', 'Файл на телефоне останется.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => {
        setVideos(p => p.filter(v => v.id !== id));
        if (currentIdx === idx) setCurrentIdx(-1);
        else if (currentIdx > idx) setCurrentIdx(i => i - 1);
      }},
    ]);
  }, [currentIdx]);

  /* ── Navigation ── */
  const playAt = useCallback((idx: number) => {
    if (idx < 0 || idx >= videos.length) return;
    setCurrentIdx(idx); setPos(0); setDur(0);
    setShowSwitcher(false); bumpControls();
  }, [videos.length, bumpControls]);

  const playPrev = useCallback(() => playAt(currentIdx - 1), [currentIdx, playAt]);
  const playNext = useCallback(() => playAt(currentIdx + 1), [currentIdx, playAt]);

  const seekBackTap = useCallback(() => {
    videoRef.current?.setPositionAsync(Math.max(0, pos - TAP_SEEK_SEC) * 1000).catch(() => {});
    bumpControls();
  }, [pos, bumpControls]);

  const seekForwardTap = useCallback(() => {
    videoRef.current?.setPositionAsync(Math.min(dur, pos + TAP_SEEK_SEC) * 1000).catch(() => {});
    bumpControls();
  }, [dur, pos, bumpControls]);

  /* ── Playback ── */
  const onStatus = useCallback((st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    const d = Math.floor((st.durationMillis ?? 0) / 1000);
    if (!videoSeekingRef.current) {
      setPos(Math.round((st.positionMillis ?? 0) / 100) / 10);
    }
    setDur(d); durRef.current = d;
    setIsPlaying(st.isPlaying);
    if (st.didJustFinish && currentIdx < videos.length - 1) playNext();
  }, [currentIdx, videos.length, playNext]);

  const togglePlay = useCallback(async () => {
    const v = videoRef.current; if (!v) return;
    const st = await v.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    st.isPlaying ? v.pauseAsync() : v.playAsync();
    bumpControls();
  }, [bumpControls]);

  /* ── Controls overlay ── */
  function Controls({ inFullscreen }: { inFullscreen: boolean }) {
    if (inFullscreen && !ctrlsVis) return null;
    return (
      <View style={[styles.overlay, inFullscreen && { paddingBottom: 20 }]}>
        <View style={styles.overlayTop}>
          <Text style={styles.videoTitle} numberOfLines={1}>{current?.title}</Text>
          {inFullscreen && (
            <TouchableOpacity onPress={exitFullscreen} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="contract" size={22} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.seekRow}>
          <Text style={styles.seekTime}>{fmtMs(pos * 1000)}</Text>
          <View style={styles.seekTrackWrap}>
            <SeekBar
              position={pos}
              duration={dur}
              color="#40c4ff"
              onScrubStart={() => {
                videoSeekingRef.current = true;
                const v = videoRef.current;
                if (!v) return;
                void v.getStatusAsync().then(st => {
                  if (st.isLoaded) wasPlayingBeforeScrubRef.current = st.isPlaying;
                  if (st.isLoaded && st.isPlaying) v.pauseAsync().catch(() => {});
                });
              }}
              onScrubEnd={() => {
                videoSeekingRef.current = false;
                if (wasPlayingBeforeScrubRef.current) {
                  videoRef.current?.playAsync().catch(() => {});
                }
              }}
              onSeek={handleVideoSeek}
            />
          </View>
          <Text style={styles.seekTime}>{fmtMs(dur * 1000)}</Text>
        </View>

        <View style={styles.ctrlRow}>
          {inFullscreen && (
            <TouchableOpacity onPress={playPrev} style={styles.ctrlBtn} disabled={currentIdx <= 0}>
              <Ionicons name="play-skip-back" size={22} color={currentIdx > 0 ? '#ccc' : '#333'} />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => videoRef.current?.setPositionAsync(Math.max(0, pos - 10) * 1000)} style={styles.ctrlBtn}>
            <Ionicons name="play-back" size={22} color="#ccc" />
            <Text style={styles.ctrlLabel}>−10s</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => videoRef.current?.setPositionAsync(Math.min(dur, pos + 10) * 1000)} style={styles.ctrlBtn}>
            <Ionicons name="play-forward" size={22} color="#ccc" />
            <Text style={styles.ctrlLabel}>+10s</Text>
          </TouchableOpacity>

          {inFullscreen ? (
            <>
              <TouchableOpacity onPress={playNext} style={styles.ctrlBtn} disabled={currentIdx >= videos.length - 1}>
                <Ionicons name="play-skip-forward" size={22} color={currentIdx < videos.length - 1 ? '#ccc' : '#333'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSwitcher(v => !v)} style={[styles.ctrlBtn, { marginLeft: 6 }]}>
                <Ionicons name="list" size={22} color="#40c4ff" />
                <Text style={[styles.ctrlLabel, { color: '#40c4ff' }]}>Список</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={enterFullscreen} style={[styles.ctrlBtn, { marginLeft: 8 }]}>
              <Ionicons name="expand" size={22} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  /* ─── Render ─── */
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
          <Text style={[styles.rowTitle, active && { color: '#40c4ff' }]} numberOfLines={1}>{item.title}</Text>
        </View>
        {active && isPlaying && <Ionicons name="pulse" size={16} color="#40c4ff" />}
        <TouchableOpacity onPress={() => deleteVideo(item.id, index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color="#c0392b" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const zoneW = fullscreen ? fsW : width;
  const zoneH = fullscreen ? fsH : VIDEO_H;

  return (
    <View style={[styles.container, { paddingTop: fullscreen ? 0 : (embedded ? 8 : insets.top) }]}>

      {/* Single Video instance — shell resizes for fullscreen (no duplicate player) */}
      {current ? (
        <View
          style={
            fullscreen
              ? [StyleSheet.absoluteFillObject, styles.fsOverlay]
              : [styles.player, { height: VIDEO_H + 90 }]
          }
        >
          <View style={[styles.videoWrap, fullscreen && styles.videoWrapFs]}>
            <Video
              ref={videoRef}
              source={{ uri: current.uri }}
              style={fullscreen ? styles.videoFs : [styles.video, { height: VIDEO_H }]}
              resizeMode={'contain' as any}
              rate={playbackRate}
              shouldCorrectPitch
              shouldPlay
              progressUpdateIntervalMillis={100}
              onPlaybackStatusUpdate={onStatus}
            />
            <VideoTapZones
              width={zoneW}
              height={zoneH}
              seekBack={seekBackTap}
              seekForward={seekForwardTap}
              bumpControls={bumpControls}
              syncRate={syncRate}
            />
          </View>
          <Controls inFullscreen={fullscreen} />

          {fullscreen && showSwitcher && (
            <View style={styles.switcher}>
              <Text style={styles.switcherTitle}>ВИДЕО</Text>
              <FlatList
                data={videos}
                keyExtractor={v => v.id}
                style={{ maxHeight: 240 }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.switchItem, index === currentIdx && styles.switchItemActive]}
                    onPress={() => playAt(index)}
                  >
                    <Ionicons name={index === currentIdx ? 'videocam' : 'videocam-outline'} size={14}
                      color={index === currentIdx ? '#40c4ff' : '#888'} />
                    <Text style={[styles.switchItemText, index === currentIdx && { color: '#40c4ff' }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      ) : !fullscreen ? (
        <View style={[styles.player, { height: VIDEO_H + 90 }]}>
          <TouchableOpacity style={[styles.videoPlaceholder, { height: VIDEO_H }]} onPress={pickVideos}>
            <Ionicons name="film-outline" size={48} color="#2a2a3a" />
            <Text style={styles.placeholderText}>Выберите видео из списка ниже</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!fullscreen && (
      <>
      {/* Prev/Next nav */}
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

      {/* List */}
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
            <Text style={styles.hintText}>Долгое нажатие — удалить из списка</Text>
          </TouchableOpacity>
        }
      />
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  player:    { width: '100%', backgroundColor: '#000', position: 'relative' },
  videoWrap:   { position: 'relative', width: '100%' },
  videoWrapFs: { flex: 1 },
  video:       { width: '100%' },
  videoFs:     { flex: 1, width: '100%', height: '100%' },
  videoPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d14' },
  placeholderText:  { color: '#2a2a3a', fontSize: 13, marginTop: 10 },

  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#000000dd', paddingHorizontal: 12, paddingVertical: 8,
    zIndex: 4,
  },
  overlayTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  videoTitle:  { flex: 1, color: '#bbb', fontSize: 12, fontWeight: '600', marginRight: 8 },

  seekRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  seekTime:      { color: '#777', fontSize: 10, width: 34, textAlign: 'center' },
  seekTrackWrap: { flex: 1 },

  ctrlRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  ctrlBtn:   { alignItems: 'center', padding: 8 },
  ctrlLabel: { color: '#555', fontSize: 9, marginTop: 1 },
  playBtn:   {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#40c4ff22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#40c4ff44', marginHorizontal: 8,
  },

  navRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#1a1a24' },
  navBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navText:   { fontSize: 12 },
  navCount:  { color: '#444', fontSize: 11 },

  listHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  listTitle: { color: '#444', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText:{ color: '#40c4ff', fontSize: 12, fontWeight: '700' },

  list:      { flex: 1, paddingHorizontal: 10 },
  emptyWrap: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { color: '#444', fontSize: 13, textAlign: 'center' },
  hintText:  { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 18 },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111118', borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#1e1e28' },
  rowActive:{ borderColor: '#40c4ff44', backgroundColor: '#40c4ff08' },
  rowIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo:  { flex: 1 },
  rowTitle: { color: '#ccc', fontSize: 13, fontWeight: '600' },

  /* Fullscreen overlay */
  fsOverlay: { backgroundColor: '#000', zIndex: 999 },

  /* Floating switcher */
  switcher:      { position: 'absolute', right: 0, top: 0, bottom: 72, width: 220, backgroundColor: '#000000ee', padding: 10, borderLeftWidth: 1, borderColor: '#1e1e28', zIndex: 6 },
  switcherTitle: { color: '#444', fontSize: 9, letterSpacing: 2, fontWeight: '700', marginBottom: 6 },
  switchItem:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#111' },
  switchItemActive: { backgroundColor: '#40c4ff11' },
  switchItemText:   { flex: 1, color: '#888', fontSize: 12 },
});
