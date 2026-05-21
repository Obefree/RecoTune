import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert,
} from 'react-native';
import SeekBar from '../components/SeekBar';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useMediaRemoteControls } from '../hooks/useMediaRemoteControls';
import { applyPlaybackAudioMode } from '../utils/playbackAudioMode';
import { assertPlaybackFileExists } from '../utils/playbackUri';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';

interface Track {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  duration?: number;   // ms
  source: 'device' | 'recording';
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
function fmtSec(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type SortMode = 'default' | 'az' | 'za' | 'fav';

export default function PlayerScreen() {
  const [libTab, setLibTab]           = useState<'device' | 'recordings'>('device');
  const [deviceTracks, setDeviceTracks] = useState<Track[]>([]);
  const [recTracks, setRecTracks]     = useState<Track[]>([]);
  const [loadingLib, setLoadingLib]   = useState(false);
  const [favorites, setFavorites]     = useState<Set<string>>(new Set());
  const [sortMode, setSortMode]       = useState<SortMode>('default');

  // Playback state
  const [queue, setQueue]             = useState<Track[]>([]);
  const [queueIdx, setQueueIdx]       = useState(-1);
  const [isShuffled, setIsShuffled]   = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [pos, setPos]                 = useState(0);    // seconds
  const [dur, setDur]                 = useState(0);    // seconds
  const [repeat, setRepeat]           = useState<'none' | 'one' | 'all'>('all');

  const soundRef     = useRef<Audio.Sound | null>(null);
  const busyRef      = useRef(false);
  const queueRef     = useRef(queue);
  const idxRef       = useRef(queueIdx);
  const repeatRef    = useRef(repeat);
  const durRef       = useRef(dur);
  const playerSeekingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);

  useEffect(() => { queueRef.current = queue;    }, [queue]);
  useEffect(() => { idxRef.current   = queueIdx; }, [queueIdx]);
  useEffect(() => { repeatRef.current = repeat;  }, [repeat]);
  useEffect(() => { durRef.current    = dur;     }, [dur]);

  const handlePlayerSeek = useCallback(async (seconds: number) => {
    const s = soundRef.current;
    if (!s || durRef.current <= 0) return;
    try {
      await s.setPositionAsync(Math.round(seconds * 1000));
      setPos(Math.floor(seconds));
    } catch {}
  }, []);

  /* ─── Pick audio files via DocumentPicker ─── */
  const pickAudioFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: false,
      });
      if (result.canceled) return;
      const picked: Track[] = result.assets.map(a => ({
        id: a.uri,
        uri: a.uri,
        title: (a.name ?? a.uri.split('/').pop() ?? 'Track').replace(/\.[^.]+$/, ''),
        source: 'device' as const,
      }));
      setDeviceTracks(prev => {
        const existing = new Set(prev.map(t => t.uri));
        return [...prev, ...picked.filter(t => !existing.has(t.uri))];
      });
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    }
  }, []);

  /* ─── Load app recordings ─── */
  const loadRecordings = useCallback(async () => {
    try {
      await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
      const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
      const tracks: Track[] = files
        .filter(f => /\.(m4a|wav|mp3|caf|mp4)$/i.test(f))
        .map(f => {
          const ts = parseInt(f.replace(/\D/g, '').slice(0, 13)) || 0;
          return {
            id: f, uri: RECORDINGS_DIR + f,
            title: f.replace(/\.[^.]+$/, ''),
            artist: 'My Recording',
            source: 'recording' as const,
          };
        });
      setRecTracks(tracks.reverse());
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadRecordings();
    return () => {};
  }, [loadRecordings]));

  /* ─── Kill sound ─── */
  const killSound = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) { try { await s.stopAsync(); await s.unloadAsync(); } catch {} }
    setIsPlaying(false); setPos(0); setDur(0);
  }, []);

  /* ─── Play a track at queue index ─── */
  const playAt = useCallback(async (idx: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const q = queueRef.current;
    if (idx < 0 || idx >= q.length) { busyRef.current = false; return; }

    await killSound();
    setQueueIdx(idx); idxRef.current = idx;

    try {
      await applyPlaybackAudioMode();
      const playbackUri = await assertPlaybackFileExists(q[idx].uri);
      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (!playerSeekingRef.current) {
            setPos(Math.floor((status.positionMillis ?? 0) / 1000));
          }
          setDur(Math.floor((status.durationMillis ?? 0) / 1000));
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            // Auto-advance
            const curIdx = idxRef.current;
            const curQ   = queueRef.current;
            const rep    = repeatRef.current;
            if (rep === 'one') {
              sound.replayAsync().catch(() => {});
            } else if (curIdx + 1 < curQ.length) {
              playAt(curIdx + 1);
            } else if (rep === 'all' && curQ.length > 0) {
              playAt(0);
            }
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      Alert.alert('Playback error', String(e));
    }
    busyRef.current = false;
  }, [killSound]);

  /* ─── Controls ─── */
  const togglePlay = useCallback(async () => {
    const s = soundRef.current;
    if (!s) {
      if (queueRef.current.length > 0) playAt(Math.max(0, idxRef.current));
      return;
    }
    const st = await s.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    if (st.isPlaying) await s.pauseAsync(); else await s.playAsync();
  }, [playAt]);

  const playNext = useCallback(() => {
    const idx = idxRef.current, q = queueRef.current;
    if (idx + 1 < q.length) playAt(idx + 1);
    else if (repeatRef.current === 'all') playAt(0);
  }, [playAt]);

  const playPrev = useCallback(() => {
    const idx = idxRef.current;
    if (idx > 0) playAt(idx - 1);
  }, [playAt]);

  const skipForward = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    const st = await s.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded || !st.durationMillis) return;
    const nextMs = Math.min(st.durationMillis, (st.positionMillis ?? 0) + 10_000);
    await s.setPositionAsync(nextMs);
    setPos(Math.floor(nextMs / 1000));
  }, []);

  const skipBackward = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    const st = await s.getStatusAsync() as AVPlaybackStatus;
    if (!st.isLoaded) return;
    const nextMs = Math.max(0, (st.positionMillis ?? 0) - 10_000);
    await s.setPositionAsync(nextMs);
    setPos(Math.floor(nextMs / 1000));
  }, []);

  const currentTrack = queueIdx >= 0 && queueIdx < queue.length ? queue[queueIdx] : null;

  useMediaRemoteControls(
    queueIdx >= 0 && !!currentTrack,
    'queue',
    {
      onTogglePlay: togglePlay,
      onNext: playNext,
      onPrevious: playPrev,
      onSkipForward: skipForward,
      onSkipBackward: skipBackward,
      onSeek: handlePlayerSeek,
    },
    currentTrack
      ? {
          title: currentTrack.title,
          artist: currentTrack.artist,
          durationSec: dur,
          elapsedSec: pos,
          isPlaying,
        }
      : null,
  );

  /* ─── Build queue from track list ─── */
  const enqueueAll = useCallback((tracks: Track[], startIdx: number) => {
    const q = isShuffled
      ? (() => {
          const s = shuffle(tracks);
          // Move the tapped track to front
          const item = tracks[startIdx];
          const fi = s.findIndex(t => t.id === item.id);
          if (fi >= 0) { s.splice(fi, 1); s.unshift(item); }
          return s;
        })()
      : [...tracks];
    const playIdx = isShuffled ? 0 : startIdx;
    setQueue(q); queueRef.current = q;
    playAt(playIdx);
  }, [isShuffled, playAt]);

  const toggleShuffle = useCallback(() => {
    setIsShuffled(v => {
      const next = !v;
      if (queueRef.current.length > 0) {
        const cur = queueRef.current[idxRef.current];
        const newQ = next ? shuffle(queueRef.current) : [...queueRef.current].sort((a, b) => a.title.localeCompare(b.title));
        const newIdx = newQ.findIndex(t => t.id === cur?.id);
        setQueue(newQ); queueRef.current = newQ;
        setQueueIdx(newIdx); idxRef.current = newIdx;
      }
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');
  }, []);

  useFocusEffect(useCallback(() => () => { killSound(); }, [killSound]));

  /* ─── Favorites ─── */
  const toggleFav = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /* ─── Delete from list ─── */
  const deleteTrack = useCallback((id: string) => {
    setDeviceTracks(prev => prev.filter(t => t.id !== id));
    setRecTracks(prev => prev.filter(t => t.id !== id));
    setFavorites(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  /* ─── Sort ─── */
  function applySort(tracks: Track[], mode: SortMode, favs: Set<string>): Track[] {
    const arr = [...tracks];
    if (mode === 'az')  return arr.sort((a, b) => a.title.localeCompare(b.title));
    if (mode === 'za')  return arr.sort((a, b) => b.title.localeCompare(a.title));
    if (mode === 'fav') return arr.sort((a, b) => (favs.has(b.id) ? 1 : 0) - (favs.has(a.id) ? 1 : 0));
    return arr;
  }

  const cycleSortMode = useCallback(() => {
    setSortMode(m => m === 'default' ? 'az' : m === 'az' ? 'za' : m === 'za' ? 'fav' : 'default');
  }, []);

  /* ─── Render ─── */
  const rawTracks    = libTab === 'device' ? deviceTracks : recTracks;
  const activeTracks = applySort(rawTracks, sortMode, favorites);

  const renderTrack = ({ item, index }: { item: Track; index: number }) => {
    const playing = currentTrack?.id === item.id;
    const isFav   = favorites.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.trackRow, playing && styles.trackRowActive, isFav && styles.trackRowFav]}
        onPress={() => enqueueAll(activeTracks, index)}
        onLongPress={() => Alert.alert(
          item.title,
          undefined,
          [
            { text: isFav ? '★ Убрать из избранного' : '☆ В избранное', onPress: () => toggleFav(item.id) },
            { text: '🗑 Удалить из списка', style: 'destructive', onPress: () => deleteTrack(item.id) },
            { text: 'Отмена', style: 'cancel' },
          ]
        )}
        activeOpacity={0.75}
        delayLongPress={400}
      >
        <View style={[styles.trackIcon, { backgroundColor: playing ? '#7c4dff22' : '#1a1a24' }]}>
          <Ionicons
            name={playing && isPlaying ? 'musical-note' : 'musical-notes-outline'}
            size={18}
            color={playing ? '#7c4dff' : '#555'}
          />
        </View>
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, playing && { color: '#7c4dff' }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.artist && (
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
          )}
        </View>
        {item.duration != null && item.duration > 0 && (
          <Text style={styles.trackDur}>{fmtMs(item.duration)}</Text>
        )}
        <TouchableOpacity onPress={() => toggleFav(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isFav ? 'star' : 'star-outline'} size={18} color={isFav ? '#ffb300' : '#333'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert(item.title, 'Удалить из списка?', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Удалить', style: 'destructive', onPress: () => deleteTrack(item.id) },
          ])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 2 }}
        >
          <Ionicons name="trash-outline" size={16} color="#c0392b" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── Now Playing ── */}
      <View style={styles.nowPlaying}>
        <View style={styles.npArt}>
          <Ionicons name="musical-notes" size={36} color="#7c4dff66" />
        </View>
        <View style={styles.npInfo}>
          <Text style={styles.npTitle} numberOfLines={1}>
            {currentTrack?.title ?? 'No track selected'}
          </Text>
          <Text style={styles.npArtist} numberOfLines={1}>
            {currentTrack?.artist ?? (currentTrack ? 'Device Audio' : 'Tap a track to play')}
          </Text>
        </View>

        {/* Seek bar — drag to scrub */}
        <View style={styles.seekRow}>
          <Text style={styles.seekTime}>{fmtSec(pos)}</Text>
          <View style={styles.seekTrackWrap}>
            <SeekBar
              position={pos}
              duration={dur}
              color="#7c4dff"
              onScrubStart={() => {
                playerSeekingRef.current = true;
                const s = soundRef.current;
                if (!s) return;
                void s.getStatusAsync().then(st => {
                  if (st.isLoaded) wasPlayingBeforeScrubRef.current = st.isPlaying;
                  if (st.isLoaded && st.isPlaying) s.pauseAsync().catch(() => {});
                });
              }}
              onScrubEnd={() => {
                playerSeekingRef.current = false;
                if (wasPlayingBeforeScrubRef.current) {
                  soundRef.current?.playAsync().catch(() => {});
                }
              }}
              onSeek={handlePlayerSeek}
            />
          </View>
          <Text style={styles.seekTime}>{fmtSec(dur)}</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={cycleRepeat} style={styles.ctrlSm}>
            <Ionicons
              name={repeat === 'one' ? 'repeat' : 'repeat-outline'}
              size={26}
              color={repeat !== 'none' ? '#7c4dff' : '#555'}
            />
            {repeat === 'one' && <Text style={styles.ctrlBadge}>1</Text>}
            <Text style={[styles.ctrlLabel, repeat !== 'none' && { color: '#7c4dff' }]}>
              {repeat === 'none' ? 'Off' : repeat === 'all' ? 'All' : 'One'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={playPrev} style={styles.ctrl}>
            <Ionicons name="play-skip-back" size={34} color={currentTrack ? '#ccc' : '#333'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={36}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={playNext} style={styles.ctrl}>
            <Ionicons name="play-skip-forward" size={34} color={currentTrack ? '#ccc' : '#333'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleShuffle} style={styles.ctrlSm}>
            <Ionicons
              name="shuffle"
              size={26}
              color={isShuffled ? '#00e676' : '#555'}
            />
            <Text style={[styles.ctrlLabel, isShuffled && { color: '#00e676' }]}>
              {isShuffled ? 'On' : 'Off'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Queue info */}
        {queue.length > 0 && (
          <Text style={styles.queueInfo}>
            {queueIdx + 1} / {queue.length}  ·  {isShuffled ? '🔀 Shuffle' : '▶ In order'}  ·  {
              repeat === 'none' ? '↩ No repeat' : repeat === 'all' ? '🔁 Repeat all' : '🔂 Repeat one'
            }
          </Text>
        )}
      </View>

      {/* ── Library tabs ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setLibTab('device')}
          style={[styles.tabBtn, libTab === 'device' && styles.tabBtnActive]}
        >
          <Ionicons name="folder-open-outline" size={14} color={libTab === 'device' ? '#7c4dff' : '#555'} />
          <Text style={[styles.tabBtnText, libTab === 'device' && { color: '#7c4dff' }]}>
            ФАЙЛЫ ({deviceTracks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLibTab('recordings')}
          style={[styles.tabBtn, libTab === 'recordings' && styles.tabBtnActive]}
        >
          <Ionicons name="mic-outline" size={14} color={libTab === 'recordings' ? '#7c4dff' : '#555'} />
          <Text style={[styles.tabBtnText, libTab === 'recordings' && { color: '#7c4dff' }]}>
            ЗАПИСИ ({recTracks.length})
          </Text>
        </TouchableOpacity>
        {libTab === 'device' ? (
          <TouchableOpacity onPress={pickAudioFiles} style={styles.refreshBtn}>
            <Ionicons name="add-circle-outline" size={22} color="#7c4dff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={loadRecordings} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color="#555" />
          </TouchableOpacity>
        )}
      </View>
      {libTab === 'device' && deviceTracks.length === 0 && (
        <TouchableOpacity style={styles.sourceHintBtn} onPress={pickAudioFiles}>
          <Ionicons name="add-circle" size={36} color="#7c4dff44" />
          <Text style={styles.sourceHint}>Нажмите + чтобы добавить аудиофайлы{'\n'}(MP3, AAC, FLAC, WAV и др.)</Text>
        </TouchableOpacity>
      )}

      {/* Sort bar */}
      {activeTracks.length > 1 && (
        <View style={styles.sortRow}>
          <Ionicons name="funnel-outline" size={12} color="#333" />
          <TouchableOpacity onPress={cycleSortMode} style={styles.sortBtn}>
            <Text style={styles.sortBtnText}>
              {sortMode === 'default' ? 'По умолчанию' :
               sortMode === 'az'      ? 'А → Я' :
               sortMode === 'za'      ? 'Я → А' : '★ Избранное'}
            </Text>
            <Ionicons name="chevron-forward" size={11} color="#555" />
          </TouchableOpacity>
          {favorites.size > 0 && (
            <Text style={styles.favCount}>★ {favorites.size}</Text>
          )}
        </View>
      )}

      {/* Track list */}
      <FlatList
        data={activeTracks}
        keyExtractor={t => t.id}
        renderItem={renderTrack}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {libTab === 'recordings' ? 'Записей пока нет' : ''}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  /* Now playing */
  nowPlaying: {
    backgroundColor: '#111118', margin: 12, borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: '#1e1e28', alignItems: 'center',
  },
  npArt: {
    width: 72, height: 72, borderRadius: 16, backgroundColor: '#1a1a2a',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: '#2a2a3a',
  },
  npInfo: { width: '100%', alignItems: 'center', marginBottom: 10 },
  npTitle: { color: '#e0e0e0', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  npArtist: { color: '#555', fontSize: 12, marginTop: 3 },

  seekRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 16 },
  seekTime: { color: '#666', fontSize: 11, width: 36, textAlign: 'center' },
  seekTrackWrap: { flex: 1 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', width: '100%', marginBottom: 8 },
  ctrl:   { padding: 12 },
  ctrlSm: { alignItems: 'center', padding: 10, minWidth: 52, position: 'relative' },
  ctrlBadge: { position: 'absolute', top: 6, right: 6, color: '#7c4dff', fontSize: 8, fontWeight: '900' },
  ctrlLabel: { color: '#555', fontSize: 9, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  playBtn: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#7c4dff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7c4dff', shadowOpacity: 0.5, shadowRadius: 12, elevation: 6,
  },
  queueInfo: { color: '#333', fontSize: 10, letterSpacing: 0.5, marginTop: 2 },

  /* Library */
  tabRow: {
    flexDirection: 'row', marginHorizontal: 12, marginBottom: 4,
    backgroundColor: '#111118', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#1e1e28',
  },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  tabBtnActive: { backgroundColor: '#1e1e2e' },
  tabBtnText:   { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  refreshBtn:   { paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  sourceHintBtn:{ alignItems: 'center', gap: 8, padding: 32 },
  sourceHint:   { color: '#333', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  list: { flex: 1, paddingHorizontal: 12 },
  emptyText: { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 40 },

  trackRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111118', borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#1e1e28' },
  trackRowActive: { borderColor: '#7c4dff44', backgroundColor: '#7c4dff08' },
  trackRowFav:    { borderColor: '#ffb30033' },
  trackIcon:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  trackInfo:      { flex: 1 },
  trackTitle:     { color: '#ccc', fontSize: 13, fontWeight: '600' },
  trackArtist:    { color: '#444', fontSize: 11, marginTop: 2 },
  trackDur:       { color: '#333', fontSize: 11 },

  sortRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 4 },
  sortBtn:        { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#1a1a24', borderRadius: 8 },
  sortBtnText:    { color: '#555', fontSize: 10, fontWeight: '700' },
  favCount:       { marginLeft: 'auto' as any, color: '#ffb300', fontSize: 10, fontWeight: '700' },
});
