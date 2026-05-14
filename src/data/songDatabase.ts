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
  { id:'s021', title:'Wonderwall', artist:'Oasis', chords:'Em7 G Dsus4 A7sus4 C', key:'G', bpm:87, difficulty:2, genre:'Britpop',
    lyrics:`[Em7]Today is gonna be the day
That they're gonna throw it [G]back to you
[Dsus4]By now you should have somehow
Realised what you [A7sus4]gotta do
[Em7]I don't believe that anybody
Feels the way I do about you [G]now [Dsus4] [A7sus4]

[Em7]Backbeat the word was on the street
That the fire in your [G]heart is out
[Dsus4]I'm sure you've heard it all before
But you never really had a [A7sus4]doubt
[Em7]I don't believe that anybody
Feels the way I do about you [G]now [Dsus4] [A7sus4]

[C]And all the roads we have to walk are [G]winding
[C]And all the lights that lead us there are [G]blinding
[C]There are many things that I would [G]like to say to you
But I don't know [A7sus4]how

[Em7]Because maybe [G]
[Dsus4]You're gonna be the one that [A7sus4]saves me [Em7]
And after [G]all [Dsus4]
You're my [A7sus4]wonderwall`,
  },
  { id:'s022', title:"Don't Look Back in Anger", artist:'Oasis', chords:'C G Am E F Fm', key:'C', bpm:124, difficulty:2, genre:'Britpop',
    lyrics:`[C]Slip inside the eye of your mind
Don't you know you might find
A better [G]place to play
[Am]You said that you'd never been
But all the things that you've seen
Will slowly [G]fade away

[C]So I'll start a revolution from my [G]bed
'Cause you said the brains I had went to my [Am]head [E]
Step outside [F]summertime's in bloom
Stand up beside the [Fm]fireplace
Take that look from off your face [C]
You ain't [G]ever gonna burn my [Am]heart [E]out

[C]Don't look back in [G]anger
[Am]I heard you say [E]
At least not to[F]day [Fm] [C] [G] [Am]`,
  },
  { id:'s023', title:'Hotel California', artist:'Eagles', chords:'Am E7 G D F C Dm E', key:'Am', bpm:147, difficulty:3, genre:'Rock',
    lyrics:`On a [Am]dark desert highway
[E7]Cool wind in my hair
[G]Warm smell of colitas
[D]Rising up through the air
[F]Up ahead in the distance
[C]I saw a shimmering light
[Dm]My head grew heavy and my sight grew dim
[E]I had to stop for the night

[Am]There she stood in the doorway
[E7]I heard the mission bell
[G]And I was thinking to myself
[D]This could be heaven or this could be hell
[F]Then she lit up a candle
[C]And she showed me the way
[Dm]There were voices down the corridor
[E]I thought I heard them say

Welcome to the [Am]Hotel California [E7]
Such a lovely [G]place such a lovely [D]face
Plenty of room at the [F]Hotel California [C]
Any time of [Dm]year you can find it [E]here`,
  },
  { id:'s024', title:'Hallelujah', artist:'Leonard Cohen', chords:'C Am F G E', key:'C', bpm:66, difficulty:2, genre:'Folk',
    lyrics:`[C]I've heard there was a secret [Am]chord
That [C]David played and it pleased the [Am]Lord
But [F]you don't really care for music [G]do ya [C] [G]
It [C]goes like this the [F]fourth the fifth [Am]
The [F]minor fall and the major [G]lift
The [Am]baffled king composing [G]Hallelujah

[F]Hallelujah [Am]hallelujah
[F]Hallelujah halle[G]lujah [C] [G] [C] [G]

[C]Your faith was strong but you [Am]needed proof
[C]You saw her bathing on the [Am]roof
Her [F]beauty and the moonlight [G]overthrew you [C] [G]
She [C]tied you to a kitchen [F]chair [Am]
She [F]broke your throne and she cut your [G]hair
And from [Am]your lips she drew the [G]Hallelujah

[F]Hallelujah [Am]hallelujah
[F]Hallelujah halle[G]lujah [C] [G] [C] [G]`,
  },
  { id:'s025', title:'House of the Rising Sun', artist:'The Animals', chords:'Am C D F E', key:'Am', bpm:116, difficulty:2, genre:'Blues Rock',
    lyrics:`[Am]There is a [C]house in [D]New Or[F]leans
They [Am]call the [C]Rising [E]Sun
[Am]And it's [C]been the [D]ruin of [F]many a poor boy
[Am]And God [E]I know I'm one

[Am]My mother [C]was a [D]tailor [F]
She [Am]sewed my [C]new blue [E]jeans
[Am]My father [C]was a [D]gambling [F]man
[Am]Down in [E]New Orleans

[Am]Now the [C]only thing [D]a gambler [F]needs
Is a [Am]suitcase [C]and a [E]trunk
[Am]And the [C]only time [D]he'll be satis[F]fied
Is [Am]when he's [E]on a drunk`,
  },
  { id:'s026', title:'Creep', artist:'Radiohead', chords:'G B C Cm', key:'G', bpm:92, difficulty:2, genre:'Alternative',
    lyrics:`[G]When you were here before
[B]Couldn't look you in the eye
[C]You're just like an angel
[Cm]Your skin makes me cry

[G]You float like a feather
[B]In a beautiful world
[C]I wish I was special
[Cm]You're so fucking special

But [G]I'm a creep
[B]I'm a weirdo
[C]What the hell am I doing here?
[Cm]I don't belong here

[G]I don't care if it hurts
[B]I wanna have control
[C]I want a perfect body
[Cm]I want a perfect soul

[G]I want you to notice
[B]When I'm not around
[C]You're so fucking special
[Cm]I wish I was special

But [G]I'm a creep
[B]I'm a weirdo
[C]What the hell am I doing here?
[Cm]I don't belong here`,
  },
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
  { id:'s038', title:'Use Somebody', artist:'Kings of Leon', chords:'C G Am F', key:'C', bpm:136, difficulty:1, genre:'Indie Rock',
    lyrics:`[C]I've been roaming around always looking down
At all I see [G]
[Am]Painted faces fill the places I can't reach [F]
[C]You know that I could use somebody [G]
[Am]You know that I could use somebody [F]
[C]Someone like you [G] [Am] [F]

[C]I've been running around always tired and down
Looking for you [G]
[Am]Pushed around by time while I'm left behind [F]
[C]You know that I could use somebody [G]
[Am]You know that I could use somebody [F]
[C]Someone like you [G] [Am] [F]

[C]Off in the night while you live it up I'm off to sleep [G]
[Am]Waging wars to shake the poet and the beat [F]
I hope it's gonna make you notice [C] someone like [G]me [Am] [F]`,
  },
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
  { id:'p011', title:'Perfect',             artist:'Ed Sheeran',        chords:'G Em C D',            key:'G',  bpm:96,  difficulty:1, genre:'Pop',
    lyrics:`[G]I found a [Em]love for [C]me
[D]Darling just [G]dive right in
[Em]And follow my [C]lead
[D]Well I found a [G]girl beautiful and [Em]sweet
[C]Oh I never knew you were the [D]someone waiting for me

[G]'Cause we were just [Em]kids when we [C]fell in love
[D]Not knowing what it [G]was
[Em]I will not give you [C]up this time
[D]But darling just [G]kiss me slow
[Em]Your heart is all I [C]own
And in your [D]eyes you're holding mine`,
  },
  { id:'p012', title:'Shape of You',        artist:'Ed Sheeran',        chords:'C#m F#m A B',         key:'C#m',bpm:96,  difficulty:2, genre:'Pop' },
  { id:'p013', title:'Blinding Lights',     artist:'The Weeknd',        chords:'Am F C G',            key:'Am', bpm:171, difficulty:1, genre:'Pop' },
  { id:'p014', title:'Levitating',          artist:'Dua Lipa',          chords:'Bm G D A',            key:'D',  bpm:103, difficulty:1, genre:'Pop' },
  { id:'p015', title:'Dance Monkey',        artist:'Tones and I',       chords:'Am C G F Dm',         key:'Am', bpm:98,  difficulty:2, genre:'Pop' },
  { id:'p016', title:'Señorita',            artist:'Shawn Mendes',      chords:'Am F C G Em',         key:'Am', bpm:117, difficulty:2, genre:'Pop' },
  { id:'p017', title:'Watermelon Sugar',    artist:'Harry Styles',      chords:'Am C G F',            key:'C',  bpm:95,  difficulty:1, genre:'Pop' },
  { id:'p018', title:'As It Was',           artist:'Harry Styles',      chords:'F#m A D E',           key:'A',  bpm:174, difficulty:1, genre:'Pop' },
  { id:'p019', title:'Flowers',             artist:'Miley Cyrus',       chords:'F Bb C Dm Gm',        key:'F',  bpm:119, difficulty:2, genre:'Pop' },
  { id:'p020', title:'Anti-Hero',           artist:'Taylor Swift',      chords:'C G Am F Em',         key:'C',  bpm:97,  difficulty:2, genre:'Pop' },
  { id:'p021', title:'Love Story',          artist:'Taylor Swift',      chords:'D A Bm G',            key:'D',  bpm:119, difficulty:1, genre:'Pop Country' },
  { id:'p022', title:'Thinking Out Loud',   artist:'Ed Sheeran',        chords:'D A Bm G',            key:'D',  bpm:79,  difficulty:1, genre:'Pop' },
  { id:'p023', title:'Stay',                artist:'The Kid LAROI',     chords:'F C Am G',            key:'Am', bpm:170, difficulty:1, genre:'Pop' },

  /* ── CLASSIC ROCK ───────────────────────────────────────────── */
  { id:'c001', title:'Sweet Home Alabama',  artist:'Lynyrd Skynyrd',    chords:'D C G',               key:'D',  bpm:97,  difficulty:1, genre:'Classic Rock',
    lyrics:`[D]Big wheels keep on [C]turning
[G]Carry me home to see my [D]kin
[D]Singing songs about the [C]Southland
[G]I miss Alabamy once a[D]gain and I think it's a sin

[D]Sweet home [C]Alabama
[G]Where the skies are so [D]blue
[D]Sweet home [C]Alabama
[G]Lord I'm coming [D]home to you`,
  },
  { id:'c002', title:'Smoke on the Water',  artist:'Deep Purple',       chords:'Gm F Bb Gm Cm',       key:'Gm', bpm:112, difficulty:2, genre:'Classic Rock',
    lyrics:`[Gm]We all came out to [F]Montreux
On the [Bb]Lake Geneva [Gm]shoreline
[Gm]To make records with a [F]mobile
We [Bb]didn't have much [Gm]time
[F]Frank Zappa and the [Gm]Mothers
Were at the best place [F]around
But some [Gm]stupid with a [F]flare gun
[Bb]Burned the place to the [Gm]ground

[Gm]Smoke on the [F]water
A [Bb]fire in the [Gm]sky
[Gm]Smoke on the [F]water`,
  },
  { id:'c003', title:'Back in Black',       artist:'AC/DC',             chords:'A D E',               key:'A',  bpm:96,  difficulty:1, genre:'Classic Rock' },
  { id:'c004', title:'Paranoid',            artist:'Black Sabbath',     chords:'Em G D Em C D Em',    key:'Em', bpm:164, difficulty:1, genre:'Heavy Metal' },
  { id:'c005', title:'Stairway to Heaven',  artist:'Led Zeppelin',      chords:'Am Am/G F#m7 Fmaj7 Am C D',key:'Am',bpm:82,difficulty:3, genre:'Classic Rock' },
  { id:'c006', title:'Bohemian Rhapsody',   artist:'Queen',             chords:'Bb Gm Cm F Eb Ab Db', key:'Bb', bpm:76,  difficulty:3, genre:'Classic Rock' },
  { id:'c007', title:'Under the Bridge',    artist:'RHCP',              chords:'E B C#m G#m A',       key:'E',  bpm:82,  difficulty:2, genre:'Alt Rock' },
  { id:'c008', title:'Wish You Were Here',  artist:'Pink Floyd',        chords:'Em G Am C D',         key:'G',  bpm:62,  difficulty:2, genre:'Classic Rock',
    lyrics:`[Em]So so you [G]think you can [Em]tell
[G]Heaven from [Am]hell
[Am]Blue skies from [C]pain
[C]Can you tell a [G]green field
From a [Am]cold steel rail
A [Am]smile from a [C]veil
Do you [G]think you can tell

[Em]And did they get you to [G]trade
[Em]Your heroes for ghosts
[G]Hot ashes for [Am]trees
[Am]Hot air for a [C]cool breeze
[C]Cold comfort for [G]change
And did you [Am]exchange
A [Am]walk on part in the [C]war
For a [G]lead role in a cage`,
  },
  { id:'c009', title:'Come As You Are',     artist:'Nirvana',           chords:'E F Bb F# E',         key:'E',  bpm:120, difficulty:2, genre:'Grunge' },
  { id:'c010', title:'Smells Like Teen Spirit',artist:'Nirvana',        chords:'F Bb Ab Db',          key:'F',  bpm:117, difficulty:2, genre:'Grunge' },
  { id:'c011', title:'Every Breath You Take',artist:'The Police',       chords:'A F#m D E',           key:'A',  bpm:113, difficulty:2, genre:'Pop Rock',
    lyrics:`[A]Every breath you [F#m]take
Every [D]move you make
Every [E]bond you [A]break
Every step you [F#m]take
I'll be watching [D]you [E]

[A]Every single [F#m]day
Every [D]word you say
Every [E]game you [A]play
Every night you [F#m]stay
I'll be watching [D]you [E]

[A]Oh can't you [F#m]see
You belong to [D]me
How my poor heart [E]aches
With every step you [A]take`,
  },
  { id:'c012', title:'With or Without You',  artist:'U2',               chords:'D A Bm G',            key:'D',  bpm:110, difficulty:1, genre:'Rock' },
  { id:'c013', title:'Time of Your Life',    artist:'Green Day',        chords:'G C Dsus4 G Em C D',  key:'G',  bpm:78,  difficulty:2, genre:'Pop Punk' },
  { id:'c014', title:'More Than Words',      artist:'Extreme',          chords:'G Gsus4 Cadd9 Am7 C D Dsus4 Em',key:'G',bpm:80,difficulty:3, genre:'Pop Rock' },
  { id:'c015', title:'Nothing Else Matters', artist:'Metallica',        chords:'Em Am C D G B7',      key:'Em', bpm:69,  difficulty:3, genre:'Heavy Metal' },
  { id:'c016', title:'The House of the Rising Sun',artist:'The Animals', chords:'Am C D F Am C E Am', key:'Am', bpm:70,  difficulty:2, genre:'Blues Rock',
    lyrics:`[Am]There is a [C]house in [D]New Orleans
They [F]call the Rising [Am]Sun
[Am]And it's been the [C]ruin of [D]many a poor boy
And [E]God I know I'm [Am]one

[Am]My mother [C]was a [D]tailor
She [F]sewed my new blue [Am]jeans
[Am]My father was a [C]gambling [D]man
Down in [E]New Or[Am]leans`,
  },
  { id:'c017', title:'Brown Eyed Girl',      artist:'Van Morrison',     chords:'G C G D',             key:'G',  bpm:148, difficulty:1, genre:'Pop Rock' },
  { id:'c018', title:'Take Me Home Country Roads',artist:'J. Denver',   chords:'G D Em C',            key:'G',  bpm:78,  difficulty:1, genre:'Country',
    lyrics:`[G]Almost heaven [D]West Virginia
[Em]Blue Ridge Mountains [C]Shenandoah River
[G]Life is old there [D]older than the trees
[Em]Younger than the mountains [C]blowing like a breeze

[G]Country roads [D]take me home
To the [Em]place I [C]belong
[G]West Virginia [D]mountain mama
[C]Take me home [G]country roads`,
  },
  { id:'c019', title:'Mr. Jones',            artist:'Counting Crows',   chords:'Am F Dm G C',         key:'Am', bpm:132, difficulty:2, genre:'Alt Rock' },
  { id:'c020', title:'Zombie',               artist:'The Cranberries',  chords:'Am F C G',            key:'Am', bpm:94,  difficulty:1, genre:'Alt Rock' },

  /* ── БАРДОВСКАЯ / АВТОРСКАЯ ПЕСНЯ ───────────────────────────── */
  { id:'b001', title:'Милая моя',            artist:'Юрий Визбор',      chords:'G Em Am D',           key:'G',  bpm:75,  difficulty:1, genre:'Бардовская',
    lyrics:`[G]Всем нашим [Em]встречам разлуки
[Am]Увы суждены [D]
[G]Тих и печален [Em]ручей
[Am]Отрогам Муксу [D]родни

[G]Где-то под [Em]снегом лежат
[Am]Рюкзак да [D]ледоруб
[G]Милая моя [Em]солнышко лесное
[Am]Где в каких краях [D]встретимся с тобою`,
  },
  { id:'b002', title:'Изгиб гитары жёлтой', artist:'Митяев',           chords:'D G A D Bm Em',       key:'D',  bpm:88,  difficulty:2, genre:'Бардовская',
    lyrics:`[D]Изгиб гитары [G]жёлтой
Ты [A]обнимаешь [D]нежно
[Bm]Струна осколком [Em]счастья
[A]Пронзит твой [D]слух

[D]И кто-то тихо [G]грустный
Вдруг [A]скажет на [D]гитаре
[Bm]О чём-то самом [Em]главном
На [A]том о чём [D]молчат`,
  },
  { id:'b003', title:'Надежды маленький оркестрик',artist:'Окуджава',   chords:'C F G Am Dm',         key:'C',  bpm:76,  difficulty:2, genre:'Бардовская' },
  { id:'b004', title:'Луч солнца золотого',  artist:'Визбор',           chords:'C G Am F Dm G',       key:'C',  bpm:82,  difficulty:1, genre:'Бардовская' },
  { id:'b005', title:'Перекаты',             artist:'Городницкий',      chords:'Am Dm E Am G C',      key:'Am', bpm:80,  difficulty:2, genre:'Бардовская' },
  { id:'b006', title:'На Тихорецкую',        artist:'Окуджава',         chords:'C G Am F G7 C',       key:'C',  bpm:110, difficulty:1, genre:'Бардовская',
    lyrics:`[C]На Тихорецкую состав отправится
[G]Вагончик тронется [Am]перрон останется
[F]Стакан наполнится [G7]прольётся через край
[C]Не жди не плачь не надо [G]не надо провожай

[C]А мне с тобой не страшно [G]путь неблизкий
[Am]Четыре тысячи [F]четыреста шагов
[C]Помашет вслед платочком [G]занавески
И [F]утром встанет [G7]солнышко и [C]всё`,
  },
  { id:'b007', title:'Бременские музыканты',  artist:'Гладков',          chords:'Am E G D F C',        key:'Am', bpm:120, difficulty:2, genre:'Детская' },
  { id:'b008', title:'Мы желаем счастья вам', artist:'Намин',            chords:'C Am F G',            key:'C',  bpm:100, difficulty:1, genre:'Поп' },
  { id:'b009', title:'Как здорово',           artist:'Митяев',           chords:'G C D Em Am',         key:'G',  bpm:92,  difficulty:2, genre:'Бардовская',
    lyrics:`[G]Как здорово что [C]все мы здесь
Сегодня [G]собрались [D]
[G]Как здорово что [C]все мы здесь
Сегодня [D]собрались
[Em]Как дышится [Am]легко и вольно
Я [C]так хочу чтоб было [D]так
Как [G]здорово что [C]все мы здесь
Сегодня [D]собрались [G]`,
  },
  { id:'b010', title:'Маленький принц',       artist:'Жуков',            chords:'Am Dm G C F E',       key:'Am', bpm:84,  difficulty:2, genre:'Бардовская' },

  /* ── РУССКИЙ РОК ДОПОЛНИТЕЛЬНО ──────────────────────────────── */
  { id:'rr01', title:'Мама',                  artist:'Кино',             chords:'Am G F E',            key:'Am', bpm:105, difficulty:1, genre:'Русский рок',
    lyrics:`[Am]Мама [G]мама [F]что я скажу
[E]Мама мама что я скажу
[Am]Мама мне плохо [G]мама
[F]Где же ты [E]мама

[Am]Небо над городом [G]ночью
[F]Стало совсем [E]чёрным
[Am]Кто-то нарисовал звёзды [G]мелом
[F]На тёмном [E]небе`,
  },
  { id:'rr02', title:'Перемен',               artist:'Кино',             chords:'Bm Em G D A',         key:'Bm', bpm:130, difficulty:2, genre:'Русский рок',
    lyrics:`[Bm]Перемен требуют [Em]наши сердца
[G]Перемен требуют [D]наши глаза
В [Bm]нашем смехе и в [Em]наших слезах
И в [G]пульсации вен [D]перемен

Мы [Bm]ждём перемен [Em]
Мы [G]ждём перемен [D] [A]
Мы [Bm]ждём перемен [Em]
Мы [G]ждём [D]перемен [A]`,
  },
  { id:'rr03', title:'Спокойная ночь',        artist:'Кино',             chords:'Am C G Dm E Am',      key:'Am', bpm:86,  difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Вот уже поздний вечер
[C]Дети уснули давно
[G]Я сижу и слушаю [Dm]ветер
[E]За синим окном [Am]

[Am]Спокойная ночь [C]
[G]Спокойная ночь [Dm]
[E]Устали игрушки [Am]дети спят
[C]Один лишь ночник [G]маленький
[Dm]В детской [E]горит [Am]`,
  },
  { id:'rr04', title:'Закрой за мной дверь',  artist:'Кино',             chords:'Am G F E Dm',         key:'Am', bpm:112, difficulty:2, genre:'Русский рок' },
  { id:'rr05', title:'Звезда по имени Солнце',artist:'Кино',             chords:'Am F C G Em Dm E',    key:'Am', bpm:126, difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Белый снег [F]серый лёд
На [C]растрескавшейся земле
[G]Одинокий стрелок [Em]
Целится в [Dm]небо пустое

[Am]Это всё что [F]останется после [C]меня
Это всё что [G]я возьму с собой [Am]
[F]Звезда по имени [C]Солнце [G]
[Am]Звезда по имени [F]Солнце [C] [G]`,
  },
  { id:'rr06', title:'Атас',                  artist:'Сектор Газа',      chords:'Am G F E',            key:'Am', bpm:140, difficulty:1, genre:'Русский рок' },
  { id:'rr07', title:'Колхозный панк',        artist:'Сектор Газа',      chords:'Am Dm E Am G',        key:'Am', bpm:152, difficulty:1, genre:'Русский рок' },
  { id:'rr08', title:'Я куплю тебе новую жизнь',artist:'Агата Кристи',  chords:'Am G F E C Dm',       key:'Am', bpm:116, difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Снова выпал [G]снег
[F]Снова целый [E]день
[Am]Ты молчишь со [G]мной
[F]Я не [E]нужен ей

[Am]Я куплю тебе [G]новую жизнь
[F]Синие глаза [E]синий горизонт
[Am]Куплю тебе [G]новую жизнь
[F]Дорогой мой [E]друг`,
  },
  { id:'rr09', title:'Опиум для никого',      artist:'Агата Кристи',     chords:'Am Dm E G C F',       key:'Am', bpm:135, difficulty:2, genre:'Русский рок' },
  { id:'rr10', title:'Завтра',                artist:'Агата Кристи',     chords:'Em C G D Am Bm',      key:'Em', bpm:100, difficulty:2, genre:'Русский рок' },
  { id:'rr11', title:'Крылья',                artist:'Наутилус Помпилиус',chords:'Am Dm G E F C',      key:'Am', bpm:98,  difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Не надо [Dm]думать с [G]нами тот кто [E]знает
Не надо думать [Am]
[Am]Ах что-то [F]сталось с [C]памятью [Am]моей
[Am]Я помню [Dm]только [G]что было [E]прежде
[Am]Как солнце [F]било прямо [C]в очи мне [Am]

[Am]Гудбай [F]Америка о [C]о
Где я не [Am]был никогда [F]
[C]Прощай навсегда [Am]возьми банджо [F]
[C]Сыграй мне [Am]на прощанье [F] [C] [Am]`,
  },
  { id:'rr12', title:'Гудбай Америка',        artist:'Наутилус Помпилиус',chords:'Am F C G Dm E',      key:'Am', bpm:102, difficulty:2, genre:'Русский рок' },
  { id:'rr13', title:'Человек и кошка',       artist:'Шевчук',           chords:'Am G F E Dm C',       key:'Am', bpm:90,  difficulty:2, genre:'Русский рок' },
  { id:'rr14', title:'Это всё',               artist:'Шевчук',           chords:'G D Am Em C F',       key:'G',  bpm:118, difficulty:2, genre:'Русский рок' },
  { id:'rr15', title:'Осень',                 artist:'ДДТ',              chords:'Am G F E C Dm',       key:'Am', bpm:84,  difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Что такое [G]осень
Это небо [F]
Плачущее небо [E]под ногами
[Am]Лужи под ногами [G]
Осень я давно [F]не верил чудесам [E]

[Am]Что такое [G]осень
Это камни [F]
Верность твёрдость [E]сила и уменье
[Am]Осень я опять [G]твоих чудес [F]не понимаю [E] [Am]`,
  },
  { id:'rr16', title:'Дождь',                 artist:'ДДТ',              chords:'Dm Am Bb F C Gm',     key:'Dm', bpm:96,  difficulty:2, genre:'Русский рок' },
  { id:'rr17', title:'Родина',                artist:'ДДТ',              chords:'Am Em Dm G C F E',    key:'Am', bpm:108, difficulty:2, genre:'Русский рок' },
  { id:'rr18', title:'Группа крови',          artist:'Кино',             chords:'Am Dm G Em C F E',    key:'Am', bpm:120, difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Тёплое место [Dm]
Но улицы [G]ждут
[Em]Отпечатков наших [Am]ног
[Am]Звёздная пыль [Dm]
На сапогах [G]
[Em]Мягкое кресло [Am]стол
[Dm]Клетчатый плед [G]
Не слышно [Em]хрипов в [Am]груди

[Am]Группа крови [Dm]
На рукаве [G]
[Em]Мой порядковый [Am]номер
На рукаве [Dm]
Пожелай мне [G]удачи в [Em]бою
Пожелай мне [Am]`,
  },
  { id:'rr19', title:'Апрель',                artist:'Кино',             chords:'Am G E Dm F C',       key:'Am', bpm:128, difficulty:2, genre:'Русский рок' },
  { id:'rr20', title:'Пачка сигарет',         artist:'Кино',             chords:'Am G Dm C F E',       key:'Am', bpm:98,  difficulty:2, genre:'Русский рок',
    lyrics:`[Am]Я сижу и смотрю [G]в чужое небо
Из чужого окна [Dm]
И не вижу ни одной [Am]знакомой звезды
[G]Я ходил по всем [Am]дорогам сразу

[Am]И у меня есть [G]пачка сигарет
[Dm]И это всё [Am]что есть у меня
И у меня есть [G]пачка сигарет
[Dm]И это всё [Am]что мне нужно сейчас`,
  },

  /* ── РУССКИЙ ПОП ────────────────────────────────────────────── */
  { id:'rp01', title:'Лаванда',               artist:'Кристина Орбакайте',chords:'Am F C G',           key:'Am', bpm:90,  difficulty:1, genre:'Русский поп' },
  { id:'rp02', title:'Странник',              artist:'Пикник',           chords:'Am Dm E Am G',        key:'Am', bpm:105, difficulty:1, genre:'Русский рок' },
  { id:'rp03', title:'Нет тебя прекрасней',   artist:'Нюша',             chords:'Am F C G Em',         key:'Am', bpm:120, difficulty:1, genre:'Русский поп' },
  { id:'rp04', title:'Это любовь',            artist:'Сплин',            chords:'Am G F E Dm C',       key:'Am', bpm:115, difficulty:2, genre:'Русский рок' },
  { id:'rp05', title:'Орбит без сахара',      artist:'Сплин',            chords:'Am Dm E G F C',       key:'Am', bpm:98,  difficulty:2, genre:'Русский рок' },
  { id:'rp06', title:'Романс',                artist:'Сплин',            chords:'Em Am D G C Bm',      key:'Em', bpm:88,  difficulty:2, genre:'Русский рок' },
  { id:'rp07', title:'Рождество',             artist:'Сплин',            chords:'Am G C F Dm E',       key:'Am', bpm:72,  difficulty:2, genre:'Русский рок' },
  { id:'rp08', title:'Выхода нет',            artist:'Сплин',            chords:'Am G F E C Dm',       key:'Am', bpm:130, difficulty:2, genre:'Русский рок' },
  { id:'rp09', title:'Поколение',             artist:'Сплин',            chords:'G D Em C Am Bm',      key:'G',  bpm:118, difficulty:2, genre:'Русский рок' },
  { id:'rp10', title:'Моя любовь',            artist:'Земфира',          chords:'Am G C F Dm E',       key:'Am', bpm:110, difficulty:2, genre:'Русский рок' },
  { id:'rp11', title:'Трафик',                artist:'Земфира',          chords:'Am G F E',            key:'Am', bpm:118, difficulty:1, genre:'Русский рок' },
  { id:'rp12', title:'Хочешь',                artist:'Земфира',          chords:'Am Dm G C F E',       key:'Am', bpm:95,  difficulty:2, genre:'Русский рок' },
  { id:'rp13', title:'Небо в огне',           artist:'Земфира',          chords:'Em C G D Am Bm',      key:'Em', bpm:120, difficulty:2, genre:'Русский рок' },

  /* ── FOLK & INDIE ───────────────────────────────────────────── */
  { id:'f001', title:'The Sound of Silence',  artist:'Simon & Garfunkel',chords:'Am G F Am C Dm',      key:'Am', bpm:100, difficulty:2, genre:'Folk',
    lyrics:`[Am]Hello [G]darkness my old [Am]friend
I've [Am]come to talk with [G]you a[Am]gain
Because a [C]vision softly [G]creeping
[C]Left its seeds while I [G]was sleeping
And the [C]vision that was planted in my [G]brain
Still re[Am]mains
Within the [F]sound of si[Am]lence`,
  },
  { id:'f002', title:'The Boxer',             artist:'Simon & Garfunkel',chords:'C G Am F Em',         key:'C',  bpm:106, difficulty:2, genre:'Folk' },
  { id:'f003', title:'Scarborough Fair',      artist:'Simon & Garfunkel',chords:'Am G Am C D',         key:'Am', bpm:78,  difficulty:2, genre:'Folk' },
  { id:'f004', title:'Fast Car',              artist:'Tracy Chapman',    chords:'C G D Am Em',         key:'C',  bpm:105, difficulty:2, genre:'Folk Rock',
    lyrics:`[C]You got a [G]fast car
I want a [D]ticket to anywhere
Maybe we [Am]make a deal
Maybe together we can [C]get somewhere
[G]Any place is [D]better
[Am]Starting from zero got nothing to [C]lose
Maybe we'll make something [G]me myself I got [D]nothing to prove`,
  },
  { id:'f005', title:'Hallelujah',            artist:'Leonard Cohen',    chords:'C Am F G E7',         key:'C',  bpm:52,  difficulty:2, genre:'Folk',
    lyrics:`[C]I've heard there [Am]was a secret [C]chord
That [Am]David played and [F]it pleased the Lord
But [C]you don't really [G]care for music [C]do you [G]
It [C]goes like this the [F]fourth the [G]fifth
The [Am]minor fall the [F]major lift
The [G]baffled king com[E7]posing Halle[Am]lujah

[F]Hallelujah [Am]hallelujah
[F]Hallelujah halle[C]lujah [G] [C]`,
  },
  { id:'f006', title:'Blowin in the Wind',    artist:'Bob Dylan',        chords:'G C D',               key:'G',  bpm:90,  difficulty:1, genre:'Folk',
    lyrics:`[G]How many [C]roads must a man walk [G]down
Before you [C]call him a [D]man
[G]How many [C]seas must a white dove [G]sail
Before she sleeps in the [D]sand
[G]Yes and how [C]many times must the [G]cannon balls fly
Before they're [C]forever [D]banned

The [G]answer my [C]friend is blowing [G]in the wind
The [C]answer is blowing [D]in the [G]wind`,
  },
  { id:'f007', title:'The Times They Are A-Changin',artist:'Bob Dylan',  chords:'G Em C D Am',         key:'G',  bpm:96,  difficulty:2, genre:'Folk' },
  { id:'f008', title:'Norwegian Wood',        artist:'The Beatles',      chords:'E D A G',             key:'E',  bpm:64,  difficulty:2, genre:'Folk Rock' },
  { id:'f009', title:'Blackbird',             artist:'The Beatles',      chords:'G Am G/B C Cm D7 G7', key:'G',  bpm:92,  difficulty:3, genre:'Folk Rock' },
  { id:'f010', title:'Here Comes the Sun',    artist:'The Beatles',      chords:'D A7sus4 A7 G Dsus4 E7',key:'D',bpm:126, difficulty:3, genre:'Folk Pop' },
  { id:'f011', title:'Riptide',               artist:'Vance Joy',        chords:'Am G C',              key:'Am', bpm:100, difficulty:1, genre:'Indie Pop',
    lyrics:`[Am]I was scared of [G]dentists and the [C]dark
[Am]I was scared of [G]pretty girls and [C]starting conversations
[Am]Oh all my [G]friends are turning [C]green
[Am]You're the magician's [G]assistant in their [C]dreams

[Am]Ooh and [G]they come unstuck
[Am]Lady run[G]ning down to the [C]riptide
[Am]Taken away to the [G]dark side
[C]I wanna be your left hand man`,
  },
  { id:'f012', title:'Ho Hey',                artist:'The Lumineers',    chords:'C F Am G',            key:'C',  bpm:162, difficulty:1, genre:'Folk Pop' },
  { id:'f013', title:'I Will Follow You',     artist:'Toulouse',         chords:'C G Am F',            key:'C',  bpm:118, difficulty:1, genre:'Indie Pop' },
  { id:'f014', title:'Horse With No Name',    artist:'America',          chords:'Em D6',               key:'Em', bpm:128, difficulty:1, genre:'Folk Rock' },
  { id:'f015', title:'Dust in the Wind',      artist:'Kansas',           chords:'C Am G Dm D',         key:'C',  bpm:85,  difficulty:2, genre:'Folk Rock' },

  /* ── LATIN & WORLD ──────────────────────────────────────────── */
  { id:'l001', title:'La Bamba',              artist:'Ritchie Valens',   chords:'C F G',               key:'C',  bpm:165, difficulty:1, genre:'Latin' },
  { id:'l002', title:'Guantanamera',          artist:'Народная',         chords:'C F G7 C',            key:'C',  bpm:108, difficulty:1, genre:'Latin' },
  { id:'l003', title:'Besame Mucho',          artist:'Consuelo Velázquez',chords:'Dm A7 Dm Gm Dm A7 Dm E7 A7',key:'Dm',bpm:96,difficulty:2, genre:'Latin' },
  { id:'l004', title:'La Vie en Rose',        artist:'Édith Piaf',       chords:'C E7 Am F G7 Dm',     key:'C',  bpm:88,  difficulty:2, genre:'Chanson' },
  { id:'l005', title:'Cucurrucucú Paloma',    artist:'Народная',         chords:'Am Dm E7 Am G7 C',    key:'Am', bpm:78,  difficulty:2, genre:'Latin' },

  /* ── РУССКИЙ ШАНСОН ─────────────────────────────────────────── */
  { id:'ch01', title:'Владимирский централ',  artist:'Михаил Круг',      chords:'Am Dm E Am G C F',    key:'Am', bpm:76,  difficulty:2, genre:'Шансон',
    lyrics:`[Am]Владимирский централ [Dm]ветер северный
[E]Этапом из Твери [Am]зла немерено
[Am]Пайковый хлеб [Dm]да луковица
[E]Хлеборез Валера [Am]снится

[Am]Этапом из Твери [Dm]этапом из Рязани
[E]Нас снова повезли в [Am]Владимирский централ
[Dm]Владимирский централ [Am]
[E]Ветер северный [Am]`,
  },
  { id:'ch02', title:'Шансон',                artist:'Михаил Круг',      chords:'Am G F E Dm C',       key:'Am', bpm:88,  difficulty:1, genre:'Шансон' },
  { id:'ch03', title:'Ночные дороги',         artist:'Михаил Круг',      chords:'Am Dm G C F E',       key:'Am', bpm:92,  difficulty:2, genre:'Шансон' },
  { id:'ch04', title:'Кольщик',               artist:'Михаил Круг',      chords:'Am E Dm Am G C F',    key:'Am', bpm:80,  difficulty:2, genre:'Шансон' },
  { id:'ch05', title:'Таганка',               artist:'Народная',         chords:'Am Dm E Am',           key:'Am', bpm:72,  difficulty:1, genre:'Шансон' },
  { id:'ch06', title:'Мурка',                 artist:'Народная',         chords:'Am E Am Dm Am E Am',   key:'Am', bpm:120, difficulty:1, genre:'Шансон' },
  { id:'ch07', title:'Одесса-мама',           artist:'Народная',         chords:'Am Dm E Am G',         key:'Am', bpm:96,  difficulty:1, genre:'Шансон' },
  { id:'ch08', title:'Гоп-стоп',              artist:'Аркадий Северный', chords:'Am Dm E Am G F',       key:'Am', bpm:110, difficulty:2, genre:'Шансон' },
  { id:'ch09', title:'Воры в законе',         artist:'Александр Дюмин',  chords:'Am G F E C Dm',       key:'Am', bpm:84,  difficulty:2, genre:'Шансон' },
  { id:'ch10', title:'Буду жить',             artist:'Стас Михайлов',    chords:'Am F C G Em',         key:'Am', bpm:90,  difficulty:1, genre:'Шансон' },

  /* ── СОВЕТСКАЯ КЛАССИКА ─────────────────────────────────────── */
  { id:'sv01', title:'Подмосковные вечера',   artist:'Народная',         chords:'C G7 Am Dm F',        key:'C',  bpm:74,  difficulty:2, genre:'Советская',
    lyrics:`[C]Не слышны в саду [G7]даже шорохи
[C]Всё здесь [Am]замерло до [Dm]утра
[F]Если б [C]знали вы как [Am]мне дороги
[Dm]Подмосковные [G7]вечера [C]

[C]Речка движется [G7]и не движется
[C]Вся из [Am]лунного сере[Dm]бра
[F]Песня [C]слышится и [Am]не слышится
[Dm]В эти [G7]тихие ве[C]чера`,
  },
  { id:'sv02', title:'День Победы',           artist:'Тухманов',         chords:'D A Bm G Em F#m',     key:'D',  bpm:108, difficulty:2, genre:'Советская' },
  { id:'sv03', title:'Журавли',               artist:'Бернес',           chords:'C G Am F Dm Em',      key:'C',  bpm:68,  difficulty:2, genre:'Советская',
    lyrics:`[C]Мне кажется порою [G]что солдаты
С кровавых не пришедшие [Am]полей
Не в землю [F]нашу полегли когда-то
А превратились [C]в белых журавлей

[C]Они до сей поры [G]с времён тех дальних
Летят и подают [Am]нам голоса
Не потому ль так [F]часто и печально
Мы замолкаем [C]глядя в небеса`,
  },
  { id:'sv04', title:'Катюша',                artist:'Народная',         chords:'C F G Am Dm G7',      key:'C',  bpm:108, difficulty:1, genre:'Народная',
    lyrics:`[C]Расцветали яблони и [F]груши
[C]Поплыли туманы над рекой [G7]
[C]Выходила на берег [Am]Катюша
[Dm]На высокий берег на [G7]крутой [C]

[C]Выходила пела [F]песню
[C]О степном орле сизом [G7]
[C]О том ком любила [Am]о том
Чьи [Dm]письма берегла [G7] [C]`,
  },
  { id:'sv05', title:'Тёмная ночь',           artist:'Богословский',     chords:'C G Am Dm F E',       key:'C',  bpm:72,  difficulty:2, genre:'Советская' },
  { id:'sv06', title:'Московские окна',       artist:'Народная',         chords:'C G F Am Dm',         key:'C',  bpm:80,  difficulty:1, genre:'Советская' },
  { id:'sv07', title:'Смуглянка',             artist:'Народная',         chords:'Am E Am Dm G C',      key:'Am', bpm:120, difficulty:2, genre:'Народная' },
  { id:'sv08', title:'Калинка',               artist:'Народная',         chords:'Am E Am Dm G Am',     key:'Am', bpm:140, difficulty:1, genre:'Народная' },
  { id:'sv09', title:'Ой мороз мороз',        artist:'Народная',         chords:'G D Em C Am',         key:'G',  bpm:92,  difficulty:1, genre:'Народная' },
  { id:'sv10', title:'По долинам и по взгорьям',artist:'Народная',       chords:'G C D G Am Em',       key:'G',  bpm:100, difficulty:1, genre:'Народная' },
  { id:'sv11', title:'Тонкая рябина',         artist:'Народная',         chords:'Am Dm E Am G C',      key:'Am', bpm:76,  difficulty:1, genre:'Народная' },
  { id:'sv12', title:'Во поле берёзка стояла',artist:'Народная',         chords:'G D Am Em C',         key:'G',  bpm:88,  difficulty:1, genre:'Народная' },

  /* ── СОВРЕМЕННЫЙ РОК ЗАРУБЕЖНЫЙ ────────────────────────────── */
  { id:'mr01', title:'21 Guns',               artist:'Green Day',        chords:'Dm Bb F C Am',        key:'Dm', bpm:76,  difficulty:2, genre:'Pop Punk' },
  { id:'mr02', title:'Boulevard of Broken Dreams',artist:'Green Day',    chords:'Fm Ab Eb Bb',         key:'Fm', bpm:90,  difficulty:2, genre:'Pop Punk' },
  { id:'mr03', title:'American Idiot',        artist:'Green Day',        chords:'A D B E',             key:'A',  bpm:175, difficulty:2, genre:'Pop Punk' },
  { id:'mr04', title:'The Middle',            artist:'Jimmy Eat World',  chords:'D A Bm G',            key:'D',  bpm:168, difficulty:1, genre:'Pop Rock' },
  { id:'mr05', title:'Iris',                  artist:'Goo Goo Dolls',    chords:'Bm D Bm G A',         key:'D',  bpm:90,  difficulty:2, genre:'Alt Rock',
    lyrics:`[Bm]And I'd give up [D]forever to touch you
[Bm]'Cause I know that [G]you feel me somehow
[Bm]You're the closest to [D]heaven that I'll ever be
And I [G]don't wanna go [A]home right now

[Bm]And all I can [D]taste is this moment
[Bm]And all I can [G]breathe is your life
[Bm]When sooner or [D]later it's over
I [G]just don't wanna [A]miss you tonight`,
  },
  { id:'mr06', title:'1979',                  artist:'Smashing Pumpkins', chords:'E A B C#m',          key:'E',  bpm:130, difficulty:2, genre:'Alt Rock' },
  { id:'mr07', title:'Creep',                 artist:'Radiohead',        chords:'G B C Cm',            key:'G',  bpm:92,  difficulty:2, genre:'Alt Rock',
    lyrics:`[G]When you were [B]here before
[C]Couldn't look you in the eye
[Cm]You're just like an angel
[G]Your skin makes me cry

[G]You float like a [B]feather
[C]In a beautiful world
[Cm]I wish I was special
[G]You're so fucking [B]special

[C]But I'm a creep [Cm]I'm a weirdo
[G]What the hell am I doing here
[B]I don't belong [C]here [Cm]`,
  },
  { id:'mr08', title:'Last Resort',           artist:'Papa Roach',       chords:'C Bb Gm F',           key:'Gm', bpm:100, difficulty:1, genre:'Rock' },
  { id:'mr09', title:'In the End',            artist:'Linkin Park',      chords:'Am F C G',            key:'Am', bpm:105, difficulty:1, genre:'Nu Metal' },
  { id:'mr10', title:'Numb',                  artist:'Linkin Park',      chords:'Eb Bb Cm Ab',         key:'Eb', bpm:104, difficulty:2, genre:'Nu Metal' },
  { id:'mr11', title:'One Step Closer',       artist:'Linkin Park',      chords:'E5 G5 A5 D5',         key:'E',  bpm:96,  difficulty:2, genre:'Nu Metal' },
  { id:'mr12', title:'My Immortal',           artist:'Evanescence',      chords:'C G Am F Em',         key:'C',  bpm:79,  difficulty:2, genre:'Rock' },
  { id:'mr13', title:'Bring Me to Life',      artist:'Evanescence',      chords:'Am C G D F Em',       key:'Am', bpm:100, difficulty:2, genre:'Rock' },
  { id:'mr14', title:'Seven Nation Army',     artist:'The White Stripes',chords:'E G A C B',           key:'E',  bpm:124, difficulty:1, genre:'Rock' },
  { id:'mr15', title:'Wonderwall',            artist:'Oasis',            chords:'Em7 G Dsus4 A7sus4 Cadd9', key:'G', bpm:87, difficulty:2, genre:'Britpop',
    lyrics:`[Em7]Today is gonna be the day
That they're [G]gonna throw it back to you
[Dsus4]By now you should have somehow
Realised [A7sus4]what you gotta do
[Em7]I don't believe that anybody
Feels the [G]way I do about you [Dsus4]now [A7sus4]

[Cadd9]Backbeat the word is on the street
That the [Em7]fire in your heart is out
[Cadd9]I'm sure you've heard it all before
But you [Em7]never really had a doubt
[G]I don't believe that [Dsus4]anybody [A7sus4]feels the way I do
About you [Cadd9]now [G] [Dsus4] [A7sus4]

[Cadd9]And all the roads we have to walk are [Em7]winding
[Cadd9]And all the lights that lead us there are [Em7]blinding
[G]There are many things that I would [Dsus4]like to say to you
But I don't know [A7sus4]how

Because [Cadd9]maybe [Em7]you're gonna be the one that [Cadd9]saves me [Em7]
And after [Cadd9]all you're my wonder[G]wall [Dsus4] [A7sus4]`,
  },
  { id:'mr16', title:"Don't Look Back in Anger",artist:'Oasis',          chords:'C G Am E F Fm',       key:'C',  bpm:86,  difficulty:2, genre:'Britpop' },
  { id:'mr17', title:'Chasing Cars',           artist:'Snow Patrol',     chords:'A E D',               key:'A',  bpm:104, difficulty:1, genre:'Indie Rock',
    lyrics:`[A]We'll do it [E]all
Everything [D]on our own
[A]We don't need [E]anything
Or anyone [D]

[A]If I lay here [E]
If I just lay [D]here
[A]Would you lie with me and [E]just forget the world? [D]

[A]I don't quite know [E]
How to say [D]how I feel
[A]Those three words [E]
Are said too much [D]they're not enough`,
  },
  { id:'mr18', title:'Fix You',                artist:'Coldplay',        chords:'C Em Am F G',         key:'C',  bpm:74,  difficulty:2, genre:'Indie Rock',
    lyrics:`[C]When you try your best but you don't suc[Em]ceed
[Am]When you get what you want but not what you [F]need
[C]When you feel so tired but you can't [Em]sleep
[Am]Stuck in re[F]verse

[C]And the tears come streaming down your [Em]face
[Am]When you lose something you can't re[F]place
[C]When you love someone but it goes to [Em]waste
Could it be [Am]worse? [F]

[C]Lights will guide you [Em]home
And [Am]ignite your bones [F]
[C]And I will try [Em]to fix [Am]you [F]`,
  },
  { id:'mr19', title:'The Scientist',          artist:'Coldplay',        chords:'Dm F C G Am',         key:'C',  bpm:76,  difficulty:2, genre:'Indie Rock' },
  { id:'mr20', title:'Yellow',                 artist:'Coldplay',        chords:'B F# Bbm Abm E',      key:'B',  bpm:88,  difficulty:2, genre:'Indie Rock' },
  { id:'mr21', title:'Clocks',                 artist:'Coldplay',        chords:'Eb Bbm Fm Ab',        key:'Eb', bpm:130, difficulty:2, genre:'Indie Rock' },
  { id:'mr22', title:'Mr. Brightside',         artist:'The Killers',     chords:'C G Am F',            key:'C',  bpm:148, difficulty:1, genre:'Indie Rock' },
  { id:'mr23', title:'Human',                  artist:'The Killers',     chords:'Bb F Gm Eb',          key:'Bb', bpm:105, difficulty:2, genre:'Indie Rock' },
  { id:'mr24', title:'Sex on Fire',            artist:'Kings of Leon',   chords:'E A D B',             key:'E',  bpm:160, difficulty:1, genre:'Indie Rock' },
  { id:'mr25', title:'Use Somebody',           artist:'Kings of Leon',   chords:'C G Am F',            key:'C',  bpm:137, difficulty:1, genre:'Indie Rock' },
  { id:'mr26', title:'Viva la Vida',           artist:'Coldplay',        chords:'Ab Bb Cm Gm',         key:'Ab', bpm:138, difficulty:2, genre:'Indie Rock' },
  { id:'mr27', title:'Radioactive',            artist:'Imagine Dragons', chords:'Bm D A E',            key:'Bm', bpm:137, difficulty:1, genre:'Pop Rock' },
  { id:'mr28', title:'Thunder',               artist:'Imagine Dragons', chords:'Am F C G',            key:'Am', bpm:163, difficulty:1, genre:'Pop Rock' },
  { id:'mr29', title:'Lose Yourself',          artist:'Eminem',          chords:'Dm Bb F C',           key:'Dm', bpm:171, difficulty:2, genre:'Hip-Hop' },
  { id:'mr30', title:'Shallow (Acoustic)',     artist:'Lady Gaga',       chords:'Em D G C Am F',       key:'G',  bpm:96,  difficulty:2, genre:'Pop' },

  /* ── ИНДИ / АЛЬТЕРНАТИВА ────────────────────────────────────── */
  { id:'in01', title:'Stolen Dance',           artist:'Milky Chance',    chords:'Am F G C Em',         key:'Am', bpm:95,  difficulty:2, genre:'Indie' },
  { id:'in02', title:'Budapest',               artist:'George Ezra',     chords:'C G F Am Dm',         key:'C',  bpm:95,  difficulty:2, genre:'Indie' },
  { id:'in03', title:'Barcelona',              artist:'George Ezra',     chords:'G D Am C Em',         key:'G',  bpm:94,  difficulty:2, genre:'Indie' },
  { id:'in04', title:'Take Me to Church',      artist:'Hozier',          chords:'Am F C G Em Dm',      key:'Am', bpm:132, difficulty:2, genre:'Indie Soul' },
  { id:'in05', title:'Work Song',              artist:'Hozier',          chords:'Am Em G D F C',       key:'Am', bpm:98,  difficulty:2, genre:'Indie Soul' },
  { id:'in06', title:'Let Her Go',             artist:'Passenger',       chords:'G D Em C',            key:'G',  bpm:74,  difficulty:1, genre:'Indie Folk',
    lyrics:`[G]Well you only [D]need the light when it's burning low
Only miss the [Em]sun when it starts to snow
Only know you [C]love her when you let her go
Only know you've [G]been high when you're feeling low
Only hate the [D]road when you're missing home
Only know you [Em]love her when you let her [C]go
[G] [D] [Em] [C]

[G]Staring at the [D]bottom of your glass
Hoping one day [Em]you'll make a dream last
But dreams come slow and [C]they go so fast
[G]You see her when you [D]close your eyes
Maybe one day [Em]you'll understand why
Everything you [C]touch surely dies`,
  },
  { id:'in07', title:'Skinny Love',            artist:'Bon Iver',        chords:'C Am F G Em',         key:'C',  bpm:92,  difficulty:2, genre:'Indie Folk' },
  { id:'in08', title:'Holocene',               artist:'Bon Iver',        chords:'G D Am Em C F',       key:'G',  bpm:90,  difficulty:2, genre:'Indie Folk' },
  { id:'in09', title:'The Night Will Always Win',artist:'Manchester Orchestra',chords:'C G Am F Em',   key:'C',  bpm:95,  difficulty:2, genre:'Indie Rock' },
  { id:'in10', title:'Demons',                 artist:'Imagine Dragons', chords:'C G Am F',            key:'C',  bpm:90,  difficulty:1, genre:'Pop Rock' },

  /* ── КЛАССИЧЕСКИЕ БАЛЛАДЫ ───────────────────────────────────── */
  { id:'ba01', title:'Unchained Melody',       artist:'Righteous Brothers',chords:'C Am F G Em',       key:'C',  bpm:66,  difficulty:2, genre:'Ballad' },
  { id:'ba02', title:'Stand By Me',            artist:'Ben E. King',     chords:'A F#m D E',           key:'A',  bpm:120, difficulty:1, genre:'Soul',
    lyrics:`[A]When the night has come
And the land is [F#m]dark
And the moon is the only light we'll [D]see [E]
No I won't be afraid [A]
No I won't be afraid
Just as [F#m]long as you stand [D]stand by [E]me

So [A]darling darling stand by [F#m]me oh stand by me
Oh [D]stand by me [E]stand by [A]me`,
  },
  { id:'ba03', title:'Moon River',             artist:'Audrey Hepburn',  chords:'C Am F Em Bm7 G',     key:'C',  bpm:70,  difficulty:2, genre:'Ballad' },
  { id:'ba04', title:'Wonderful Tonight',      artist:'Eric Clapton',    chords:'G D C Em',            key:'G',  bpm:92,  difficulty:1, genre:'Blues Rock',
    lyrics:`[G]It's late in the [D]evening
She's wondering [C]what clothes to wear [D]
She puts on her [G]make-up
And brushes her [D]long blonde hair [C] [D]

[G]And then she asks [D]me
Do I look [C]alright [D]
And I say yes [G]you look wonderful [D]tonight [C] [D]`,
  },
  { id:'ba05', title:'Tears in Heaven',        artist:'Eric Clapton',    chords:'A E F#m D F#m B7 C#7',key:'A', bpm:80,  difficulty:3, genre:'Blues Rock' },
  { id:'ba06', title:'Layla (Acoustic)',        artist:'Eric Clapton',    chords:'Dm Bb C F',           key:'Dm', bpm:78,  difficulty:2, genre:'Blues Rock' },
  { id:'ba07', title:'Hotel California',       artist:'Eagles',           chords:'Bm F# A E G D Em F#', key:'Bm', bpm:75, difficulty:3, genre:'Classic Rock',
    lyrics:`[Bm]On a dark desert highway [F#]cool wind in my hair
[A]Warm smell of colitas [E]rising up through the air
[G]Up ahead in the distance [D]I saw a shimmering light
[Em]My head grew heavy and my sight grew dim
[F#]I had to stop for the night

[Bm]There she stood in the [F#]doorway
I heard the mission [A]bell
And I was thinking to my[E]self
This could be [G]heaven or this could be [D]hell
Then she lit up a [Em]candle and she showed me the way
[F#]There were voices down the corridor
I thought I heard them [Bm]say

[G]Welcome to the Hotel Cali[D]fornia
Such a [Em]lovely place such a [B7]lovely face
[G]Plenty of room at the Hotel Cali[D]fornia
Any [Em]time of year you can [F#]find it here`,
  },
  { id:'ba08', title:'Desperado',              artist:'Eagles',           chords:'G D Em C Am',         key:'G',  bpm:64,  difficulty:2, genre:'Country Rock' },
  { id:'ba09', title:'Take It Easy',           artist:'Eagles',           chords:'G C Am D',            key:'G',  bpm:140, difficulty:1, genre:'Country Rock' },

  /* ── БЛЮЗ ───────────────────────────────────────────────────── */
  { id:'bl01', title:'Pride and Joy',          artist:'SRV',              chords:'E7 A7 B7',            key:'E',  bpm:130, difficulty:2, genre:'Blues' },
  { id:'bl02', title:'The Thrill Is Gone',     artist:'B.B. King',        chords:'Bm Em F# Bm',         key:'Bm', bpm:65,  difficulty:2, genre:'Blues' },
  { id:'bl03', title:'Sweet Home Chicago',     artist:'Robert Johnson',   chords:'A7 D7 E7',            key:'A',  bpm:142, difficulty:2, genre:'Blues' },
  { id:'bl04', title:"Crossroads",             artist:'Cream',            chords:'A D E',               key:'A',  bpm:168, difficulty:2, genre:'Blues Rock' },
  { id:'bl05', title:'Stormy Monday',          artist:'T-Bone Walker',    chords:'G9 C9 G7 D7 C7 Cm',   key:'G',  bpm:60,  difficulty:3, genre:'Blues' },

  /* ── РЕГГИ / РОК-Н-РОЛЛ ────────────────────────────────────── */
  { id:'re01', title:'Redemption Song',        artist:'Bob Marley',       chords:'G Em C D Am',         key:'G',  bpm:74,  difficulty:2, genre:'Reggae',
    lyrics:`[G]Old pirates yes they rob I [Em]
[C]Sold I to the merchant [G]ships [D]
[G]Minutes after they took I [Em]
From the [C]bottomless pit [G] [D]

[G]But my hand was made strong [Em]
[C]By the hand of the Al[G]mighty [D]
[G]We forward in this [Em]generation
[C]Triumphantly [G] [D]

[G]Won't you help to [Em]sing
[C]These songs of free[G]dom
[D]'Cause all I ever [Em]had [C]
[G]Redemption songs [D] [G]`,
  },
  { id:'re02', title:'Stir It Up',             artist:'Bob Marley',       chords:'A D E',               key:'A',  bpm:76,  difficulty:1, genre:'Reggae' },
  { id:'re03', title:'Three Little Birds',     artist:'Bob Marley',       chords:'A D E',               key:'A',  bpm:72,  difficulty:1, genre:'Reggae' },
  { id:'re04', title:'Johnny B. Goode',        artist:'Chuck Berry',      chords:'A D E',               key:'A',  bpm:168, difficulty:2, genre:'Rock n Roll' },
  { id:'re05', title:"Roll Over Beethoven",    artist:'Chuck Berry',      chords:'A D E A7 D7 E7',      key:'A',  bpm:184, difficulty:2, genre:'Rock n Roll' },
  { id:'re06', title:'Hound Dog',              artist:'Elvis Presley',    chords:'A D E',               key:'A',  bpm:174, difficulty:1, genre:'Rock n Roll' },
  { id:'re07', title:'Jailhouse Rock',         artist:'Elvis Presley',    chords:'E A B7',              key:'E',  bpm:165, difficulty:2, genre:'Rock n Roll' },

  /* ── ПОЗДНИЙ РУССКИЙ РОК / ИНДИ ────────────────────────────── */
  { id:'nr01', title:'Высоко',                  artist:'Би-2',             chords:'Am G F E Dm C',       key:'Am', bpm:120, difficulty:2, genre:'Русский рок' },
  { id:'nr02', title:'Полковник',              artist:'Би-2',             chords:'Am Em G C Dm F',       key:'Am', bpm:128, difficulty:2, genre:'Русский рок' },
  { id:'nr03', title:'Варвара',                artist:'Би-2',             chords:'Am G F E',             key:'Am', bpm:115, difficulty:1, genre:'Русский рок' },
  { id:'nr04', title:'Мой рок-н-ролл',         artist:'БИ-2',             chords:'C G Am F Em Dm',       key:'C',  bpm:130, difficulty:2, genre:'Русский рок' },
  { id:'nr05', title:'Кукушка',                artist:'Виктор Цой',       chords:'Em C G D Am',         key:'Em', bpm:106, difficulty:2, genre:'Русский рок',
    lyrics:`[Em]Прежде чем вступить в этот мир
Я [C]молчал [G]молчал [D]молчал
[Em]Я нарисовал странный знак
На [C]двери [G]своей [D]

[Em]Солнце светило нам в спину
Нам [C]в лицо дул [G]ветер [D]
[Em]Зеркала забиты в домах
[C]И не будет [G]ответа [D]

[Em]Кукушка кукушка
[C]Сколько лет мне [G]жить [D]
Эй [Em]кукушка кукушка
[C]Всё лети [G]лети [D]`,
  },
  { id:'nr06', title:'Нам не нужны деньги',    artist:'Виктор Цой',       chords:'Am G F E',             key:'Am', bpm:130, difficulty:1, genre:'Русский рок' },
  { id:'nr07', title:'Странный сосед',         artist:'Ноггано',          chords:'Am Dm G C F E',        key:'Am', bpm:95,  difficulty:2, genre:'Хип-хоп' },
  { id:'nr08', title:'Всё идёт по плану',      artist:'Гражданская Оборона',chords:'Am G F E Dm C',      key:'Am', bpm:140, difficulty:2, genre:'Панк' },
  { id:'nr09', title:'Моя оборона',            artist:'Гражданская Оборона',chords:'Am G F E',           key:'Am', bpm:160, difficulty:1, genre:'Панк' },
  { id:'nr10', title:'Весна',                  artist:'Порнофильмы',      chords:'Am G C F Dm E',        key:'Am', bpm:110, difficulty:2, genre:'Русский рок' },
  { id:'nr11', title:'Районы',                 artist:'Порнофильмы',      chords:'Am F C G Em',          key:'Am', bpm:118, difficulty:1, genre:'Русский рок' },
  { id:'nr12', title:'Ляпис Трубецкой',        artist:'Ты кинула',        chords:'Dm Am Bb F C Gm',      key:'Dm', bpm:132, difficulty:2, genre:'Русский рок' },
  { id:'nr13', title:'Воробей',                artist:'Чайф',             chords:'G D Am Em C F',        key:'G',  bpm:120, difficulty:2, genre:'Русский рок' },
  { id:'nr14', title:'Не со мной',             artist:'Чайф',             chords:'Am G F E C Dm',        key:'Am', bpm:100, difficulty:2, genre:'Русский рок' },
  { id:'nr15', title:'Оранжевое настроение',   artist:'Чайф',             chords:'C G F Am Dm',          key:'C',  bpm:126, difficulty:1, genre:'Русский рок' },

  /* ── СОВРЕМЕННЫЙ РУС. ПОП / R&B ────────────────────────────── */
  { id:'rn01', title:'Последний герой',        artist:'Ваня Дмитриенко',  chords:'Am F C G',             key:'Am', bpm:90,  difficulty:1, genre:'Русский поп' },
  { id:'rn02', title:'Мало',                   artist:'Элджей',           chords:'Am G F E Dm C',        key:'Am', bpm:128, difficulty:2, genre:'Хип-хоп' },
  { id:'rn03', title:'Тает лёд',               artist:'Элджей & Feduk',   chords:'Am G F E',             key:'Am', bpm:117, difficulty:1, genre:'Русский поп' },
  { id:'rn04', title:'Малиновый закат',        artist:'Тима Белорусских', chords:'Am F C G Em Dm',       key:'Am', bpm:96,  difficulty:2, genre:'Русский поп' },
  { id:'rn05', title:'Незабудка',              artist:'Тима Белорусских', chords:'Am G C F Dm E',        key:'Am', bpm:103, difficulty:2, genre:'Русский поп' },
  { id:'rn06', title:'Цвет настроения синий',  artist:'Филипп Киркоров',  chords:'Dm Gm Bb F C A',       key:'Dm', bpm:128, difficulty:2, genre:'Русский поп' },
  { id:'rn07', title:'Пьяная',                 artist:'Тимати',           chords:'Am G F E Dm',          key:'Am', bpm:132, difficulty:1, genre:'Хип-хоп' },
  { id:'rn08', title:'Все для тебя',           artist:'Ани Лорак',        chords:'Am F C G',             key:'Am', bpm:112, difficulty:1, genre:'Русский поп' },

  /* ── THE BEATLES ──────────────────────────────────────────────── */
  { id:'be01', title:'Come Together',         artist:'The Beatles',      chords:'Dm A G C',            key:'Dm', bpm:84,  difficulty:2, genre:'Classic Rock' },
  { id:'be02', title:'Hey Jude',              artist:'The Beatles',      chords:'F C Bb',              key:'F',  bpm:74,  difficulty:1, genre:'Classic Rock',
    lyrics:`[F]Hey Jude don't make it [C]bad
Take a sad song and make it [F]better
Remember to let her into your [Bb]heart
Then you can start to make it [F]better

[F]Hey Jude don't be a[C]fraid
You were made to go out and [F]get her
The minute you let her under your [Bb]skin
Then you begin to make it [F]better

[Bb]And anytime you feel the [F]pain
Hey [C]Jude refrain
Don't carry the [F]world upon your shoulders
[Bb]For well you know that it's a [F]fool
Who [C]plays it cool
By making his world a little [F]colder`,
  },
  { id:'be03', title:'Yesterday',             artist:'The Beatles',      chords:'F Em A7 Dm Bb C',     key:'F',  bpm:96,  difficulty:2, genre:'Classic Rock',
    lyrics:`[F]Yesterday all my troubles seemed so [Em]far away
[A7]Now it looks as though they're [Dm]here to stay
[Bb]Oh I be[C]lieve in [F]yesterday

[F]Suddenly I'm not half the [Em]man I used to be
[A7]There's a shadow hanging [Dm]over me
[Bb]Oh yester[C]day came [F]suddenly

[Dm]Why she [C]had to go [Bb]I don't [F]know she wouldn't say
[Dm]I said [C]something wrong [Bb]now I long for [C]yesterday

[F]Yesterday love was such an easy [Em]game to play
[A7]Now I need a place to [Dm]hide away
[Bb]Oh I be[C]lieve in [F]yesterday`,
  },
  { id:'be04', title:'In My Life',            artist:'The Beatles',      chords:'A E F#m D G Dm',      key:'A',  bpm:104, difficulty:2, genre:'Classic Rock' },
  { id:'be05', title:'Michelle',              artist:'The Beatles',      chords:'F Fm C Ab Bb G7',     key:'F',  bpm:90,  difficulty:3, genre:'Classic Rock' },
  { id:'be06', title:'Ob-La-Di Ob-La-Da',    artist:'The Beatles',      chords:'G C D Em Am',         key:'G',  bpm:168, difficulty:1, genre:'Classic Rock' },
  { id:'be07', title:'With a Little Help From My Friends', artist:'The Beatles', chords:'E B F#m A D', key:'E', bpm:112, difficulty:2, genre:'Classic Rock' },
  { id:'be08', title:'Something',             artist:'The Beatles',      chords:'F Eb G C Am Cm D7 G7 A',key:'C',bpm:76, difficulty:3, genre:'Classic Rock' },
  { id:'be09', title:"Don't Let Me Down",     artist:'The Beatles',      chords:'E A F#m B',           key:'E',  bpm:128, difficulty:2, genre:'Classic Rock' },
  { id:'be10', title:'Get Back',              artist:'The Beatles',      chords:'A D G',               key:'A',  bpm:126, difficulty:1, genre:'Classic Rock' },
  { id:'be11', title:'Twist and Shout',       artist:'The Beatles',      chords:'D G A',               key:'D',  bpm:124, difficulty:1, genre:'Classic Rock' },
  { id:'be12', title:'I Want to Hold Your Hand',artist:'The Beatles',    chords:'G D Em B7 C',         key:'G',  bpm:172, difficulty:2, genre:'Classic Rock' },
  { id:'be13', title:'Lucy in the Sky with Diamonds',artist:'The Beatles',chords:'A G F Bb C D Dm',    key:'A',  bpm:90,  difficulty:3, genre:'Classic Rock' },
  { id:'be14', title:'Help!',                 artist:'The Beatles',      chords:'Am Am7 D F G Bm',     key:'Am', bpm:144, difficulty:2, genre:'Classic Rock',
    lyrics:`[Am]Help I need somebody [Am7]
[D]Help not just anybody [F]
[G]Help you know I need someone [Am]help

[Am]When I was younger so much younger than to[Am7]day
[D]I never needed anybody's help in any[F]way
[G]But now those days are gone I'm not so self as[Bm]sured
Now I find I've changed my mind and [G]opened up the doors

[Am]Help me if you can I'm feeling [Am7]down
[D]And I do appreciate you being [F]round
[G]Help me get my feet back on the [Bm]ground
Won't you [G]please please help [Am]me`,
  },
  { id:'be15', title:'A Hard Day\'s Night',   artist:'The Beatles',      chords:'G C F D Em Bm',       key:'G',  bpm:166, difficulty:2, genre:'Classic Rock' },

  /* ── ROLLING STONES ──────────────────────────────────────────── */
  { id:'rs01', title:'Paint It Black',        artist:'Rolling Stones',   chords:'Em B7 D G',           key:'Em', bpm:165, difficulty:2, genre:'Classic Rock',
    lyrics:`[Em]I see a red door and I want it painted [B7]black
No colors anymore I want them to turn [Em]black
[Em]I see the girls walk by dressed in their summer [B7]clothes
I have to turn my head until my darkness [Em]goes

[Em]I see a line of cars and they're all painted [B7]black
With flowers and my love both never to come [Em]back
[Em]I see people turn their heads and quickly look a[B7]way
Like a newborn baby it just happens every [Em]day`,
  },
  { id:'rs02', title:"(I Can't Get No) Satisfaction", artist:'Rolling Stones', chords:'E A B',         key:'E',  bpm:136, difficulty:1, genre:'Classic Rock',
    lyrics:`[E]I can't get no satis[A]faction
I can't get no satis[E]faction
'Cause I [B]try and I try and I try try try
I can't get [A]no I can't get [E]no

[E]When I'm drivin' in my car
And a man comes on the [A]radio
He's tellin' me more and more
About some useless in[E]formation
Supposed to fire my ima[B]gination
I can't get no [A]oh no no [E]no`,
  },
  { id:'rs03', title:'Sympathy for the Devil', artist:'Rolling Stones',  chords:'E D A B',             key:'E',  bpm:122, difficulty:1, genre:'Classic Rock' },
  { id:'rs04', title:'Wild Horses',           artist:'Rolling Stones',   chords:'Am G Bm D C F',       key:'G',  bpm:72,  difficulty:2, genre:'Classic Rock' },
  { id:'rs05', title:'Gimme Shelter',         artist:'Rolling Stones',   chords:'C# G# Ab',            key:'C#', bpm:96,  difficulty:2, genre:'Classic Rock' },
  { id:'rs06', title:'Start Me Up',           artist:'Rolling Stones',   chords:'C F G',               key:'C',  bpm:128, difficulty:1, genre:'Classic Rock' },
  { id:'rs07', title:'Brown Sugar',           artist:'Rolling Stones',   chords:'C D F G',             key:'C',  bpm:148, difficulty:1, genre:'Classic Rock' },

  /* ── LED ZEPPELIN ────────────────────────────────────────────── */
  { id:'lz01', title:'Whole Lotta Love',      artist:'Led Zeppelin',     chords:'E D A',               key:'E',  bpm:90,  difficulty:2, genre:'Classic Rock' },
  { id:'lz02', title:'Black Dog',             artist:'Led Zeppelin',     chords:'A D G E',             key:'A',  bpm:84,  difficulty:2, genre:'Classic Rock' },
  { id:'lz03', title:'Kashmir',               artist:'Led Zeppelin',     chords:'D Dsus2 C G A',       key:'D',  bpm:76,  difficulty:3, genre:'Classic Rock' },
  { id:'lz04', title:'Rock and Roll',         artist:'Led Zeppelin',     chords:'A D E',               key:'A',  bpm:170, difficulty:2, genre:'Classic Rock' },
  { id:'lz05', title:'Going to California',   artist:'Led Zeppelin',     chords:'D Am C G',            key:'D',  bpm:74,  difficulty:2, genre:'Folk Rock' },
  { id:'lz06', title:'Tangerine',             artist:'Led Zeppelin',     chords:'G D Am C Em',         key:'G',  bpm:72,  difficulty:2, genre:'Folk Rock' },

  /* ── DEEP PURPLE / OZZY / JUDAS ─────────────────────────────── */
  { id:'dp01', title:'Child in Time',         artist:'Deep Purple',      chords:'Am G D E Am',         key:'Am', bpm:76,  difficulty:3, genre:'Classic Rock' },
  { id:'dp02', title:'Space Truckin',         artist:'Deep Purple',      chords:'A G D E',             key:'A',  bpm:120, difficulty:2, genre:'Classic Rock' },
  { id:'dp03', title:'Crazy Train',           artist:'Ozzy Osbourne',    chords:'F# A B D E',          key:'F#', bpm:138, difficulty:3, genre:'Heavy Metal' },
  { id:'dp04', title:'Mr. Crowley',           artist:'Ozzy Osbourne',    chords:'Dm C Bb A Gm F',      key:'Dm', bpm:86,  difficulty:2, genre:'Heavy Metal' },
  { id:'dp05', title:'Breaking the Law',      artist:'Judas Priest',     chords:'Em D C B',            key:'Em', bpm:116, difficulty:2, genre:'Heavy Metal' },
  { id:'dp06', title:'Living After Midnight', artist:'Judas Priest',     chords:'A D E G',             key:'A',  bpm:120, difficulty:1, genre:'Heavy Metal' },
  { id:'dp07', title:'Iron Man',              artist:'Black Sabbath',    chords:'B G A Bb B D E',      key:'B',  bpm:120, difficulty:2, genre:'Heavy Metal' },

  /* ── AEROSMITH / BON JOVI / GUNS N ROSES ───────────────────── */
  { id:'aj01', title:"Don't Stop Believin'",  artist:'Journey',          chords:'E B C#m A G',         key:'E',  bpm:118, difficulty:1, genre:'Classic Rock',
    lyrics:`[E]Just a small town girl [B]livin' in a lonely world
She took the [C#m]midnight train going [A]anywhere
[E]Just a city boy [B]born and raised in South Detroit
He took the [C#m]midnight train going [A]anywhere

[E]A singer in a smoky room [B]
The smell of wine and [C#m]cheap perfume
For a smile they can [A]share the night
It goes [E]on and on and on and [B]on

[C#m]Strangers waiting [A]
Up and down the [E]boulevard
Their [B]shadows searching in the [C#m]night [A]
[E]Streetlights people [B]
Livin' just to find e[C#m]motion [A]
Hidin' somewhere in the [E]night [B] [C#m] [A]

Don't stop be[E]lievin' [B]hold on to the feelin' [C#m] [A]
Don't stop be[E]lievin' [B]hold on [C#m] [A]`,
  },
  { id:'aj02', title:'Livin on a Prayer',     artist:'Bon Jovi',         chords:'Em C D G Bm',         key:'Em', bpm:123, difficulty:2, genre:'Pop Rock',
    lyrics:`[Em]Tommy used to work on the docks
[C]Union's been on strike
[D]He's down on his luck it's [Em]tough so tough
[Em]Gina works the diner all day
[C]Working for her man
[D]She brings home her pay for [Em]love mm for love

[C]She says we've got to [D]hold on to what we've got
[Em]It doesn't make a dif-[D]ference if we make it or not
[C]We've got each other and [D]that's a lot for [Em]love [D]
We'll give it a [C]shot

[Em]Woah we're half[C]way there
Woah [D]livin' on a prayer
[Em]Take my hand we'll [C]make it I swear
Woah [D]livin' on a prayer`,
  },
  { id:'aj03', title:"Wanted Dead or Alive",  artist:'Bon Jovi',         chords:'D Dsus4 C G F Am',    key:'D',  bpm:76,  difficulty:2, genre:'Pop Rock' },
  { id:'aj04', title:"It's My Life",          artist:'Bon Jovi',         chords:'Am F G C Em',         key:'Am', bpm:120, difficulty:1, genre:'Pop Rock',
    lyrics:`[Am]This ain't a song for the broken-hearted
[F]No silent prayer for the faith-departed
[G]I ain't gonna be just a face in the crowd
[Am]You're gonna hear my voice when I shout it out loud

[Am]It's my life [F]it's now or never
[G]I ain't gonna live forever
[Am]I just want to live while I'm alive
[F]It's my life
[G]My heart is like an open highway
[Am]Like Frankie said I did it my way
[F]I just wanna live while I'm alive
It's my [G]life [Am]`,
  },
  { id:'aj05', title:'Bed of Roses',          artist:'Bon Jovi',         chords:'A E Bm D F#m G',      key:'A',  bpm:66,  difficulty:2, genre:'Pop Rock' },
  { id:'aj06', title:"Dream On",              artist:'Aerosmith',        chords:'Dm Dm7 Am F G E',     key:'Dm', bpm:82,  difficulty:3, genre:'Classic Rock' },
  { id:'aj07', title:'I Don\'t Want to Miss a Thing',artist:'Aerosmith', chords:'A D/F# E/G# G D Em F#m',key:'A',bpm:68, difficulty:2, genre:'Pop Rock' },
  { id:'aj08', title:'November Rain',         artist:'Guns N\' Roses',   chords:'G Cadd9 Am Em D C F', key:'G',  bpm:74,  difficulty:3, genre:'Classic Rock' },
  { id:'aj09', title:"Sweet Child O' Mine",  artist:"Guns N' Roses",   chords:'D C G Am',            key:'D',  bpm:122, difficulty:2, genre:'Classic Rock',
    lyrics:`[D]She's got a smile that it seems to me
Reminds me of childhood [C]memories
Where everything was as fresh as the [G]bright blue sky
[Am]Now and then when I see her face
She takes me away to that [D]special place
And if I stare too long I'd [C]probably break down and [G]cry

[D]Sweet child o' mine [C]
[G]Sweet love of mine [Am] [D]

[D]She's got eyes of the bluest skies
As if they thought of [C]rain
I hate to look into those eyes and [G]see an ounce of pain
[Am]Her hair reminds me of a warm safe place
Where as a child I'd [D]hide
And pray for the thunder and the [C]rain to quietly [G]pass me by`,
  },
  { id:'aj10', title:'Welcome to the Jungle', artist:'Guns N\' Roses',   chords:'E A G D B F# C',      key:'E',  bpm:110, difficulty:2, genre:'Classic Rock' },
  { id:'aj11', title:'Paradise City',         artist:'Guns N\' Roses',   chords:'G C F D Am Em',       key:'G',  bpm:100, difficulty:2, genre:'Classic Rock' },
  { id:'aj12', title:'Patience',              artist:'Guns N\' Roses',   chords:'C G A D F Em',        key:'G',  bpm:122, difficulty:2, genre:'Classic Rock' },

  /* ── U2 / R.E.M. / PEARL JAM ────────────────────────────────── */
  { id:'u201', title:'Sunday Bloody Sunday',  artist:'U2',               chords:'Bm D G C',            key:'Bm', bpm:136, difficulty:2, genre:'Rock' },
  { id:'u202', title:'Where the Streets Have No Name',artist:'U2',      chords:'D G A E',             key:'D',  bpm:126, difficulty:2, genre:'Rock' },
  { id:'u203', title:'One',                   artist:'U2',               chords:'Am Dm F C G',         key:'Am', bpm:97,  difficulty:2, genre:'Rock' },
  { id:'u204', title:'Losing My Religion',    artist:'R.E.M.',           chords:'Am F C G Em',         key:'Am', bpm:124, difficulty:2, genre:'Alt Rock' },
  { id:'u205', title:'Everybody Hurts',       artist:'R.E.M.',           chords:'D G Em A',            key:'D',  bpm:66,  difficulty:1, genre:'Alt Rock' },
  { id:'u206', title:'Black',                 artist:'Pearl Jam',        chords:'E A B C#m',           key:'E',  bpm:96,  difficulty:2, genre:'Grunge' },
  { id:'u207', title:'Better Man',            artist:'Pearl Jam',        chords:'C G D F Am Em',       key:'C',  bpm:76,  difficulty:2, genre:'Grunge' },
  { id:'u208', title:'Alive',                 artist:'Pearl Jam',        chords:'A G D',               key:'A',  bpm:88,  difficulty:1, genre:'Grunge' },
  { id:'u209', title:'Heart-Shaped Box',      artist:'Nirvana',          chords:'F5 A5 C5 G5 D5',      key:'F',  bpm:104, difficulty:2, genre:'Grunge' },
  { id:'u210', title:'About a Girl',          artist:'Nirvana',          chords:'Em G C Bb Am',        key:'Em', bpm:168, difficulty:2, genre:'Grunge' },

  /* ── 80s HITS ────────────────────────────────────────────────── */
  { id:'80s01', title:'Sweet Dreams (Are Made of This)',artist:'Eurythmics',chords:'Am F G Em',         key:'Am', bpm:128, difficulty:1, genre:'80s Pop',
    lyrics:`[Am]Sweet dreams are made of [F]this
[G]Who am I to disa[Em]gree
[Am]I travel the world and the [F]seven seas
[G]Everybody's looking for some[Am]thing

[Am]Some of them want to [F]use you
[G]Some of them want to get [Em]used by you
[Am]Some of them want to a[F]buse you
[G]Some of them want to be a[Am]bused

[Am]Sweet dreams are made of [F]this
[G]Who am I to disa[Em]gree`,
  },
  { id:'80s02', title:'Take On Me',           artist:'A-ha',             chords:'A D E F#m B',         key:'A',  bpm:169, difficulty:2, genre:'80s Pop',
    lyrics:`[A]We're talking away [D]
I don't know what I'm to [A]say I'll say it any[D]way
[A]Today is another day to find you [D]
Shying away [A]I'll be coming for your love okay [D]

[A]Take on me [D]take me on [A]
I'll be gone [D]in a day or [A]two

[A]So needless to say [D]
I'm odds and ends [A]but that's me stumbling a[D]way
[A]Slowly learning that life is okay [D]
Say after me [A]it's no better to be safe than [D]sorry`,
  },
  { id:'80s03', title:'Don\'t You (Forget About Me)',artist:'Simple Minds',chords:'A D E F#m',         key:'A',  bpm:130, difficulty:1, genre:'80s Pop' },
  { id:'80s04', title:'Tainted Love',         artist:'Soft Cell',        chords:'F G Am',              key:'Am', bpm:130, difficulty:1, genre:'80s Pop' },
  { id:'80s05', title:'Girls Just Wanna Have Fun',artist:'Cyndi Lauper', chords:'A D E F#m',           key:'A',  bpm:120, difficulty:1, genre:'80s Pop' },
  { id:'80s06', title:'Total Eclipse of the Heart',artist:'Bonnie Tyler',chords:'Bb F Gm Eb Cm',       key:'Bb', bpm:75,  difficulty:2, genre:'80s Pop' },
  { id:'80s07', title:'Every Rose Has Its Thorn',artist:'Poison',        chords:'G C D Am Em',         key:'G',  bpm:72,  difficulty:2, genre:'80s Rock' },
  { id:'80s08', title:'More Than a Feeling',  artist:'Boston',           chords:'D Dsus4 C G Am Em',   key:'D',  bpm:114, difficulty:2, genre:'Classic Rock' },
  { id:'80s09', title:'Eye of the Tiger',     artist:'Survivor',         chords:'Cm Bb Ab Eb G',       key:'Cm', bpm:108, difficulty:2, genre:'80s Rock' },
  { id:'80s10', title:'Jump',                 artist:'Van Halen',        chords:'G C Am D F',          key:'G',  bpm:132, difficulty:2, genre:'80s Rock' },
  { id:'80s11', title:"I Love Rock'n'Roll",   artist:'Joan Jett',        chords:'E A B',               key:'E',  bpm:132, difficulty:1, genre:'80s Rock' },
  { id:'80s12', title:'Pour Some Sugar on Me',artist:'Def Leppard',      chords:'D G A E B C F',       key:'D',  bpm:122, difficulty:2, genre:'80s Rock' },
  { id:'80s13', title:'Here I Go Again',      artist:'Whitesnake',       chords:'G D Am C Em F',       key:'G',  bpm:104, difficulty:1, genre:'80s Rock' },
  { id:'80s14', title:'Don\'t Stop Me Now',   artist:'Queen',            chords:'F Gm Bb C Am Dm',     key:'F',  bpm:156, difficulty:3, genre:'Classic Rock' },
  { id:'80s15', title:'We Will Rock You',     artist:'Queen',            chords:'A C D G',             key:'A',  bpm:80,  difficulty:1, genre:'Classic Rock' },
  { id:'80s16', title:'We Are the Champions', artist:'Queen',            chords:'Cm F Bb Gm Eb Ab',    key:'Cm', bpm:96,  difficulty:2, genre:'Classic Rock' },
  { id:'80s17', title:'Radio Ga Ga',          artist:'Queen',            chords:'C G Am F Dm Em',      key:'C',  bpm:108, difficulty:2, genre:'Classic Rock' },
  { id:'80s18', title:'Under Pressure',       artist:'Queen & Bowie',    chords:'D G A E',             key:'D',  bpm:110, difficulty:2, genre:'Classic Rock' },
  { id:'80s19', title:"Livin' on a Prayer",   artist:'Bon Jovi',         chords:'Em C D G',            key:'Em', bpm:123, difficulty:1, genre:'Pop Rock' },
  { id:'80s20', title:'Africa',               artist:'Toto',             chords:'F#m Bm E A D C#m G',  key:'F#m',bpm:93,  difficulty:3, genre:'80s Pop' },
  { id:'80s21', title:'Rosanna',              artist:'Toto',             chords:'Dm C Bb A F G Em Am', key:'Dm', bpm:114, difficulty:3, genre:'80s Pop' },
  { id:'80s22', title:'How Will I Know',      artist:'Whitney Houston',  chords:'Gm7 C F Eb Am Dm',    key:'F',  bpm:125, difficulty:2, genre:'Pop' },
  { id:'80s23', title:'Like a Prayer',        artist:'Madonna',          chords:'D G Em C A Bm',       key:'D',  bpm:125, difficulty:2, genre:'Pop' },
  { id:'80s24', title:'Material Girl',        artist:'Madonna',          chords:'Am F G C Em Dm',      key:'Am', bpm:128, difficulty:2, genre:'80s Pop' },
  { id:'80s25', title:'Don\'t Stop Believin', artist:'Journey',          chords:'E B C#m A G',         key:'E',  bpm:118, difficulty:1, genre:'Classic Rock' },

  /* ── 90s HITS ────────────────────────────────────────────────── */
  { id:'90s01', title:'Waterfalls',           artist:'TLC',              chords:'Eb Bb Gm Ab Cm F',    key:'Eb', bpm:100, difficulty:2, genre:'90s R&B' },
  { id:'90s02', title:'No Scrubs',            artist:'TLC',              chords:'Bm G D A Em F#m',     key:'Bm', bpm:93,  difficulty:2, genre:'90s R&B' },
  { id:'90s03', title:'Baby One More Time',   artist:'Britney Spears',   chords:'Am E Dm F C G',       key:'Am', bpm:97,  difficulty:2, genre:'Pop' },
  { id:'90s04', title:'Say My Name',          artist:'Destiny\'s Child', chords:'Cm Gm Bb F Ab Eb',    key:'Cm', bpm:95,  difficulty:2, genre:'90s R&B' },
  { id:'90s05', title:'Tears in Heaven',      artist:'Eric Clapton',     chords:'A E F#m C# D G Bm B7',key:'A', bpm:80,  difficulty:3, genre:'Blues Rock' },
  { id:'90s06', title:'All I Want for Christmas',artist:'Mariah Carey',  chords:'G Em Am D Bm C',      key:'G',  bpm:150, difficulty:2, genre:'Pop' },
  { id:'90s07', title:'My Heart Will Go On',  artist:'Celine Dion',      chords:'E B A C#m F#m',       key:'E',  bpm:70,  difficulty:2, genre:'Pop Ballad' },
  { id:'90s08', title:'Wonderwall',           artist:'Oasis',            chords:'Em7 G Dsus4 A7sus4 Cadd9',key:'G',bpm:87,difficulty:2, genre:'Britpop' },
  { id:'90s09', title:'Fade to Black',        artist:'Metallica',        chords:'Am C Em D F',         key:'Am', bpm:112, difficulty:3, genre:'Heavy Metal' },
  { id:'90s10', title:'Enter Sandman',        artist:'Metallica',        chords:'Em G F E Am D',       key:'Em', bpm:123, difficulty:2, genre:'Heavy Metal' },
  { id:'90s11', title:'One',                  artist:'Metallica',        chords:'Bm A D E G',          key:'Bm', bpm:134, difficulty:3, genre:'Heavy Metal' },
  { id:'90s12', title:'Show Must Go On',      artist:'Queen',            chords:'Dm Bb C F Am Gm',     key:'Dm', bpm:68,  difficulty:2, genre:'Classic Rock' },
  { id:'90s13', title:'Runaway Train',        artist:'Soul Asylum',      chords:'C G Am F Em',         key:'C',  bpm:108, difficulty:2, genre:'Alt Rock' },
  { id:'90s14', title:'Ironic',               artist:'Alanis Morissette',chords:'G D Am C Em F',       key:'G',  bpm:95,  difficulty:2, genre:'Alt Rock' },
  { id:'90s15', title:'You Oughta Know',      artist:'Alanis Morissette',chords:'F#m A Bm E',          key:'F#m',bpm:125, difficulty:2, genre:'Alt Rock' },
  { id:'90s16', title:'Torn',                 artist:'Natalie Imbruglia', chords:'F Am G C Dm Em',     key:'F',  bpm:148, difficulty:2, genre:'Pop Rock' },
  { id:'90s17', title:'Zombie',               artist:'The Cranberries',  chords:'Am F C G',            key:'Am', bpm:94,  difficulty:1, genre:'Alt Rock' },
  { id:'90s18', title:'Dreams',               artist:'The Cranberries',  chords:'F C Am G',            key:'F',  bpm:140, difficulty:1, genre:'Alt Rock' },
  { id:'90s19', title:'Semi-Charmed Life',    artist:'Third Eye Blind',  chords:'G D C Am Em',         key:'G',  bpm:136, difficulty:2, genre:'Pop Rock' },
  { id:'90s20', title:'Closing Time',         artist:'Semisonic',        chords:'G D Am C F Em',       key:'G',  bpm:108, difficulty:2, genre:'Alt Rock' },

  /* ── 2000s HITS ─────────────────────────────────────────────── */
  { id:'2k01', title:'Clocks',                artist:'Coldplay',         chords:'Eb Bbm Fm Ab',        key:'Eb', bpm:130, difficulty:2, genre:'Indie Rock' },
  { id:'2k02', title:'Hanging by a Moment',   artist:'Lifehouse',        chords:'D A Bm G Em F#m',     key:'D',  bpm:111, difficulty:2, genre:'Pop Rock' },
  { id:'2k03', title:'Hero',                  artist:'Chad Kroeger',     chords:'Am G F C Em Dm',      key:'Am', bpm:67,  difficulty:2, genre:'Pop Rock' },
  { id:'2k04', title:'How You Remind Me',     artist:'Nickelback',       chords:'F C Bb Gm',           key:'F',  bpm:126, difficulty:2, genre:'Rock' },
  { id:'2k05', title:'Photograph',            artist:'Nickelback',       chords:'E B C#m A',           key:'E',  bpm:68,  difficulty:1, genre:'Rock' },
  { id:'2k06', title:'Somewhere I Belong',    artist:'Linkin Park',      chords:'Am G Em F C',         key:'Am', bpm:88,  difficulty:2, genre:'Nu Metal' },
  { id:'2k07', title:'Boulevard of Broken Dreams',artist:'Green Day',   chords:'Fm Ab Eb Bb',         key:'Fm', bpm:90,  difficulty:2, genre:'Pop Punk' },
  { id:'2k08', title:'The Reason',            artist:'Hoobastank',       chords:'C G Am F Em Dm',      key:'C',  bpm:82,  difficulty:2, genre:'Pop Rock' },
  { id:'2k09', title:'Home',                  artist:'Michael Bublé',    chords:'G D Em C Am',         key:'G',  bpm:80,  difficulty:1, genre:'Pop' },
  { id:'2k10', title:'Accidentally in Love',  artist:'Counting Crows',   chords:'A D E F#m',           key:'A',  bpm:184, difficulty:2, genre:'Pop Rock' },
  { id:'2k11', title:'Somewhere Only We Know',artist:'Keane',            chords:'A E/G# C#m F#m D Bm', key:'A', bpm:84,  difficulty:2, genre:'Indie Pop' },
  { id:'2k12', title:'Tiny Dancer',           artist:'Elton John',       chords:'C F G Am Em Dm Bb',   key:'C',  bpm:126, difficulty:2, genre:'Pop Rock' },
  { id:'2k13', title:'Your Song',             artist:'Elton John',       chords:'Eb Ab Bb Cm Fm Gm',   key:'Eb', bpm:66,  difficulty:2, genre:'Pop Rock' },
  { id:'2k14', title:'Rocket Man',            artist:'Elton John',       chords:'F C Gm Dm Bb Eb Am', key:'F',  bpm:67,  difficulty:2, genre:'Pop Rock' },
  { id:'2k15', title:'Crocodile Rock',        artist:'Elton John',       chords:'G Em C D Am Bm',      key:'G',  bpm:170, difficulty:2, genre:'Pop Rock' },

  /* ── COUNTRY ─────────────────────────────────────────────────── */
  { id:'co01', title:'Ring of Fire',          artist:'Johnny Cash',      chords:'G C D',               key:'G',  bpm:154, difficulty:1, genre:'Country' },
  { id:'co02', title:'Folsom Prison Blues',   artist:'Johnny Cash',      chords:'G C D G7',            key:'G',  bpm:164, difficulty:1, genre:'Country' },
  { id:'co03', title:'I Walk the Line',       artist:'Johnny Cash',      chords:'F C Bb G',            key:'F',  bpm:92,  difficulty:1, genre:'Country' },
  { id:'co04', title:'Jolene',               artist:'Dolly Parton',     chords:'Dm F C Am',           key:'Dm', bpm:168, difficulty:1, genre:'Country' },
  { id:'co05', title:'I Will Always Love You',artist:'Dolly Parton',    chords:'D A G Bm',            key:'D',  bpm:66,  difficulty:1, genre:'Country' },
  { id:'co06', title:'Friends in Low Places', artist:'Garth Brooks',    chords:'A Bm E',              key:'A',  bpm:88,  difficulty:1, genre:'Country' },
  { id:'co07', title:'Boot Scootin\' Boogie', artist:'Brooks & Dunn',   chords:'E A B',               key:'E',  bpm:148, difficulty:1, genre:'Country' },
  { id:'co08', title:'Wagon Wheel',           artist:'Old Crow Med. Show',chords:'G D Em C',          key:'G',  bpm:158, difficulty:1, genre:'Country Folk' },
  { id:'co09', title:'Body Like a Back Road', artist:'Sam Hunt',        chords:'G C Am D Em F',       key:'G',  bpm:104, difficulty:2, genre:'Country Pop' },
  { id:'co10', title:'Tennessee Whiskey',     artist:'Chris Stapleton', chords:'A D E',               key:'A',  bpm:57,  difficulty:1, genre:'Country' },

  /* ── JAZZ STANDARDS ──────────────────────────────────────────── */
  { id:'jz01', title:'Fly Me to the Moon',    artist:'Frank Sinatra',    chords:'Am Dm G7 C E7 F',     key:'C',  bpm:148, difficulty:2, genre:'Jazz' },
  { id:'jz02', title:'Autumn Leaves',         artist:'Jazz Standard',    chords:'Cm7 F7 Bb Eb Am7b5 D7 Gm',key:'Gm',bpm:80,difficulty:3, genre:'Jazz' },
  { id:'jz03', title:'Summertime',            artist:'George Gershwin',  chords:'Am E7 Dm F E Am',     key:'Am', bpm:54,  difficulty:2, genre:'Jazz' },
  { id:'jz04', title:'All of Me',             artist:'John Legend',      chords:'F Am Dm Bb C Gm',     key:'F',  bpm:63,  difficulty:2, genre:'Pop Soul' },
  { id:'jz05', title:'The Way You Look Tonight',artist:'Frank Sinatra',  chords:'F Dm Gm C Bb Am Eb', key:'F',  bpm:100, difficulty:3, genre:'Jazz' },
  { id:'jz06', title:'My Funny Valentine',    artist:'Jazz Standard',    chords:'Cm Cm7 Cm6 Fm Ab G7 Eb',key:'Cm',bpm:60,difficulty:3, genre:'Jazz' },
  { id:'jz07', title:'Georgia on My Mind',    artist:'Ray Charles',      chords:'C E7 Am D7 F Fm Dm G7',key:'C', bpm:55,  difficulty:3, genre:'Jazz Blues' },

  /* ── R&B / SOUL ──────────────────────────────────────────────── */
  { id:'rb01', title:'What\'s Going On',      artist:'Marvin Gaye',      chords:'Emaj7 A7 F#m7 Bm7',  key:'E',  bpm:98,  difficulty:3, genre:'Soul' },
  { id:'rb02', title:'Let\'s Stay Together',  artist:'Al Green',         chords:'Am7 D7 G Em7 C',      key:'G',  bpm:78,  difficulty:2, genre:'Soul' },
  { id:'rb03', title:'Superstition',          artist:'Stevie Wonder',    chords:'Eb7 Ab7 Bb7',         key:'Eb', bpm:100, difficulty:2, genre:'Soul' },
  { id:'rb04', title:'Signed Sealed Delivered',artist:'Stevie Wonder',   chords:'F Bb C Dm Am',        key:'F',  bpm:113, difficulty:2, genre:'Soul' },
  { id:'rb05', title:'I Heard It Through the Grapevine',artist:'Marvin Gaye',chords:'Am G Bm E D',   key:'Am', bpm:110, difficulty:2, genre:'Soul' },
  { id:'rb06', title:'Purple Rain',           artist:'Prince',           chords:'Bb F C Gm',           key:'Bb', bpm:113, difficulty:2, genre:'Pop Rock' },
  { id:'rb07', title:'Kiss',                  artist:'Prince',           chords:'A D G B E',           key:'A',  bpm:121, difficulty:2, genre:'Funk' },
  { id:'rb08', title:'Respect',               artist:'Aretha Franklin',  chords:'C F G Bb',            key:'C',  bpm:114, difficulty:1, genre:'Soul' },
  { id:'rb09', title:'Think',                 artist:'Aretha Franklin',  chords:'C F G Am Dm',         key:'C',  bpm:121, difficulty:1, genre:'Soul' },
  { id:'rb10', title:'Higher Ground',         artist:'Stevie Wonder',    chords:'Eb7 Db7 Ab7 Bb7',     key:'Eb', bpm:90,  difficulty:2, genre:'Soul' },

  /* ── СОВРЕМЕННЫЙ POP (2010-2020е) ──────────────────────────── */
  { id:'mp01', title:'Rolling in the Deep',   artist:'Adele',            chords:'Am G C Dm F',         key:'Am', bpm:105, difficulty:2, genre:'Pop Soul' },
  { id:'mp02', title:'Hello',                 artist:'Adele',            chords:'Am F C G Em',         key:'Am', bpm:79,  difficulty:2, genre:'Pop Soul' },
  { id:'mp03', title:'Someone Like You',      artist:'Adele',            chords:'A E F#m D',           key:'A',  bpm:68,  difficulty:1, genre:'Pop' },
  { id:'mp04', title:'Skyfall',               artist:'Adele',            chords:'Am F Dm E G C',       key:'Am', bpm:79,  difficulty:2, genre:'Pop' },
  { id:'mp05', title:'Love Yourself',         artist:'Justin Bieber',    chords:'E A B F#m',           key:'E',  bpm:98,  difficulty:1, genre:'Pop' },
  { id:'mp06', title:'Sorry',                 artist:'Justin Bieber',    chords:'Em C G D Am',         key:'G',  bpm:100, difficulty:1, genre:'Pop' },
  { id:'mp07', title:'Despacito',             artist:'Luis Fonsi',       chords:'Bm G D A',            key:'Bm', bpm:89,  difficulty:1, genre:'Latin Pop' },
  { id:'mp08', title:'Havana',                artist:'Camila Cabello',   chords:'Am E7 F E',           key:'Am', bpm:105, difficulty:1, genre:'Pop' },
  { id:'mp09', title:'Shallow',               artist:'Lady Gaga',        chords:'Am G D F C Em',       key:'Am', bpm:96,  difficulty:2, genre:'Pop' },
  { id:'mp10', title:'Bad Romance',           artist:'Lady Gaga',        chords:'Am F C G Em',         key:'Am', bpm:119, difficulty:2, genre:'Pop' },
  { id:'mp11', title:'Poker Face',            artist:'Lady Gaga',        chords:'Am F C G',            key:'Am', bpm:120, difficulty:1, genre:'Pop' },
  { id:'mp12', title:'Roar',                  artist:'Katy Perry',       chords:'G C Em D Am F',       key:'G',  bpm:92,  difficulty:1, genre:'Pop' },
  { id:'mp13', title:'Firework',              artist:'Katy Perry',       chords:'Db Ab Bbm Gb',        key:'Db', bpm:124, difficulty:2, genre:'Pop' },
  { id:'mp14', title:'Dark Horse',            artist:'Katy Perry',       chords:'Am F C G Em',         key:'Am', bpm:132, difficulty:2, genre:'Pop' },
  { id:'mp15', title:'Shake It Off',          artist:'Taylor Swift',     chords:'G Am C',              key:'G',  bpm:160, difficulty:1, genre:'Pop' },
  { id:'mp16', title:'Blank Space',           artist:'Taylor Swift',     chords:'G D Em C Am Bm',      key:'G',  bpm:96,  difficulty:2, genre:'Pop' },
  { id:'mp17', title:'Bad Blood',             artist:'Taylor Swift',     chords:'Am F C G Em',         key:'Am', bpm:170, difficulty:1, genre:'Pop' },
  { id:'mp18', title:'Old Town Road',         artist:'Lil Nas X',        chords:'G C D Am Em',         key:'G',  bpm:136, difficulty:1, genre:'Country Trap' },
  { id:'mp19', title:'Sunflower',             artist:'Post Malone',      chords:'Am Dm G C Em F',      key:'Am', bpm:90,  difficulty:2, genre:'Pop Hip-Hop' },
  { id:'mp20', title:'Circles',               artist:'Post Malone',      chords:'Am F C G Em',         key:'Am', bpm:120, difficulty:1, genre:'Pop' },
  { id:'mp21', title:'Rockstar',              artist:'Post Malone',      chords:'Am F C G',            key:'Am', bpm:160, difficulty:1, genre:'Pop Hip-Hop' },
  { id:'mp22', title:'Girls Like You',        artist:'Maroon 5',         chords:'C G Am F',            key:'C',  bpm:124, difficulty:1, genre:'Pop' },
  { id:'mp23', title:'Sugar',                 artist:'Maroon 5',         chords:'D Am Em G Bm',        key:'D',  bpm:123, difficulty:2, genre:'Pop' },
  { id:'mp24', title:'Payphone',              artist:'Maroon 5',         chords:'Ab Eb Fm Db Bb',      key:'Ab', bpm:120, difficulty:2, genre:'Pop' },
  { id:'mp25', title:'Moves Like Jagger',     artist:'Maroon 5',         chords:'Am C G F Dm Em',      key:'Am', bpm:128, difficulty:2, genre:'Pop' },
  { id:'mp26', title:'Uptown Funk',           artist:'Bruno Mars',       chords:'Dm Bb C F Am G',      key:'Dm', bpm:115, difficulty:2, genre:'Funk Pop' },
  { id:'mp27', title:'Locked Out of Heaven',  artist:'Bruno Mars',       chords:'Am C G F Dm Em',      key:'Am', bpm:144, difficulty:2, genre:'Pop' },
  { id:'mp28', title:'Just the Way You Are',  artist:'Bruno Mars',       chords:'F Dm Bb C',           key:'F',  bpm:109, difficulty:1, genre:'Pop' },
  { id:'mp29', title:'Grenade',               artist:'Bruno Mars',       chords:'Am Dm E F C G',       key:'Am', bpm:109, difficulty:2, genre:'Pop' },
  { id:'mp30', title:'When I Was Your Man',   artist:'Bruno Mars',       chords:'C Dm Am F G Em',      key:'C',  bpm:68,  difficulty:2, genre:'Pop' },
  { id:'mp31', title:'Photograph',            artist:'Ed Sheeran',       chords:'E C#m B A F#m',       key:'E',  bpm:108, difficulty:2, genre:'Pop' },
  { id:'mp32', title:'Thinking Out Loud',     artist:'Ed Sheeran',       chords:'D A Bm G',            key:'D',  bpm:79,  difficulty:1, genre:'Pop' },
  { id:'mp33', title:'Castle on the Hill',    artist:'Ed Sheeran',       chords:'D A Bm G F#m Em',     key:'D',  bpm:135, difficulty:2, genre:'Pop' },
  { id:'mp34', title:'Galway Girl',           artist:'Ed Sheeran',       chords:'G D Em C Am Bm',      key:'G',  bpm:99,  difficulty:2, genre:'Folk Pop' },
  { id:'mp35', title:'The A Team',            artist:'Ed Sheeran',       chords:'A E D F#m C#m Bm',    key:'A',  bpm:86,  difficulty:2, genre:'Folk Pop' },
  { id:'mp36', title:'Latch',                 artist:'Disclosure',       chords:'Am F C G Em',         key:'Am', bpm:122, difficulty:2, genre:'Dance Pop' },
  { id:'mp37', title:'Rather Be',             artist:'Clean Bandit',     chords:'Am F C G Dm Em',      key:'Am', bpm:119, difficulty:2, genre:'Dance Pop' },
  { id:'mp38', title:'Writing\'s on the Wall',artist:'Sam Smith',        chords:'Am G F C Dm Em',      key:'Am', bpm:66,  difficulty:2, genre:'Pop Soul' },
  { id:'mp39', title:'Too Good at Goodbyes',  artist:'Sam Smith',        chords:'Am G F C Em Dm',      key:'Am', bpm:89,  difficulty:2, genre:'Pop Soul' },
  { id:'mp40', title:'Stitches',              artist:'Shawn Mendes',     chords:'F Am Gm Bb C Dm',     key:'F',  bpm:149, difficulty:2, genre:'Pop' },

  /* ── РУССКИЕ ХИТЫ 2000-2020х ────────────────────────────────── */
  { id:'rh01', title:'Что тебе снится',       artist:'Юлия Савичева',    chords:'Am F C G',             key:'Am', bpm:92,  difficulty:1, genre:'Русский поп' },
  { id:'rh02', title:'На берегу неба',        artist:'Звери',            chords:'Am G F E Dm C',        key:'Am', bpm:118, difficulty:2, genre:'Русский рок' },
  { id:'rh03', title:'Доброе утро',           artist:'5aSта',            chords:'Am G C F Dm Em E',     key:'Am', bpm:96,  difficulty:2, genre:'Русский рок' },
  { id:'rh04', title:'Ребята с нашего двора', artist:'Кино',             chords:'Am G F E',             key:'Am', bpm:115, difficulty:1, genre:'Русский рок' },
  { id:'rh05', title:'Верить',                artist:'Каста',            chords:'Am G F E Dm C',        key:'Am', bpm:100, difficulty:2, genre:'Хип-хоп' },
  { id:'rh06', title:'Мы не ангелы, парень',  artist:'Руки вверх',       chords:'Am G F E',             key:'Am', bpm:108, difficulty:1, genre:'Русский поп' },
  { id:'rh07', title:'Студент',               artist:'Руки вверх',       chords:'Am Dm G C F E',        key:'Am', bpm:116, difficulty:1, genre:'Русский поп' },
  { id:'rh08', title:'Позвони мне позвони',   artist:'Анна Герман',      chords:'G D Em C Am Bm',       key:'G',  bpm:84,  difficulty:2, genre:'Советская' },
  { id:'rh09', title:'А я в России',          artist:'Тимур Муцураев',   chords:'Am Dm E Am G F',       key:'Am', bpm:88,  difficulty:2, genre:'Шансон' },
  { id:'rh10', title:'Белая берёза',          artist:'Народная',         chords:'G C D Em Am',          key:'G',  bpm:90,  difficulty:1, genre:'Народная' },
  { id:'rh11', title:'Выйду ночью в поле с конём',artist:'Наутилус',     chords:'Am G F E Dm C',        key:'Am', bpm:95,  difficulty:2, genre:'Русский рок' },
  { id:'rh12', title:'Синяя птица',           artist:'Машина времени',   chords:'Am Dm G C F E',        key:'Am', bpm:98,  difficulty:2, genre:'Русский рок' },
  { id:'rh13', title:'Поворот',               artist:'Машина времени',   chords:'G D Em C Am Bm',       key:'G',  bpm:126, difficulty:2, genre:'Русский рок' },
  { id:'rh14', title:'Пока горит свеча',      artist:'Машина времени',   chords:'Am G C F Dm E',        key:'Am', bpm:84,  difficulty:2, genre:'Русский рок' },
  { id:'rh15', title:'За тех, кто в море',    artist:'Машина времени',   chords:'G D C Am Em Bm',       key:'G',  bpm:100, difficulty:2, genre:'Русский рок' },
  { id:'rh16', title:'Скованные одной цепью', artist:'Наутилус',         chords:'Dm C Bb Am Gm F',       key:'Dm', bpm:98,  difficulty:2, genre:'Русский рок' },
  { id:'rh17', title:'Прогулки по воде',      artist:'Наутилус',         chords:'Am G F E Dm C G Am',   key:'Am', bpm:90,  difficulty:2, genre:'Русский рок' },
  { id:'rh18', title:'Я хочу быть с тобой',   artist:'Наутилус',         chords:'Dm Am C G F E',        key:'Dm', bpm:112, difficulty:2, genre:'Русский рок' },
  { id:'rh19', title:'Твои глаза',            artist:'Лёд 9',            chords:'Am G F E Dm C',        key:'Am', bpm:92,  difficulty:2, genre:'Русский рок' },
  { id:'rh20', title:'Чёрный кот',            artist:'ДДТ',              chords:'Am G F E C',           key:'Am', bpm:108, difficulty:1, genre:'Русский рок' },
  { id:'rh21', title:'Белая ночь',            artist:'Аквариум',         chords:'G D Am Em C F',        key:'G',  bpm:88,  difficulty:2, genre:'Русский рок' },
  { id:'rh22', title:'Поезд в огне',          artist:'Аквариум',         chords:'Am G C F E Dm',        key:'Am', bpm:130, difficulty:2, genre:'Русский рок' },
  { id:'rh23', title:'Город золотой',         artist:'Аквариум',         chords:'G D Am Em C F Bm',     key:'G',  bpm:72,  difficulty:2, genre:'Русский рок' },
  { id:'rh24', title:'Мне очень жаль',        artist:'Алиса',            chords:'Am G F E',             key:'Am', bpm:132, difficulty:1, genre:'Русский рок' },
  { id:'rh25', title:'Небо славян',           artist:'Алиса',            chords:'Am G C F Em Dm E',     key:'Am', bpm:124, difficulty:2, genre:'Русский рок' },
  { id:'rh26', title:'Нет воли',              artist:'Ария',             chords:'Am G F E C Dm',        key:'Am', bpm:120, difficulty:2, genre:'Метал' },
  { id:'rh27', title:'Игра с огнём',          artist:'Ария',             chords:'Dm Am C G Bb F',       key:'Dm', bpm:115, difficulty:2, genre:'Метал' },
  { id:'rh28', title:'Улица роз',             artist:'Ария',             chords:'Am Dm E G C F',        key:'Am', bpm:82,  difficulty:2, genre:'Метал' },
  { id:'rh29', title:'Потерянный рай',        artist:'Ария',             chords:'Am G F E Dm Am',       key:'Am', bpm:94,  difficulty:2, genre:'Метал' },
  { id:'rh30', title:'Последний закат',       artist:'Кипелов',          chords:'Am G F E Dm C',        key:'Am', bpm:88,  difficulty:2, genre:'Метал' },

  /* ── ЛИРИКА / РОМАНСЫ ───────────────────────────────────────── */
  { id:'lyr01', title:'Белой акации гроздья душистые',artist:'Народная', chords:'C G Am F Dm E',        key:'C',  bpm:72,  difficulty:2, genre:'Романс' },
  { id:'lyr02', title:'Утро туманное',        artist:'Романс',           chords:'C Am F G Dm Em',       key:'C',  bpm:68,  difficulty:2, genre:'Романс' },
  { id:'lyr03', title:'Что так грустно',      artist:'Вертинский',       chords:'Am Dm E Am G C F',     key:'Am', bpm:72,  difficulty:2, genre:'Романс' },
  { id:'lyr04', title:'Я тебя никогда не забуду',artist:'Рыбников/Градский',chords:'Am G F E C Dm',    key:'Am', bpm:76,  difficulty:2, genre:'Романс' },
  { id:'lyr05', title:'Два кольца',           artist:'Шансон',           chords:'Am Dm E Am G',         key:'Am', bpm:88,  difficulty:1, genre:'Шансон' },
  { id:'lyr06', title:'Купола',               artist:'Высоцкий',         chords:'C G Am F Dm E',        key:'C',  bpm:80,  difficulty:2, genre:'Авторская' },
  { id:'lyr07', title:'Кони привередливые',   artist:'Высоцкий',         chords:'Am Dm E G C F',        key:'Am', bpm:144, difficulty:2, genre:'Авторская' },
  { id:'lyr08', title:'Ой, мороз мороз',      artist:'Народная',         chords:'G D Em C Am',          key:'G',  bpm:92,  difficulty:1, genre:'Народная' },
  { id:'lyr09', title:'Течёт река Волга',      artist:'Людмила Зыкина',  chords:'C G F Am Dm G7 E',     key:'C',  bpm:66,  difficulty:2, genre:'Советская' },
  { id:'lyr10', title:'На солнечной поляночке',artist:'Народная',        chords:'G D C Am Em',          key:'G',  bpm:112, difficulty:1, genre:'Народная' },

  /* ── ДЕТСКИЕ / НОВОГОДНИЕ ───────────────────────────────────── */
  { id:'ny01', title:'Jingle Bells',          artist:'Традиционная',     chords:'G C D A Em Am',        key:'G',  bpm:120, difficulty:1, genre:'Рождественская' },
  { id:'ny02', title:'Last Christmas',        artist:'Wham!',            chords:'G Em Am D C Bm',       key:'G',  bpm:110, difficulty:2, genre:'Рождественская' },
  { id:'ny03', title:'White Christmas',       artist:'Bing Crosby',      chords:'G Gmaj7 C D Em Am',    key:'G',  bpm:82,  difficulty:2, genre:'Рождественская' },
  { id:'ny04', title:'В лесу родилась ёлочка',artist:'Народная',         chords:'C G F Am Dm',          key:'C',  bpm:104, difficulty:1, genre:'Детская' },
  { id:'ny05', title:'Маленькой ёлочке',       artist:'Народная',        chords:'G D C Am Em',          key:'G',  bpm:98,  difficulty:1, genre:'Детская' },
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
