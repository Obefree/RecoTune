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
  /** Optional annotated lyrics. Format: [Chord]word or plain text. Each line is a new line. */
  lyrics?: string;
}

export const SONGS: SongEntry[] = [

  /* ── EASY ──────────────────────────────────────────────── */
  { id:'s001', title:'Let It Be', artist:'The Beatles', chords:'C G Am F', key:'C', bpm:76, difficulty:1, genre:'Classic Rock',
    lyrics:`[C]When I find myself in [G]times of trouble
[Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom
Let it [F]be [C]

[C]And in my hour of [G]darkness
[Am]She is standing [F]right in front of me
[C]Speaking words of [G]wisdom
Let it [F]be [C]

[Am]Let it be [G] let it be [F]
[C]Let it be [G] let it be
[F]Whisper words of [C]wisdom
Let it [G]be [F] [C]`,
  },
  { id:'s002', title:"Knockin' on Heaven's Door", artist:'Bob Dylan', chords:'G D Am', key:'G', bpm:72, difficulty:1, genre:'Folk Rock',
    lyrics:`[G]Mama take this [D]badge off of me
I can't [Am]use it anymore
[G]It's gettin' [D]dark too dark to see
I feel I'm [Am]knockin' on heaven's door

[G]Knock knock [D]knockin' on [Am]heaven's door
[G]Knock knock [D]knockin' on [Am]heaven's door
[G]Knock knock [D]knockin' on [Am]heaven's door
[G]Knock knock [D]knockin' on [Am]heaven's door`,
  },
  { id:'s003', title:'No Woman No Cry', artist:'Bob Marley', chords:'C G Am F', key:'C', bpm:80, difficulty:1, genre:'Reggae',
    lyrics:`[C]No woman [G]no cry
[Am]No woman [F]no cry
[C]No woman [G]no cry
[Am]No woman [F]no cry

[C]Said I remember [G]when we used to sit
[Am]In the government yard [F]in Trenchtown
[C]Oba observing the [G]hypocrites
[Am]As they would mingle [F]with the good people we meet

[C]Good friends we have [G]oh good friends we've lost
[Am]Along the [F]way
[C]In this great [G]future you can't forget your [Am]past
[F]So dry your tears [C]I say`,
  },
  { id:'s004', title:'Stand By Me', artist:'Ben E. King', chords:'A F#m D E', key:'A', bpm:122, difficulty:1, genre:'Soul',
    lyrics:`[A]When the night has come
And the land is [F#m]dark
And the moon is the [D]only light we'll [E]see
No I won't be [A]afraid
No I won't be afraid
Just as [F#m]long as you stand, stand by [D]me [E]

[A]So darling darling [F#m]stand by me
Oh [D]stand by [E]me
Oh [A]stand, stand by me
Stand by [F#m]me [D] [E]`,
  },
  { id:'s005', title:'Brown Eyed Girl', artist:'Van Morrison', chords:'G C D Em', key:'G', bpm:150, difficulty:1, genre:'Rock',
    lyrics:`[G]Hey where did we go
[C]Days when the rains came
[D]Down in the hollow
[Em]Playing a new game
[G]Laughing and a running hey hey
[C]Skipping and a jumping
[D]In the misty morning fog with our
Our [Em]hearts a thumpin'

And you, [C]my brown eyed [G]girl
[D]You, my brown eyed [G]girl
[D]Do you remember when
We used to sing: [G]sha la la la [C]la la la la
La la la la te [D]da [G]`,
  },
  { id:'s006', title:'Sweet Home Alabama', artist:'Lynyrd Skynyrd', chords:'D C G', key:'D', bpm:98, difficulty:1, genre:'Southern Rock',
    lyrics:`[D]Big wheels keep on turning
[C]Carry me home to see my [G]kin
[D]Singing songs about the Southland
[C]I miss Alabamy once again and I [G]think it's a sin

Well I heard Mr. [D]Young sing about her
Well I heard ole [C]Neil put her [G]down
Well I hope Neil [D]Young will remember
A [C]Southern man don't need him [G]around anyhow

[D]Sweet home Alabama
[C]Where the skies are so [G]blue
[D]Sweet home Alabama
[C]Lord I'm coming home to [G]you`,
  },
  { id:'s007', title:"Blowin' in the Wind", artist:'Bob Dylan', chords:'G C D', key:'G', bpm:90, difficulty:1, genre:'Folk',
    lyrics:`[G]How many roads must a [C]man walk [G]down
Before you [D]call him a [G]man?
How many [C]seas must a [G]white dove [C]sail
Before she [G]sleeps in the [D]sand?

Yes how many [G]times must the [C]cannon balls [G]fly
Before they're [D]forever [G]banned?
The [G]answer my [C]friend is [G]blowin' in the [D]wind
The [G]answer is [C]blowin' in the [D]wind [G]`,
  },
  { id:'s008', title:'Perfect', artist:'Ed Sheeran', chords:'G Em C D', key:'G', bpm:95, difficulty:1, genre:'Pop',
    lyrics:`[G]I found a love [Em]for me
[C]Darling just dive right in
And follow my [D]lead
[G]Well I found a girl [Em]beautiful and sweet
[C]Oh I never knew you were the someone
Waiting for [D]me

'Cause we were just [G]kids when we fell in love
Not knowing [Em]what it was
I will not [C]give you up this time
But darling just [D]kiss me slow
Your heart is all [G]I own
And in your [Em]eyes you're holding mine

[C]Baby I'm [D]dancing in the [G]dark
With [Em]you between my [C]arms
Barefoot on the [D]grass
[G]Listening to our [Em]favourite song
I have [C]faith in what I see
Now I know I have met an [D]angel in person`,
  },
  { id:'s009', title:'With or Without You', artist:'U2', chords:'D A Bm G', key:'D', bpm:110, difficulty:1, genre:'Rock',
    lyrics:`[D]See the stone set in your eyes
[A]See the thorn twist in your side
[Bm]I'll wait for [G]you

[D]Sleight of hand and twist of fate
[A]On a bed of nails she makes me wait
[Bm]And I wait [G]without you

[D]With or without you
[A]With or without you
[Bm]Through the storm we reach the [G]shore
[D]You give it all but I want [A]more
And I'm [Bm]waiting for you [G]

[D]With or without you [A]
[Bm]With or without [G]you
[D]I can't live
[A]With or without you [Bm] [G]`,
  },
  { id:'s010', title:'Zombie', artist:'The Cranberries', chords:'Am F C G', key:'Am', bpm:102, difficulty:1, genre:'Alternative',
    lyrics:`[Am]Another head hangs lowly
[F]Child is slowly taken
[C]And the violence caused such silence
[G]Who are we mistaken?

[Am]But you see it's not me
[F]It's not my family
[C]In your head, in your head
[G]They are fighting

[Am]In your head [F]in your head
[C]Zombie [G]zombie
[Am]In your head [F]in your head
[C]Zombie zombie zombie-ie-ie [G]

[Am]What's in your head in your head
[F]Zombie zombie zombie-ie
[C]In your head [G]in your head
[Am]Zombie zombie zombie-ie-ie [F] [C] [G]`,
  },
  { id:'s011', title:'Let Her Go', artist:'Passenger', chords:'G D Em C', key:'G', bpm:104, difficulty:1, genre:'Pop Folk',
    lyrics:`Well you [G]only need the light when it's [D]burning low
Only miss the [Em]sun when it starts to [C]snow
Only know you [G]love her when you [D]let her go

Only know you've [Em]been high when you're feeling [C]low
Only hate the [G]road when you're missing [D]home
Only know you [Em]love her when you [C]let her go

And you let her [G]go [D] [Em] [C]
[G]Staring at the [D]bottom of your glass
[Em]Hoping one day you'll make a [C]dream last
But dreams come [G]slow and they go so [D]fast
[Em]You see her when you close your [C]eyes
[G]Maybe one day you'll understand [D]why
[Em]Everything you touch surely [C]dies`,
  },
  { id:'s012', title:'Time of Your Life', artist:'Green Day', chords:'G Cadd9 Dsus4 Em7', key:'G', bpm:88, difficulty:1, genre:'Punk Rock',
    lyrics:`[G]Another turning point
A fork stuck in the [Cadd9]road
[Dsus4]Time grabs you by the wrist
Directs you where to [G]go

[G]So make the best of this test
And don't ask [Cadd9]why
[Dsus4]It's not a question
But a lesson learned in [G]time

[Em7]It's something unpredictable
But in the [Dsus4]end is right
I hope you [G]had the time of your life

[G]So take the photographs
And still frames in your [Cadd9]mind
[Dsus4]Hang it on a shelf in good health
And good [G]time`,
  },
  { id:'s013', title:'Boulevard of Broken Dreams', artist:'Green Day', chords:'Em G D A', key:'Em', bpm:168, difficulty:1, genre:'Punk Rock',
    lyrics:`[Em]I walk a lonely road
The only [G]one that I have ever [D]known
Don't know where it goes [A]
But it's [Em]home to me and I walk alone

[Em]I walk this empty street
On the [G]boulevard of broken [D]dreams
Where the city [A]sleeps
And I'm the [Em]only one and I walk alone

[Em]My shadow's the only one that [G]walks beside me
[D]My shallow heart's the only [A]thing that's beating
Sometimes I wish someone out there will [Em]find me
[G]Till then I walk [D]alone [A]`,
  },
  { id:'s014', title:'Come As You Are', artist:'Nirvana', chords:'Em G D Am', key:'Em', bpm:120, difficulty:1, genre:'Grunge',
    lyrics:`[Em]Come as you are
As you [G]were
As I want [D]you to be
As a [Am]friend as a friend
As an [Em]old enemy

Take your [Em]time
Hurry [G]up
The choice is [D]yours
Don't be [Am]late
Take a [Em]rest as a friend
As a [G]known memory

[Em]Come doused in mud
Soaked in [G]bleach
As I want [D]you to be
As a [Am]trend as a friend
As an [Em]old memory

And I [G]swear that I don't have a [D]gun
No I [Am]don't have a gun [Em]`,
  },
  { id:'s015', title:'Fix You', artist:'Coldplay', chords:'C Em Am F', key:'C', bpm:138, difficulty:1, genre:'Alternative',
    lyrics:`When you try your best but you don't [C]succeed
When you get what you [Em]want but not what you [Am]need
When you feel so tired but you can't [F]sleep
Stuck in [C]reverse [Em] [Am] [F]

When the tears come streaming down your [C]face
When you lose something you [Em]can't replace
When you love someone but it goes to [Am]waste
Could it be [F]worse?

[C]Lights will guide you [Em]home
[Am]And ignite your [F]bones
[C]And I will try to [Em]fix [Am]you [F]

[C]High up above or down [Em]below
[Am]When you're too in love to let it [F]go
But if you never try you'll never [C]know
[Em]Just what you're [Am]worth [F]`,
  },
  { id:'s016', title:'Imagine', artist:'John Lennon', chords:'C F G Am Dm', key:'C', bpm:75, difficulty:1, genre:'Pop Rock',
    lyrics:`[C]Imagine there's no [F]heaven
[C]It's easy if you [F]try
[C]No hell below [F]us
[C]Above us only [F]sky

[Am]Imagine all the [Dm]people
[F]Living for to[G]day

[C]Imagine there's no [F]countries
[C]It isn't hard to [F]do
[C]Nothing to kill or [F]die for
[C]And no religion [F]too

[Am]Imagine all the [Dm]people
[F]Living life in [G]peace

You may say [C]I'm a [F]dreamer
But [C]I'm not the only [G]one
I hope [C]someday you'll [F]join us
[C]And the world [G]will be as [C]one [F] [C] [F]`,
  },
  { id:'s017', title:'Wonderful Tonight', artist:'Eric Clapton', chords:'G D C Em', key:'G', bpm:95, difficulty:1, genre:'Soft Rock',
    lyrics:`[G]It's late in the [D]evening
She's wondering what [C]clothes to wear
She puts on her [G]make-up
And brushes her [D]long blonde hair
And then she asks [C]me
Do I look all [D]right?
And I say [G]yes [D] you look [C]wonderful tonight [G] [D]

[G]We go to a [D]party
And everyone turns [C]to see
This beautiful [G]lady
That's walking around with [D]me
And then she asks [C]me
Do you feel all [D]right?
And I say [G]yes [D] I feel [C]wonderful tonight [G] [D]`,
  },
  { id:'s018', title:'Shape of You', artist:'Ed Sheeran', chords:'Am Dm F G', key:'Am', bpm:96, difficulty:1, genre:'Pop',
    lyrics:`[Am]The club isn't the best place
[Dm]To find a lover
[F]So the bar is where I go [G]

[Am]Me and my friends at the table
[Dm]Doing shots
[F]Drinking fast and then we talk slow [G]

[Am]Come over and start up a conversation
[Dm]With just me
[F]And trust me I'll give it a chance now [G]

[Am]Take my hand stop put Van the Man on the jukebox
[Dm]And then we start to dance
[F]And now I'm singing like [G]

[Am]Girl you know I want your love [Dm]
Your love was handmade for somebody like me [F]
Come on now follow my lead [G]
[Am]I may be crazy don't mind me [Dm]
Say boy let's not talk too much [F]
Grab on my waist and put that body on me [G]`,
  },
  { id:'s019', title:'Losing My Religion', artist:'R.E.M.', chords:'Am Em Dm G C F', key:'Am', bpm:128, difficulty:2, genre:'Alternative',
    lyrics:`[Am]Oh life [Em]is bigger
[Dm]It's bigger than you
And you are [Am]not me
The [Am]lengths that I will go to [Em]
The [Dm]distance in your eyes
Oh no I've [G]said too much
I [Am]set it up

[Am]That's me in the [Em]corner
[Dm]That's me in the spotlight
[Am]Losing my religion
[Am]Trying to keep up with [Em]you
[Dm]And I don't know if I can do it
Oh no I've [G]said too much
I [Am]haven't said enough

I [C]thought that I heard you laughing
I [C]thought that I heard you [Dm]sing
I [Am]think I thought I [Em]saw you try

[Am]Every whisper [Em]of every waking hour
[Dm]I'm choosing my confessions [Am]
Trying to keep an eye [Em]on you [Dm]
Like a hurt lost and blinded [G]fool [Am]`,
  },
  { id:'s020', title:'Wish You Were Here', artist:'Pink Floyd', chords:'C D Am G Em', key:'G', bpm:60, difficulty:1, genre:'Progressive Rock',
    lyrics:`[C]So so you think you can tell
[D]Heaven from hell
[Am]Blue skies from pain
Can you tell a [G]green field
[C]From a cold steel rail?
[D]A smile from a veil?
Do you think you can [Am]tell?

[C]Did they get you to trade
Your [D]heroes for ghosts?
[Am]Hot ashes for trees?
[G]Hot air for a cool breeze?
[C]Cold comfort for change?
Did you exchange
A [D]walk on part in the war
For a [Am]lead role in a cage?

[G]How I wish how I [Em]wish you were here
We're just [G]two lost souls swimming in a fish bowl
[D]Year after year
Running over the [C]same old ground
And how we [Am]found the same old fears
Wish you were [G]here [Em] [G]`,
  },

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
  { id:'r001', title:'Группа крови', artist:'Кино', chords:'Em C G D', key:'Em', bpm:118, difficulty:1, genre:'Рок',
    lyrics:`[Em]Тёплое место, но [C]улицы ждут
[G]Отпечатков наших [D]ног
[Em]Звёздная пыль на [C]подошвах моих
[G]Мягкое сердце [D]для мечт

[Em]Группа крови [C]на рукаве
[G]Мой порядковый [D]номер на рукаве
[Em]Пожелай мне удачи [C]в бою
[G]Пожелай мне [D]не остаться в этой траве`,
  },
  { id:'r002', title:'Звезда по имени Солнце', artist:'Кино', chords:'Am E Am G', key:'Am', bpm:110, difficulty:1, genre:'Рок',
    lyrics:`[Am]Белый снег серый лёд [E]
На растрескавшейся [Am]земле
[G]Одеялом лоскутным [Am]на ней
Город в дорожной [E]петле [Am]

[Am]А над городом плывут [E]облака
Закрывая [Am]небесный свет
[G]А над городом жёлтый [Am]дым
Городу две [E]тысячи лет [Am]

[Am]Прожитых под этим [E]солнцем
Солнце — [Am]звезда по имени Солнце [G] [Am]`,
  },
  { id:'r003', title:'Перемен', artist:'Кино', chords:'Am G C F Em', key:'Am', bpm:108, difficulty:1, genre:'Рок',
    lyrics:`[Am]Перемен! [G]требуют наши [C]сердца
[Am]Перемен! [G]требуют наши [F]глаза
[Em]В нашем смехе и в наших [Am]слезах
И в пульсации [G]вен [C]
Перемен! [G]мы ждём [Am]перемен!

[Am]Электрический свет [G]продолжает наш [C]день
[Am]И коробка от [G]спичек пуста [F]
[Em]Но на кухне синим [Am]цветком
Горит [G]газ [C]
Перемен! [G]мы ждём [Am]перемен!`,
  },
  { id:'r004', title:'Последний герой', artist:'Кино', chords:'Em D C G Am', key:'Em', bpm:95, difficulty:1, genre:'Рок',
    lyrics:`[Em]Доброе утро последний [D]герой
Доброе утро тебе и [C]таким как [G]ты
[Em]Доброе утро последний [D]герой
Здравствуй последний [Am]герой

[Em]Я оглянулся [D]посмотреть
Не оглянулась ли [C]она [G]
[Em]Чтоб посмотреть [D]не оглянулся ли я
[Am]Чтоб посмотреть`,
  },
  { id:'r005', title:'Ты или я', artist:'Кино', chords:'Am E Dm G', key:'Am', bpm:112, difficulty:1, genre:'Рок',
    lyrics:`[Am]Нам с тобою [E]не везёт
[Dm]В смысле погоды [G]
[Am]И ты всё ждёшь [E]и я всё жду
[Dm]Когда выглянет [G]солнце

[Am]Ты или [E]я — кто займёт [Dm]первым [G]место у окна
[Am]Ты или [E]я — ты или я [Dm]дотронешься до [G]стекла`,
  },
  { id:'r006', title:'Что такое осень', artist:'ДДТ', chords:'Am E Dm G C', key:'Am', bpm:78, difficulty:1, genre:'Рок',
    lyrics:`[Am]Что такое [E]осень — это небо
Плачущее [Dm]небо под ногами
В лужах [G]разбиваются, как зеркала
Осколки [Am]неба — что такое [E]осень

[Am]Осень — я давно [Dm]с тобою рядом [G]
Ты у меня [C]на сердце на уме [Am]
Что такое [E]осень — это камень
Бросить в [Dm]небо позабывши руки [G]
[Am]Что такое [E]осень`,
  },
  { id:'r007', title:'Не стреляй', artist:'ДДТ', chords:'Am G Dm E', key:'Am', bpm:90, difficulty:1, genre:'Рок' },
  { id:'r008', title:'Гудбай Америка', artist:'Nautilus Pompilius', chords:'Am G C D Em', key:'Am', bpm:115, difficulty:1, genre:'Рок',
    lyrics:`[Am]Гудбай [G]Америка о [C]где я [D]не был [Am]никогда
[Am]Прощай [G]навсегда [C]возьми [D]банджо и [Am]сыграй нам на прощание
[Em]Сейчас мои штаны [G]протёрты на коленях [Am]и заплаты
[Em]На сердце на [G]заднице [Am]

[Am]Я [G]так давно [C]хотел [D]увидеть [Am]твои горы и зелёные [G]поля
[Am]Но [G]с детских [C]лет [D]я помню [Am]только твои джинсы да жвачку [G]
[Am]Гудбай [G]Америка [C]о [D]куда я [Am]никогда не попаду [G] [Am]`,
  },
  { id:'r009', title:'Крылья', artist:'Nautilus Pompilius', chords:'Am G C E', key:'Am', bpm:104, difficulty:1, genre:'Рок',
    lyrics:`[Am]Где-то есть люди у которых [G]есть всё
Где-то есть люди у которых [C]нет ничего
[E]И я хочу знать [Am]зачем вы живёте
Зачем [G]рожаете детей [C]чтобы вновь они страдали

[Am]Скованные одной [G]цепью
Связанные одной [C]целью
[Am]Скованные одной [G]цепью
Связанные одной [C]целью [E]`,
  },
  { id:'r010', title:'Я хочу быть с тобой', artist:'Nautilus Pompilius', chords:'C G Am Em F', key:'C', bpm:96, difficulty:1, genre:'Рок',
    lyrics:`[C]Я хочу быть с [G]тобой
[Am]Я так хочу быть с [Em]тобой
[F]И быть может [G]поэтому
Я [C]до сих пор живу [G] [Am] [Em] [F]

[C]Дотянуться до [G]твоих
[Am]Сладких ягод [Em]лесных
[F]Узнать твой [G]вкус
[C]Узнать твой цвет [G] [Am] [Em] [F]`,
  },
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
