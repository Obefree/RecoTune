/** Built-in song library — chord progressions for practice */

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  /** Space-separated chord names, e.g. "Am F C G" */
  chords: string;
  key?: string;
  bpm?: number;
  /** 1=easy (2-3 chords), 2=medium (4-5), 3=hard (6+) */
  difficulty: 1 | 2 | 3;
  genre: string;
}

export const SONGS: SongEntry[] = [

  /* ── EASY ──────────────────────────────────────────────── */
  { id:'s001', title:'Let It Be',            artist:'The Beatles',       chords:'C G Am F',              key:'C',  bpm:76,  difficulty:1, genre:'Classic Rock' },
  { id:'s002', title:'Knockin\' on Heaven\'s Door', artist:'Bob Dylan', chords:'G D Am',               key:'G',  bpm:72,  difficulty:1, genre:'Folk Rock' },
  { id:'s003', title:'No Woman No Cry',      artist:'Bob Marley',        chords:'C G Am F',              key:'C',  bpm:80,  difficulty:1, genre:'Reggae' },
  { id:'s004', title:'Stand By Me',          artist:'Ben E. King',       chords:'A F#m D E',             key:'A',  bpm:122, difficulty:1, genre:'Soul' },
  { id:'s005', title:'Brown Eyed Girl',      artist:'Van Morrison',      chords:'G C D Em',              key:'G',  bpm:150, difficulty:1, genre:'Rock' },
  { id:'s006', title:'Sweet Home Alabama',   artist:'Lynyrd Skynyrd',    chords:'D C G',                 key:'D',  bpm:98,  difficulty:1, genre:'Southern Rock' },
  { id:'s007', title:'Blowin\' in the Wind', artist:'Bob Dylan',         chords:'G C D',                 key:'G',  bpm:90,  difficulty:1, genre:'Folk' },
  { id:'s008', title:'Perfect',              artist:'Ed Sheeran',        chords:'G Em C D',              key:'G',  bpm:95,  difficulty:1, genre:'Pop' },
  { id:'s009', title:'With or Without You',  artist:'U2',                chords:'D A Bm G',              key:'D',  bpm:110, difficulty:1, genre:'Rock' },
  { id:'s010', title:'Zombie',               artist:'The Cranberries',   chords:'Am F C G',              key:'Am', bpm:102, difficulty:1, genre:'Alternative' },
  { id:'s011', title:'Let Her Go',           artist:'Passenger',         chords:'G D Em C',              key:'G',  bpm:104, difficulty:1, genre:'Pop Folk' },
  { id:'s012', title:'Time of Your Life',    artist:'Green Day',         chords:'G Cadd9 Dsus4 Em7',     key:'G',  bpm:88,  difficulty:1, genre:'Punk Rock' },
  { id:'s013', title:'Boulevard of Broken Dreams', artist:'Green Day',   chords:'Em G D A',              key:'Em', bpm:168, difficulty:1, genre:'Punk Rock' },
  { id:'s014', title:'Come As You Are',      artist:'Nirvana',           chords:'Em G D Am',             key:'Em', bpm:120, difficulty:1, genre:'Grunge' },
  { id:'s015', title:'Fix You',              artist:'Coldplay',          chords:'C Em Am F',             key:'C',  bpm:138, difficulty:1, genre:'Alternative' },
  { id:'s016', title:'Imagine',              artist:'John Lennon',       chords:'C F G Am Dm',           key:'C',  bpm:75,  difficulty:1, genre:'Pop Rock' },
  { id:'s017', title:'Wonderful Tonight',    artist:'Eric Clapton',      chords:'G D C Em',              key:'G',  bpm:95,  difficulty:1, genre:'Soft Rock' },
  { id:'s018', title:'Shape of You',         artist:'Ed Sheeran',        chords:'Am Dm F G',             key:'Am', bpm:96,  difficulty:1, genre:'Pop' },
  { id:'s019', title:'Losing My Religion',   artist:'R.E.M.',            chords:'Am Em Dm G C F',        key:'Am', bpm:128, difficulty:2, genre:'Alternative' },
  { id:'s020', title:'Wish You Were Here',   artist:'Pink Floyd',        chords:'C D Am G Em',           key:'G',  bpm:60,  difficulty:1, genre:'Progressive Rock' },

  /* ── MEDIUM ─────────────────────────────────────────────── */
  { id:'s021', title:'Wonderwall',           artist:'Oasis',             chords:'Em7 G Dsus4 A7sus4 C',  key:'G',  bpm:87,  difficulty:2, genre:'Britpop' },
  { id:'s022', title:'Don\'t Look Back in Anger', artist:'Oasis',       chords:'C G Am E F Fm',          key:'C',  bpm:124, difficulty:2, genre:'Britpop' },
  { id:'s023', title:'Hotel California',     artist:'Eagles',            chords:'Am E7 G D F C Dm E',    key:'Am', bpm:147, difficulty:3, genre:'Rock' },
  { id:'s024', title:'Hallelujah',           artist:'Leonard Cohen',     chords:'C Am F G E',            key:'C',  bpm:66,  difficulty:2, genre:'Folk' },
  { id:'s025', title:'House of the Rising Sun', artist:'The Animals',   chords:'Am C D F E',            key:'Am', bpm:116, difficulty:2, genre:'Blues Rock' },
  { id:'s026', title:'Creep',                artist:'Radiohead',         chords:'G B C Cm',              key:'G',  bpm:92,  difficulty:2, genre:'Alternative' },
  { id:'s027', title:'Mad World',            artist:'Tears for Fears',   chords:'Fm Ab Eb Bb',           key:'Fm', bpm:88,  difficulty:2, genre:'New Wave' },
  { id:'s028', title:'Nothing Else Matters', artist:'Metallica',        chords:'Em Am D G B F#m',       key:'Em', bpm:142, difficulty:3, genre:'Heavy Metal' },
  { id:'s029', title:'Yesterday',            artist:'The Beatles',       chords:'F Em A7 Dm Bb C G',     key:'F',  bpm:97,  difficulty:3, genre:'Classic Rock' },
  { id:'s030', title:'Don\'t Stop Believin\'', artist:'Journey',        chords:'E B C#m A G',           key:'E',  bpm:120, difficulty:2, genre:'Arena Rock' },
  { id:'s031', title:'Thinking Out Loud',    artist:'Ed Sheeran',        chords:'D G A Bm Em',           key:'D',  bpm:79,  difficulty:2, genre:'Pop' },
  { id:'s032', title:'The Sound of Silence', artist:'Simon & Garfunkel', chords:'Am G C F Em Dm',       key:'Am', bpm:105, difficulty:2, genre:'Folk Rock' },
  { id:'s033', title:'Angels',               artist:'Robbie Williams',   chords:'D A Bm G Em F#m',      key:'D',  bpm:108, difficulty:2, genre:'Pop Rock' },
  { id:'s034', title:'Tears in Heaven',      artist:'Eric Clapton',      chords:'A E F#m D Bm G',       key:'A',  bpm:80,  difficulty:3, genre:'Soft Rock' },
  { id:'s035', title:'The Scientist',        artist:'Coldplay',          chords:'Dm Bb F C Am',         key:'F',  bpm:75,  difficulty:2, genre:'Alternative' },
  { id:'s036', title:'High and Dry',         artist:'Radiohead',         chords:'F#m A E D',            key:'A',  bpm:112, difficulty:2, genre:'Alternative' },
  { id:'s037', title:'21 Guns',              artist:'Green Day',         chords:'Dm Bb F C',            key:'Dm', bpm:76,  difficulty:2, genre:'Punk Rock' },
  { id:'s038', title:'Use Somebody',         artist:'Kings of Leon',     chords:'C G Am F',             key:'C',  bpm:136, difficulty:1, genre:'Indie Rock' },
  { id:'s039', title:'Sweet Child O\' Mine', artist:'Guns N\' Roses',   chords:'D Dsus2 C Bb G',        key:'D',  bpm:125, difficulty:2, genre:'Hard Rock' },
  { id:'s040', title:'November Rain',        artist:'Guns N\' Roses',   chords:'G Cadd9 D Dsus4 Am Em', key:'G',  bpm:74,  difficulty:3, genre:'Hard Rock' },
  { id:'s041', title:'Stairway to Heaven',   artist:'Led Zeppelin',      chords:'Am G F C Dm E',        key:'Am', bpm:77,  difficulty:3, genre:'Hard Rock' },
  { id:'s042', title:'Smells Like Teen Spirit', artist:'Nirvana',       chords:'Fm Bb Ab Db',           key:'Fm', bpm:117, difficulty:2, genre:'Grunge' },
  { id:'s043', title:'Clocks',               artist:'Coldplay',          chords:'Eb Bbm Fm',            key:'Eb', bpm:131, difficulty:2, genre:'Alternative' },
  { id:'s044', title:'Sunday Bloody Sunday', artist:'U2',               chords:'Bm D G Em',             key:'D',  bpm:126, difficulty:2, genre:'Rock' },
  { id:'s045', title:'With or Without You',  artist:'U2',               chords:'D A Bm G',              key:'D',  bpm:110, difficulty:1, genre:'Rock' },
  { id:'s046', title:'Hey Jude',             artist:'The Beatles',       chords:'F C Bb F7 C7',         key:'F',  bpm:74,  difficulty:2, genre:'Classic Rock' },
  { id:'s047', title:'Smoke on the Water',   artist:'Deep Purple',       chords:'Gm Bb C Eb F',         key:'Gm', bpm:112, difficulty:2, genre:'Hard Rock' },
  { id:'s048', title:'Enter Sandman',        artist:'Metallica',         chords:'Em D G Am F C',        key:'Em', bpm:122, difficulty:2, genre:'Heavy Metal' },
  { id:'s049', title:'Karma Police',         artist:'Radiohead',         chords:'Am E G F C B Em',      key:'Am', bpm:86,  difficulty:2, genre:'Alternative' },
  { id:'s050', title:'Back in Black',        artist:'AC/DC',             chords:'A D E G B',            key:'A',  bpm:186, difficulty:2, genre:'Hard Rock' },
  { id:'s051', title:'More Than Words',      artist:'Extreme',           chords:'G G/B Cadd9 Am7 C D Em', key:'G', bpm:92, difficulty:3, genre:'Soft Rock' },
  { id:'s052', title:'Wish You Were Here',   artist:'Incubus',           chords:'A E D Bm',             key:'A',  bpm:144, difficulty:1, genre:'Alternative' },
  { id:'s053', title:'Chasing Cars',         artist:'Snow Patrol',       chords:'A Asus4 D F#m',        key:'A',  bpm:104, difficulty:1, genre:'Indie Rock' },
  { id:'s054', title:'Mr. Brightside',       artist:'The Killers',       chords:'C G Am F',             key:'C',  bpm:148, difficulty:1, genre:'Indie Rock' },
  { id:'s055', title:'Somebody That I Used to Know', artist:'Gotye',    chords:'Dm F C G',             key:'Dm', bpm:129, difficulty:2, genre:'Indie Pop' },
  { id:'s056', title:'Apologize',            artist:'OneRepublic',       chords:'Am F C G',             key:'Am', bpm:128, difficulty:1, genre:'Pop Rock' },
  { id:'s057', title:'Viva la Vida',         artist:'Coldplay',          chords:'Ab Bb Cm Eb F Gm',     key:'Ab', bpm:138, difficulty:2, genre:'Alternative' },

  /* ── ACOUSTIC / FINGERPICKING ────────────────────────────── */
  { id:'s058', title:'Blackbird',            artist:'The Beatles',       chords:'G Am7 G7 C Cm D Dsus4 B7 Em', key:'G', bpm:92, difficulty:3, genre:'Folk' },
  { id:'s059', title:'Dust in the Wind',     artist:'Kansas',            chords:'C G Am D F',           key:'C',  bpm:96,  difficulty:2, genre:'Soft Rock' },
  { id:'s060', title:'The House That Built Me', artist:'Miranda Lambert', chords:'C G D Am F Em',      key:'C',  bpm:84,  difficulty:2, genre:'Country' },
  { id:'s061', title:'Free Fallin\'',        artist:'Tom Petty',         chords:'F Bb Fsus2 C',         key:'F',  bpm:84,  difficulty:1, genre:'Rock' },
  { id:'s062', title:'Africa',               artist:'Toto',              chords:'F#m D A E Bm',         key:'A',  bpm:93,  difficulty:2, genre:'Pop Rock' },
  { id:'s063', title:'Take Me to Church',    artist:'Hozier',            chords:'Am F C G Em Dm',       key:'Am', bpm:130, difficulty:2, genre:'Indie Soul' },
  { id:'s064', title:'Skinny Love',          artist:'Bon Iver',          chords:'Am7 C Dsus2 F Em G',   key:'C',  bpm:112, difficulty:2, genre:'Indie Folk' },
  { id:'s065', title:'Fast Car',             artist:'Tracy Chapman',     chords:'C G Am F D',           key:'C',  bpm:103, difficulty:1, genre:'Folk Rock' },

  /* ── RUSSIAN ROCK / POP ──────────────────────────────────── */
  { id:'r001', title:'Группа крови',         artist:'Кино',              chords:'Em C G D',             key:'Em', bpm:118, difficulty:1, genre:'Рок' },
  { id:'r002', title:'Звезда по имени Солнце', artist:'Кино',           chords:'Am E Am G',             key:'Am', bpm:110, difficulty:1, genre:'Рок' },
  { id:'r003', title:'Перемен',              artist:'Кино',              chords:'Am G C F Em',          key:'Am', bpm:108, difficulty:1, genre:'Рок' },
  { id:'r004', title:'Последний герой',       artist:'Кино',             chords:'Em D C G Am',          key:'Em', bpm:95,  difficulty:1, genre:'Рок' },
  { id:'r005', title:'Ты или я',             artist:'Кино',              chords:'Am E Dm G',            key:'Am', bpm:112, difficulty:1, genre:'Рок' },
  { id:'r006', title:'Что такое осень',       artist:'ДДТ',              chords:'Am E Dm G C',          key:'Am', bpm:78,  difficulty:1, genre:'Рок' },
  { id:'r007', title:'Не стреляй',           artist:'ДДТ',               chords:'Am G Dm E',            key:'Am', bpm:90,  difficulty:1, genre:'Рок' },
  { id:'r008', title:'Гудбай Америка',        artist:'Nautilus Pompilius', chords:'Am G C D Em',       key:'Am', bpm:115, difficulty:1, genre:'Рок' },
  { id:'r009', title:'Крылья',               artist:'Nautilus Pompilius', chords:'Am G C E',           key:'Am', bpm:104, difficulty:1, genre:'Рок' },
  { id:'r010', title:'Я хочу быть с тобой',  artist:'Nautilus Pompilius', chords:'C G Am Em F',       key:'C',  bpm:96,  difficulty:1, genre:'Рок' },
  { id:'r011', title:'О любви',              artist:'Чиж & Co',          chords:'G D Am C Em',         key:'G',  bpm:88,  difficulty:1, genre:'Рок' },
  { id:'r012', title:'Фантом',               artist:'Чиж & Co',          chords:'A D E A',             key:'A',  bpm:120, difficulty:1, genre:'Рок' },
  { id:'r013', title:'Непокорённые',         artist:'Чиж & Co',          chords:'C G Am F Dm Em',      key:'C',  bpm:92,  difficulty:1, genre:'Рок' },
  { id:'r014', title:'Вечная молодость',     artist:'Земфира',           chords:'Em C G D Am',         key:'Em', bpm:140, difficulty:2, genre:'Рок' },
  { id:'r015', title:'Прогулки по воде',     artist:'Наутилус',          chords:'Dm Am Bb F C',        key:'Dm', bpm:74,  difficulty:2, genre:'Рок' },
  { id:'r016', title:'Небо становится ближе', artist:'Ария',             chords:'Am Dm E Am G C',      key:'Am', bpm:110, difficulty:2, genre:'Метал' },
  { id:'r017', title:'Беспечный ангел',      artist:'Ария',              chords:'Am G F E Am C Dm',    key:'Am', bpm:118, difficulty:2, genre:'Метал' },
  { id:'r018', title:'Я свободен',           artist:'Кипелов',           chords:'Am G F E Am Dm',      key:'Am', bpm:124, difficulty:2, genre:'Метал' },
  { id:'r019', title:'Осколок льда',         artist:'Ария',              chords:'Dm Am C G Bb',        key:'Dm', bpm:88,  difficulty:2, genre:'Метал' },
  { id:'r020', title:'Вечера на рейде',      artist:'Народная',          chords:'Am E Am Dm G C',      key:'Am', bpm:72,  difficulty:1, genre:'Народная' },
  { id:'r021', title:'Любовь как сон',       artist:'Алиса',             chords:'Em C D G Am Bm',      key:'Em', bpm:126, difficulty:2, genre:'Рок' },
  { id:'r022', title:'Красное на чёрном',    artist:'Алиса',             chords:'Am G C D Em',         key:'Am', bpm:130, difficulty:1, genre:'Рок' },
  { id:'r023', title:'Рыба',                 artist:'Звери',             chords:'Am F C G',            key:'Am', bpm:132, difficulty:1, genre:'Поп-рок' },
  { id:'r024', title:'Районы кварталы',       artist:'Звери',            chords:'Am F C G Em Dm',      key:'Am', bpm:120, difficulty:1, genre:'Поп-рок' },
  { id:'r025', title:'Снег',                 artist:'Мумий Тролль',      chords:'Am Em F C G Dm',      key:'Am', bpm:105, difficulty:2, genre:'Рок' },
  { id:'r026', title:'Невеста',              artist:'Мумий Тролль',      chords:'G D Am Em C F',       key:'G',  bpm:118, difficulty:2, genre:'Рок' },
  { id:'r027', title:'Сумасшедший ты',       artist:'Ленинград',         chords:'Am G F E',            key:'Am', bpm:125, difficulty:1, genre:'Рок' },
  { id:'r028', title:'Дорогой длинною',      artist:'Народная',          chords:'C G Am E F Dm G',     key:'C',  bpm:68,  difficulty:2, genre:'Романс' },
  { id:'r029', title:'Катюша',               artist:'Народная',          chords:'C F G Am Dm G',       key:'C',  bpm:108, difficulty:1, genre:'Народная' },
  { id:'r030', title:'Очи чёрные',           artist:'Народная',          chords:'Am E7 Am Dm E',       key:'Am', bpm:132, difficulty:1, genre:'Романс' },

  /* ── POP MODERN ─────────────────────────────────────────── */
  { id:'p001', title:'Someone Like You',     artist:'Adele',             chords:'A E F#m D',           key:'A',  bpm:68,  difficulty:1, genre:'Pop' },
  { id:'p002', title:'Rolling in the Deep',  artist:'Adele',             chords:'Am G C',              key:'Am', bpm:105, difficulty:1, genre:'Pop Soul' },
  { id:'p003', title:'Counting Stars',       artist:'OneRepublic',       chords:'Am C G F',            key:'Am', bpm:122, difficulty:1, genre:'Pop Rock' },
  { id:'p004', title:'Stay With Me',         artist:'Sam Smith',         chords:'Am F C G',            key:'C',  bpm:85,  difficulty:1, genre:'Pop Soul' },
  { id:'p005', title:'Shallow',              artist:'Lady Gaga & B. Cooper', chords:'Am G D F C Em',  key:'Am', bpm:96,  difficulty:2, genre:'Pop' },
  { id:'p006', title:'Believer',             artist:'Imagine Dragons',   chords:'Dm Bb F C Am G',      key:'Dm', bpm:125, difficulty:2, genre:'Pop Rock' },
  { id:'p007', title:'Demons',               artist:'Imagine Dragons',   chords:'C G Am F',            key:'C',  bpm:90,  difficulty:1, genre:'Pop Rock' },
  { id:'p008', title:'Let Me Love You',      artist:'DJ Snake',          chords:'Dm Gm Bb F C',        key:'Dm', bpm:104, difficulty:2, genre:'Pop' },
  { id:'p009', title:'Ocean Eyes',           artist:'Billie Eilish',     chords:'Bm G D A',            key:'D',  bpm:100, difficulty:1, genre:'Pop' },
  { id:'p010', title:'Bad Guy',              artist:'Billie Eilish',     chords:'Gm Cm Dm',            key:'Gm', bpm:135, difficulty:1, genre:'Pop' },
];

/* ── Helpers ── */
export function searchSongs(query: string): SongEntry[] {
  if (!query.trim()) return SONGS;
  const q = query.toLowerCase();
  return SONGS.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    s.genre.toLowerCase().includes(q) ||
    s.chords.toLowerCase().includes(q)
  );
}

export const GENRES = Array.from(new Set(SONGS.map(s => s.genre))).sort();
