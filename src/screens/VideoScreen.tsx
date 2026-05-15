import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  PanResponder, useWindowDimensions, Alert,
  StatusBar, Pressable,
} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

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

export default function VideoScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
  const seekBarW   = useRef(1);
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

  useFocusEffect(useCallback(() => () => {
    setFullscreen(false);
    StatusBar.setHidden(false, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []));

  /* ── Seek PanResponder ── */
  const seekPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      const p = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarW.current));
      videoRef.current?.setPositionAsync(p * durRef.current * 1000).catch(() => {});
    },
    onPanResponderMove: (e) => {
      const p = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarW.current));
      videoRef.current?.setPositionAsync(p * durRef.current * 1000).catch(() => {});
    },
  })).current;

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
    setPos(Math.floor((st.positionMillis ?? 0) / 1000));
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

  /* ── Seek bar ── */
  function SeekBar() {
    const pct = dur > 0 ? (pos / dur) * 100 : 0;
    return (
      <View style={styles.seekRow}>
        <Text style={styles.seekTime}>{fmtMs(pos * 1000)}</Text>
        <View
          style={styles.seekTrack}
          onLayout={e => { seekBarW.current = e.nativeEvent.layout.width; }}
          {...seekPan.panHandlers}
        >
          {/* background line */}
          <View style={styles.seekBg} />
          {/* filled portion */}
          <View style={[styles.seekFill, { width: pct + '%' as any }]} />
          {/* thumb — sits ON the line */}
          <View style={[styles.seekThumb, { left: pct + '%' as any }]} />
        </View>
        <Text style={styles.seekTime}>{fmtMs(dur * 1000)}</Text>
      </View>
    );
  }

  /* ── Controls overlay ── */
  function Controls({ inFullscreen }: { inFullscreen: boolean }) {
    if (!ctrlsVis) return null;
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

        <SeekBar />

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Inline player (always rendered — never unmounts Video) ── */}
      <View style={[styles.player, { height: VIDEO_H + 90 }]}>
        {current ? (
          <>
            <View style={styles.videoWrap}>
              <Video
                ref={videoRef}
                source={{ uri: current.uri }}
                style={[styles.video, { height: VIDEO_H }]}
                resizeMode={'contain' as any}
                rate={playbackRate}
                shouldCorrectPitch
                shouldPlay
                onPlaybackStatusUpdate={onStatus}
              />
              {!fullscreen && (
                <VideoTapZones
                  width={width}
                  height={VIDEO_H}
                  seekBack={seekBackTap}
                  seekForward={seekForwardTap}
                  bumpControls={bumpControls}
                  syncRate={syncRate}
                />
              )}
            </View>
            {!fullscreen && <Controls inFullscreen={false} />}
          </>
        ) : (
          <TouchableOpacity style={[styles.videoPlaceholder, { height: VIDEO_H }]} onPress={pickVideos}>
            <Ionicons name="film-outline" size={48} color="#2a2a3a" />
            <Text style={styles.placeholderText}>Выберите видео из списка ниже</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Fullscreen overlay (no Modal — avoids Video remount) ── */}
      {fullscreen && current && (
        <View style={[StyleSheet.absoluteFillObject, styles.fsOverlay, { width: fsW, height: fsH }]}>
          <Video
            ref={videoRef}
            source={{ uri: current.uri }}
            style={{ width: fsW, height: fsH }}
            resizeMode={'contain' as any}
            rate={playbackRate}
            shouldCorrectPitch
            shouldPlay={isPlaying}
            onPlaybackStatusUpdate={onStatus}
          />
          <VideoTapZones
            width={fsW}
            height={fsH}
            seekBack={seekBackTap}
            seekForward={seekForwardTap}
            bumpControls={bumpControls}
            syncRate={syncRate}
          />
          <Controls inFullscreen />

          {showSwitcher && (
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
      )}

      {/* Prev/Next nav */}
      {current && videos.length > 1 && !fullscreen && (
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
    </View>
  );
}

/* ── Track line is 4px tall, container is 28px; thumb is 16px centered on line ── */
const TRACK_H  = 4;
const THUMB_D  = 16;
const BAR_H    = 28;
const TRACK_TOP = (BAR_H - TRACK_H) / 2;   // 12
const THUMB_TOP = (BAR_H - THUMB_D) / 2;   // 6

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  player:    { width: '100%', backgroundColor: '#000', position: 'relative' },
  videoWrap: { position: 'relative', width: '100%' },
  video:     { width: '100%' },
  videoPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d14' },
  placeholderText:  { color: '#2a2a3a', fontSize: 13, marginTop: 10 },

  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#000000dd', paddingHorizontal: 12, paddingVertical: 8,
    zIndex: 4,
  },
  overlayTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  videoTitle:  { flex: 1, color: '#bbb', fontSize: 12, fontWeight: '600', marginRight: 8 },

  seekRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  seekTime:  { color: '#777', fontSize: 10, width: 34, textAlign: 'center' },
  seekTrack: { flex: 1, height: BAR_H, position: 'relative' },
  seekBg:    { position: 'absolute', left: 0, right: 0, top: TRACK_TOP, height: TRACK_H, backgroundColor: '#444', borderRadius: 2 },
  seekFill:  { position: 'absolute', left: 0,            top: TRACK_TOP, height: TRACK_H, backgroundColor: '#40c4ff', borderRadius: 2 },
  seekThumb: { position: 'absolute', top: THUMB_TOP, width: THUMB_D, height: THUMB_D, borderRadius: THUMB_D / 2, backgroundColor: '#40c4ff', marginLeft: -(THUMB_D / 2) },

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
