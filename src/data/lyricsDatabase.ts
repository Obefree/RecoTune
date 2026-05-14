/**
 * Annotated lyrics database — [Chord]word format (ChordPro compatible).
 * Keyed by song ID from songDatabase.ts.
 * Merged at runtime in ChordsScreen: this dictionary wins over inline song.lyrics.
 */

export const LYRICS_DB: Record<string, string> = {

  /* ── BEATLES ─────────────────────────────────────────────────────── */
  's001': `[C]When I find myself in [G]times of trouble
[Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]

[C]And in my hour of [G]darkness
[Am]She is standing [F]right in front of me
[C]Speaking words of [G]wisdom, let it [F]be [C]

[Am]Let it be, [G]let it be
[Am]Let it be, [G]let it be
[C]Whisper words of [G]wisdom
Let it [F]be [C]

[C]And when the broken-hearted people
[G]Living in the world a[Am]gree
[F]There will be an [C]answer, let it [G]be [C]
[F]For though they may be parted [C]there is
[G]Still a chance that they will [Am]see
[F]There will be an [C]answer, let it [G]be [C]

[Am]Let it be, [G]let it be
[Am]Let it be, [G]let it be
[C]There will be an [G]answer
Let it [F]be [C]

[Am]Let it be, [G]let it be
[Am]Let it be, [G]let it be
[C]Whisper words of [G]wisdom
Let it [F]be [C]

[C]And when the night is cloudy [G]
[Am]There is still a light that [F]shines on me
[C]Shine until tomor[G]row, let it [F]be [C]

[C]I wake up to the [G]sound of music
[Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]

[Am]Let it be, [G]let it be
[Am]Let it be, [G]let it be
[C]There will be an [G]answer
Let it [F]be [C]

[Am]Let it be, [G]let it be
[Am]Let it be, [G]let it be
[C]Whisper words of [G]wisdom
Let it [F]be [C]`,

  'sb01': `[G]Yesterday [F#m]all my [B7]troubles seemed so [Em]far away
[C]Now it [D]looks as though they're [G]here to stay
[Em]Oh [A]I believe in [C]yesterday [G]

[G]Suddenly [F#m]I'm not [B7]half the man I [Em]used to be
[C]There's a [D]shadow hanging [G]over me
[Em]Oh [A]yesterday came [C]suddenly [G]

[Em]Why she had to [A]go I don't [C]know, she wouldn't [G]say
[Em]I said [A]something [D7]wrong now I [F]long for [G]yesterday

[G]Yesterday [F#m]love was [B7]such an easy [Em]game to play
[C]Now I [D]need a place to [G]hide away
[Em]Oh [A]I believe in [C]yesterday [G]`,

  'sb02': `[A]Hey Jude [E]don't make it [A]bad
Take a [D]sad song and make it [A]better
Re[A]member to let her into your [E]heart
Then you can [E7]start to make it [A]better

[A]Hey Jude [E]don't be a[A]fraid
You were [D]made to go out and [A]get her
The [A]minute you let her under your [E]skin
Then you be[E7]gin to make it [A]better

[A]And anytime you feel the [E]pain
Hey [A]Jude refrain
Don't [D]carry the world upon your [A]shoulders
For well you know that it's a [E]fool
Who [A]plays it cool
By [D]making his world a little [E7]colder [A]

[A]Hey Jude [E]don't let me [A]down
You have [D]found her now go and [A]get her
Re[A]member to let her into your [E]heart
Then you can [E7]start to make it [A]better

[A]So let it [E]out and let it [A]in
Hey [D]Jude begin [A]
You're waiting for someone to perform with
And don't you know that it's just [E]you
Hey [A]Jude you'll do
The [D]movement you need is on your [E7]shoulder [A]

[A]Hey Jude [E]don't make it [A]bad
Take a [D]sad song and make it [A]better
Re[A]member to let her into your [E]heart
Then you can [E7]start to make it [A]better better better better

[F]Na na na [C]na na-na-na
[G]Na na-na-na [A]Hey Jude
[F]Na na na [C]na na-na-na
[G]Na na-na-na [A]Hey Jude`,

  'sb03': `[Am]Here comes the [F]sun, doo-doo-doo-doo
[C]Here comes the [G]sun
And I say [Am]it's all [F]right [C]

[Am]Little darling [F]it's been a long cold lonely [C]winter [G]
[Am]Little darling [F]it feels like years since it's been [C]here [G]

[Am]Here comes the [F]sun, doo-doo-doo-doo
[C]Here comes the [G]sun
And I say [Am]it's all [F]right [C]`,

  'sb04': `[C]Let me take you [F]down
'Cause I'm going to [C]Strawberry Fields
[F]Nothing is real
And [C]nothing to get hung [F]about
[G]Strawberry Fields for[C]ever

[C]Living is easy with [G]eyes closed
[F]Misunderstanding all you [Dm]see
[C]It's getting hard to [G]be someone but it [Bb]all works [C]out
It doesn't [F]matter much to [G]me`,

  /* ── ROLLING STONES ─────────────────────────────────────────────── */
  'sr01': `[E]I can't get no [A]satisfaction
[E]I can't get no [B7]satisfaction
'Cause I [E]try and I try and I try try try
[A]I can't get no, [B7]I can't get no

When I'm [E]ridin' round the world
And I'm [A]doin' this and I'm signing that
And I'm [B7]tryin' to make some girl
Who tells me [E]baby better come back later next week
[A]'Cause you see I'm on a [B7]losing streak

[E]I can't get no [A]satisfaction
[E]I can't get no [B7]girl reaction`,

  'sr02': `[Am]I see a [F]red door and I [C]want it painted [G]black
[Am]No colors [F]anymore I [C]want them to turn [G]black
[Am]I see the [F]girls walk by dressed in their [G]summer clothes
[Am]I have to [F]turn my head until my [G]darkness goes

[Am]I wanna see it [F]painted, painted [C]black
[Am]Black as night, [F]black as coal
[Am]I wanna see the [F]sun blotted out from the [G]sky
[Am]I wanna see it [F]painted, painted, [G]painted, painted [Am]black`,

  'sr03': `[G]Wild horses [D]couldn't drag me a[Am]way
[G]Wild, wild [D]horses, couldn't drag me a[C]way [G]

[G]Childhood living [D]is easy to do
The [Am]things you wanted
I [G]bought them for [D]you
[C]Graceless lady [G]you know who I am
[C]You know I can't let you [D]slide through my [G]hands`,

  /* ── LED ZEPPELIN ───────────────────────────────────────────────── */
  'sl01': `[Am]There's a [C]lady who's [G]sure all that [F]glitters is [Am]gold
And she's [C]buying a [G]stairway to [Am]heaven
When she [C]gets there she [G]knows if the [F]stores are all [Am]closed
With a [C]word she can [G]get what she [Am]came for
[F]Oo-oh-oh and she's [G]buying a [Am]stairway to [C]heaven [D]

[Am]There's a [C]sign on the [G]wall but she [F]wants to be [Am]sure
'Cause you [C]know sometimes [G]words have two [Am]meanings`,

  'sl02': `[Dm]Ramble on [C]and now's the time the time is now
To [Bb]sing my song I'm goin' 'round the [C]world I got to find my girl
[Dm]On my way I've been this way before
[C]Every day I've been this [Bb]way before and I've been [C]searchin' more

[Dm]Mine mine mine mine mine [C]it was Gollum and the Evil One
He [Bb]stole the [C]precious from me
[Dm]In the darkest depths of Mordor I met a girl so fair
[C]But Gollum, and the Evil One, crept up and [Bb]slipped away with [C]her`,

  /* ── DEEP PURPLE / CLASSIC HARD ROCK ─────────────────────────────── */
  'sd01': `[A]Never before [G]has my heart felt so light
[D]Never before [A]has the future seemed bright
[A]With you at my [G]side I can face anything
[D]Tell me you [A]love me again

[A]Smoke on the water [G] fire in the sky
[D]Smoke on the water [A]`,

  'sd02': `[Em]Ritchie Blackmore's [D]Rainbow
[C]I'm going to Rock 'n' [Em]Roll you
[D]I'm going to move through the [C]night
And [Em]my blood is hot [D]and running
[C]I need to Rock and [Em]Roll tonight`,

  /* ── QUEEN ──────────────────────────────────────────────────────── */
  'sq01': `[G]Is this the real [Bm]life?
Is this just [F]fantasy?
[Cm]Caught in a [G]landslide
No escape from [Bb]reality
[Eb]Open your eyes
[Bb]Look up to the [F]skies and [G]see

[Cm]I'm just a poor boy [G]I need no sympathy
Because it's [Eb]easy come, [Bb]easy go
[F]Little high, [F/E]little [Fm]low
[Eb]Anyway the wind [Bb]blows doesn't really [Gm]matter to me
To [G7]me

[Cm]Mama [G]just killed a man
[Cm]Put a gun against his head [G]pulled my trigger
[Ab]Now he's [Bb]dead
[Cm]Mama [G]life had just begun
[Cm]But now I've gone and [G]thrown it all a[Ab]way

[Eb]Mama [Fm]ooh [Bb]didn't mean to make you cry
[Eb]If I'm not back again this time to[Bb]morrow
[Cm]Carry on carry [G7]on as if nothing really [Cm]matters

[Cm]Too late [G]my time has come
[Cm]Sends shivers down my spine [G]body's aching all the time
[Ab]Good[Bb]bye everybody [Cm]I've got to go
[G]Gotta leave you all behind [Ab]and face the truth

[Eb]Mama [Fm]ooh [Bb]I don't want to die
[Eb]I sometimes wish I'd never been [Bb]born at all

[Bb]I see a little silhouetto of a man
[Bb]Scaramouche Scaramouche will you do the Fandango?
[Eb]Thunderbolt and lightning very very frightening [Bb]me
[Cm]Galileo [G]Galileo [Cm]Galileo figaro [G]Magnifico-o-o-o-o

[Eb]Nothing [Bb]really matters [Cm]
[Am]Anyone can [F]see [Bb]
Nothing really matters
[Eb]Nothing really matters to [Bb]me

[Eb]Anyway the wind [Bb]blows`,

  'sq02': `[D]Buddy you're a boy [G]make a big noise
[D]Playing in the street gonna be a [A]big man some day
[D]You got mud on your face [G]you big disgrace
[D]Kicking your can all over the [A]place
[D]Singing [G]we will we will [D]rock you
[G]We will we will [D]rock you`,

  'sq03': `[F]We are the [Bb]champions my friends
[C]And we'll keep on [F]fighting till the end
[F]We are the [Bb]champions
[F]We are the [Bb]champions
[C]No time for [Am]losers
'Cause [Dm]we are the [G]champions
Of the [C]world`,

  /* ── EAGLES ─────────────────────────────────────────────────────── */
  'se01': `[Bm]On a dark desert [F#]highway
[A]Cool wind in my [E]hair
[G]Warm smell of colitas [D]rising up through the air
[Em]Up ahead in the [F#]distance
[Bm]I saw a shimmering [F#]light
[A]My head grew heavy and my [E]sight grew dim
[G]I had to stop for the [D]night

[Em]There she stood in the [F#]doorway
[Bm]I heard the mission [F#]bell
[A]And I was thinking to my[E]self
[G]This could be heaven or this could be [D]hell
[Em]Then she lit up a [F#]candle
[Bm]And she showed me the [F#]way
[A]There were voices down the [E]corridor
[G]I thought I heard them [D]say

[Em]Welcome to the Hotel Cali[F#]fornia
[Bm]Such a lovely [F#]place such a lovely [A]face
[E]Plenty of room at the Hotel Cali[G]fornia
[D]Any time of year [Em]you can find it [F#]here

[Bm]Her mind is Tiffany-[F#]twisted
[A]She got the Mercedes [E]bends
[G]She got a lot of pretty pretty boys [D]that she calls friends
[Em]How they dance in the [F#]courtyard
[Bm]Sweet summer [F#]sweat
[A]Some dance to re[E]member
[G]Some dance to for[D]get

[Em]So I called up the [F#]Captain
[Bm]Please bring me my [F#]wine
[A]He said: We haven't had that [E]spirit here
[G]Since nineteen sixty [D]nine
[Em]And still those voices are [F#]calling
[Bm]From far a[F#]way
[A]Wake you up in the middle of the [E]night
[G]Just to hear them [D]say

[Em]Welcome to the Hotel Cali[F#]fornia
[Bm]Such a lovely [F#]place such a lovely [A]face
[E]They're livin' it up at the Hotel Cali[G]fornia
[D]What a nice surprise [Em]bring your ali[F#]bis

[Bm]Mirrors on the [F#]ceiling
[A]The pink cham[E]pagne on ice
[G]And she said: We are all just [D]prisoners here
[Em]Of our own de[F#]vice
[Bm]And in the master's [F#]chambers
[A]They gathered for the [E]feast
[G]They stab it with their steely knives [D]
[Em]But they just can't kill the [F#]beast

[Bm]Last thing I re[F#]member I was
[A]Running for the [E]door
[G]I had to find the passage back
[D]To the place I was before
[Em]Relax said the night man [F#]
[Bm]We are programmed to re[F#]ceive
[A]You can check out any [E]time you like
[G]But you can never [D]leave`,

  /* ── PINK FLOYD ─────────────────────────────────────────────────── */
  'spf01': `[Em]So, so you think you can [A]tell
[G]Heaven from hell
[D]Blue skies from pain
[C]Can you tell a green field [G]from a cold steel rail?
[D]A smile from a veil?
[Em]Do you think you can tell?

[Em]Did they get you to [A]trade
[G]Your heroes for ghosts?
[D]Hot ashes for trees?
[C]Hot air for a cool [G]breeze?
[D]Cold comfort for change?
[Em]And did you exchange
A walk-on part in the war
For a [Am]lead role in a [Em]cage?

[Em]How I wish, how I wish you were [A]here
[G]We're just two lost souls
[D]Swimming in a fish bowl
[C]Year after year
[G]Running over the same old ground
[D]What have we found?
The [C]same old fears
[G]Wish you were [Em]here`,

  'spf02': `[Bm]Hello [A]hello [G]hello [A]is there anybody in there?
[Bm]Just nod if you can [A]hear me
[G]Is there anyone [A]home?

[Bm]Come on now
[A]I hear you're feeling down
[G]Well I can ease your pain
[A]Get you on your feet again

[Bm]Relax, I'll need some information first
[A]Just the basic facts
[G]Can you show me where it hurts?

[Bm]There is no pain you are [A]receding
[G]A distant ship [D]smoke on the horizon
[Bm]You are only coming through [A]in waves
[G]Your lips move but I can't hear what you're [A]saying

[G]When I was a child I had a fever
[D]My hands felt just like two balloons
[G]Now I've got that feeling once again
[D]I can't explain you would not understand
[G]This is not how I am
[Bm]I have become comfortably [G]numb [D]

[Bm]Okay [A] [G]just a little pin[A]prick
[Bm]There'll be no more [A]aaaaaah
[G]But you may feel a little sick [A]

[Bm]Can you stand up? [A]I do believe it's working [G]good
[A]That'll keep you going through the show
[Bm]Come on it's time to [A]go

[G]When I was a child I caught a fleeting glimpse
[D]Out of the corner of my eye
[G]I turned to look but it was gone
[D]I cannot put my finger on it now
[G]The child is grown the dream is gone
[Bm]And I have become comfortably [G]numb [D]`,

  /* ── NIRVANA ─────────────────────────────────────────────────────── */
  'sn01': `[F#5]Load up on guns [A5]bring your friends
[C5]It's fun to lose [D5]and to pretend
[F#5]She's over-bored [A5]and self assured
[C5]Oh no I know [D5]a dirty word

[F#5]Hello hello [A5]hello how low
[F#5]Hello hello [A5]hello how low
[F#5]Hello hello [A5]hello how low
[F#5]Hello hello

[F#5]With the lights out [A5]it's less dangerous
[C5]Here we are now [D5]entertain us
[F#5]I feel stupid [A5]and contagious
[C5]Here we are now [D5]entertain us
A [F#5]mulatto, an [A5]albino, a [C5]mosquito, my li[D5]bido
[F#5]Yeah [A5] [C5]A de[D5]ni-al

[F#5]I'm worse at what I [A5]do best
[C5]And for this gift I [D5]feel blessed
[F#5]Our little tribe has [A5]always been
[C5]And always will until the [D5]end

[F#5]Hello hello [A5]hello how low
[F#5]Hello hello [A5]hello how low
[F#5]Hello hello [A5]hello how low
[F#5]Hello hello

[F#5]With the lights out [A5]it's less dangerous
[C5]Here we are now [D5]entertain us
[F#5]I feel stupid [A5]and contagious
[C5]Here we are now [D5]entertain us
A [F#5]mulatto, an [A5]albino, a [C5]mosquito, my li[D5]bido
[F#5]Yeah [A5] [C5]A de[D5]ni-al

[F#5]And I forget just why I [A5]taste
[C5]Oh yeah I guess it makes me [D5]smile
[F#5]I found it hard, it's [A5]hard to find
[C5]Oh well whatever [D5]nevermind

[F#5]Hello hello [A5]hello how low
[F#5]Hello hello [A5]hello how low
[F#5]Hello hello [A5]hello how low
[F#5]Hello hello

[F#5]With the lights out [A5]it's less dangerous
[C5]Here we are now [D5]entertain us
[F#5]I feel stupid [A5]and contagious
[C5]Here we are now [D5]entertain us
A [F#5]mulatto, an [A5]albino, a [C5]mosquito, my li[D5]bido
[F#5]Yeah [D5]A denial [F#5]A denial [D5]A denial [F#5]A denial`,

  'sn02': `[Em]Come as you are [D]as you were
[C]As I want you to be [Em]
[Em]As a friend [D]as a friend
[C]As an old enemy [Em]

[Em]Take your time [D]hurry up
[C]The choice is yours, don't be [Em]late
[Em]Take a rest [D]as a friend
[C]As an old melo[Em]dy

[Em]Memory, ah [D]memory
[C]Memory, ah [Em]
[Em]Come dowsed in mud [D]soaked in bleach
[C]As I want you to be [Em]
And I [Em]swear that I [D]don't have a [C]gun [Em]
No I [Em]swear that I [D]don't have a [C]gun [Em]`,

  /* ── U2 ──────────────────────────────────────────────────────────── */
  'su01': `[C]One [Am]love, one [F]blood
[C]One life you got to do [Am]what you should
[F]One life with each other [C]sisters [Am]brothers
[F]One life but we're not the same [C]
We get to carry [Am]each other carry each [F]other

[C]One [Am]
[F]One [C]
[Am]One [F]
[C]One [Am]
[F]One [C]
[Am]One [F]
[C]One [Am]
[F]One`,

  /* ── OASIS ──────────────────────────────────────────────────────── */
  'so01': `[Em7]Today is gonna be the day
That they're gonna [G]throw it back to you
[Dsus4]By now you should've somehow
Realised what you gotta [A7sus4]do
[Em7]I don't believe that anybody
Feels the way I [G]do about you now

[Cadd9]Backbeat the word was on the street
That the [G]fire in your heart is out
[Dsus4]I'm sure you've heard it all before
But you never really had a [Em7]doubt
[Cadd9]I don't believe that anybody
Feels the way I [G]do about you [Dsus4]now

And all the [Cadd9]roads we have to walk [G]are winding
And all the [Cadd9]lights that lead us there are [Dsus4]blinding
There are [Cadd9]many things that I would [Em7]like to say to you
But I don't know [G]how

Because [Cadd9]maybe [G]
You're gonna be the one that [Dsus4]saves me [Em7]
And after [Cadd9]all [G]
You're my Wonder[Dsus4]wall [Em7]

[Em7]Today was gonna be the day
But they'll never [G]throw it back to you
[Dsus4]By now you should've somehow
Realised what you're not to [A7sus4]do
[Em7]I don't believe that anybody
Feels the way I [G]do about you now

And all the [Cadd9]roads that lead you there were [G]winding
And all the [Cadd9]lights that light the way are [Dsus4]blinding
There are [Cadd9]many things that I would [Em7]like to say to you
But I don't know [G]how

I said [Cadd9]maybe [G]
You're gonna be the one that [Dsus4]saves me [Em7]
And after [Cadd9]all [G]
You're my Wonder[Dsus4]wall [Em7]

I said [Cadd9]maybe [G]
You're gonna be the one that [Dsus4]saves me [Em7]
And after [Cadd9]all [G]
You're my Wonder[Dsus4]wall [Em7]`,

  /* ── ERIC CLAPTON ───────────────────────────────────────────────── */
  'sec01': `[A]Would you know my name
[E]If I saw you in [F#m]heaven?
[D]Would it be the [A]same [E]
If I saw you in [F#m]heaven?

[A]I must be strong [E]and carry on
[F#m]'Cause I know [C#]I don't belong
[D]Here in [E]heaven [A]

[A]Would you hold my hand
[E]If I saw you in [F#m]heaven?
[D]Would you help me [A]stand [E]
If I saw you in [F#m]heaven?

[A]I'll find my way [E]through night and day
[F#m]'Cause I know [C#]I just can't stay
[D]Here in [E]heaven [A]

[C]Time can bring you down [G]time can bend your knees
[D/F#]Time can break your heart [Em]have you begging please
[F]Begging please [C] [G] [D]

[A]Beyond the door [E]there's peace I'm sure
[F#m]And I know [C#]there'll be no more
[D]Tears in [E]heaven [A]

[A]Would you know my name
[E]If I saw you in [F#m]heaven?
[D]Would it be the [A]same [E]
If I saw you in [F#m]heaven?

[A]I must be strong [E]and carry on
[F#m]'Cause I know [C#]I don't belong
[D]Here in [E]heaven [A]`,

  /* ── METALLICA ──────────────────────────────────────────────────── */
  'smt01': `[Em]Close my eyes [D]only for a moment
[Em]And the moment's [D]gone
[Em]All my dreams [D]pass before my eyes
[Em]A curiosity [D]

[Em]Dust in the wind [G]
[Am]All they are is [D]dust in the wind

[Em]Same old song [D]just a drop of water
[Em]In an endless [D]sea
[Em]All we do [D]crumbles to the ground
[Em]Though we refuse to [D]see

[Em]Dust in the wind [G]
[Am]All we are is [D]dust in the wind`,

  'smt02': `[Em]So close [C]no matter how [G]far
[D]Couldn't be much [Em]more from the heart
[Em]Forever trust [C]in who we are
[G]And nothing else [D]matters

[Em]Never opened myself [C]this way
[G]Life is ours we live it [D]our way
[Em]All these words I don't just [C]say
[G]And nothing else [D]matters

[Em]Trust I seek and I find in [C]you
[G]Every day for us something [D]new
[Em]Open mind for a different [C]view
[G]And nothing else [D]matters

[Em]Never cared [C]for what they do
[Em]Never cared [C]for what they know
[G]But I know [D]

[Em]So close [C]no matter how [G]far
[D]Couldn't be much [Em]more from the heart
[Em]Forever trust [C]in who we are
[G]And nothing else [D]matters

[Em]Never cared [C]for what they say
[Em]Never cared [C]for games they play
[Em]Never cared [C]for what they do
[Em]Never cared [C]for what they know
[G]And I know [D]

[Em]So close [C]no matter how [G]far
[D]Couldn't be much [Em]more from the heart
[Em]Forever trust [C]in who we are
[G]And nothing else [D]matters`,

  /* ── GREEN DAY ──────────────────────────────────────────────────── */
  'sgd01': `[G]Do you have the time
[D]To listen to me whine
[Em]About nothing and everything [C]all at once?
[G]I am one of those [D]melodramatic fools
[Em]Neurotic to the bone [C]no doubt about it

[G]Sometimes I give my[D]self the creeps
[Em]Sometimes my mind [C]plays tricks on me
[G]It all keeps adding [D]up
[Em]I think I'm cracking [C]up
Am I just [G]paranoid? [D]
Or am I [Em]just stoned? [C]

[G]I walk alone [D]
[Em]I walk alone [C]
[G]I walk alone [D]
[Em]I walk... my shadow's the only one that walks beside me [C]
[G]My shallow heart's the only thing that's beating [D]
[Em]Sometimes I wish someone out there will find me [C]
[G]Till then I walk alone [D]`,

  /* ── RED HOT CHILI PEPPERS ──────────────────────────────────────── */
  'srh01': `[Am]Sometimes I feel [Fmaj7]like I don't have a partner
[Am]Sometimes I feel [Fmaj7]like my only friend
[Am]Is the city I live [Fmaj7]in the city of angels
[Am]Lonely as I [Fmaj7]am, together we cry

[Am]I drive on her streets [Fmaj7]'cause she's my companion
[Am]I walk through her hills [Fmaj7]'cause she knows who I am
[Am]She sees my good deeds [Fmaj7]and she kisses me windy
[Am]I never worry, now [Fmaj7]that is a lie

[Am]I don't ever want to feel [C]
Like I did that [G]day [Fmaj7]
Take me to the place [Am]I love [C]
Take me all the [G]way [Fmaj7]
[Am]I don't ever want to feel [C]
Like I did that [G]day [Fmaj7]
Take me to the place [Am]I love [C]
Take me all the [G]way [Fmaj7]`,

  /* ── RADIOHEAD ──────────────────────────────────────────────────── */
  'srad01': `[Dm]When you were here before [Bb]
[F]Couldn't look you in the [C]eye
[Dm]You're just like an angel [Bb]
[F]Your skin makes me [C]cry
[Dm]You float like a feather [Bb]
[F]In a beautiful [C]world
[Dm]I wish I was special [Bb]
[F]You're so fucking [C]special

[Dm]But I'm a creep [Bb]
[F]I'm a weirdo [C]
[Dm]What the hell am I doing here [Bb]
[F]I don't belong here [C]`,

  /* ── PEARL JAM ──────────────────────────────────────────────────── */
  'spj01': `[E5]She lies and says she's in love with him
[D5]Can't find a better man
[E5]She dreams in color she dreams in red
[D5]Can't find a better man
[E5]Can't find a [D5]better man [A5]
[E5]Can't find a [D5]better man [A5]`,

  /* ── COLDPLAY ────────────────────────────────────────────────────── */
  'scold01': `[C]When you try your best but you don't [Em]succeed
[Am]When you get what you want but not what you [F]need
[C]When you feel so tired but you can't [Em]sleep
[Am]Stuck in re[F]verse

[C]And the tears come streaming [Em]down your face
[Am]When you lose something you can't [F]replace
[C]When you love someone but it goes to [Em]waste
[Am]Could it be [F]worse?

[Am]Lights will guide you home [F]
[C]And ignite your bones [G]
[Am]And I will try [F]to fix [C]you [G]`,

  /* ── SYSTEM OF A DOWN ───────────────────────────────────────────── */
  'ssoad01': `[Dm]Wake up [C] grab a brush and put a little make-up
[Bb]Hide the scars [A]to fade away the shake-up
[Dm]Why'd you leave the keys upon the table
[Bb]Here you go create another fable

[Dm]You wanted to [C]
[Bb]Grab a latte [A]
[Dm]Couldn't stand to [C]
[Bb]Take me on your [A]way

[Dm]Chop suey [C]
[Bb]Chop suey [A]`,

  /* ── LINKIN PARK ────────────────────────────────────────────────── */
  'slp01': `[Am]In the end [G]it doesn't even matter
[F]I had to fall [C]to lose it all
[Am]But in the end [G]it doesn't even matter

[Am]One thing I don't know why [G]
[F]It doesn't even matter [C]how hard you try
[Am]Keep that in mind [G]I designed this rhyme
[F]To explain in due time [C]all I know

[Am]Time is a valuable thing [G]
[F]Watch it fly by as the pendulum swings [C]
[Am]Watch it count down to the end of the day [G]
[F]The clock ticks life away [C]`,

  /* ── DEPECHE MODE ───────────────────────────────────────────────── */
  'sdm01': `[Am]All I ever wanted [C]
[G]All I ever needed [F]
[Am]Is here in my arms [C]
[G]Words are very un[F]necessary
[Am]They can only do [C]harm

[Am]Vows are spoken [C]
[G]To be broken [F]
[Am]Feelings are intense [C]
[G]Words are trivial [F]
[Am]Pleasures remain [C]
[G]So does the pain [F]
[Am]Words are meaning[C]less
[G]And forgetta[F]ble`,

  /* ── A-HA ────────────────────────────────────────────────────────── */
  'saha01': `[A]We're talking away [F#m]
[D]I don't know what I'm to say [E]I'll say it anyway
[A]Today's another day to find you [F#m]
[D]Shying away [E]
[A]I'll be coming for your love OK [F#m]

[A]Take on me [F#m] take me on
[D]I'll be gone [E] in a day or two

[A]So needless to say [F#m]
[D]I'm odds and ends [E] but I'll be stumbling away
[A]Slowly learning that life is [F#m]OK
[D]Say after me [E]
[A]It's no better to be safe than sorry [F#m]`,

  /* ── EURYTHMICS ─────────────────────────────────────────────────── */
  'seur01': `[Bm]Sweet dreams are made of [G]this
[A]Who am I to dis[E]agree?
[Bm]I travel the world [G]
[A]And the seven seas [E]
[Bm]Everybody's looking for [G]something
[A] [E]

[Bm]Some of them want to use [G]you
[A]Some of them want to get [E]used by you
[Bm]Some of them want to abuse [G]you
[A]Some of them want to be [E]abused`,

  /* ── DIRE STRAITS ───────────────────────────────────────────────── */
  'sdirs01': `[A]Now look at them yo-yos that's the way you do it
[D]You play the guitar on the MTV
[A]That ain't workin' that's the way you do it
[D]Money for nothing and chicks for free
[A]Now that ain't workin' that's the way you do it
[D]Lemme tell ya them guys ain't dumb
[A]Maybe get a blister on your little finger
[D]Maybe get a blister on your thumb

[Gm]We gotta install microwave ovens
[Bb]Custom kitchen deliveries
[Gm]We gotta move these refrigerators
[Bb]We gotta move these [C]colour TV's`,

  /* ── FLEETWOOD MAC ──────────────────────────────────────────────── */
  'sfm01': `[Am]Just stop your crying [C]
[G]It's a sign of the [F]times
[Am]Welcome to the final show
[C]Hope you're wearing [G]your best [F]clothes

[Am]You can't bribe the [C]door on the way to the sky
[G]You look pretty good down here
[F]But you ain't really good

[Am]We never learn, we been here [C]before
[G]Why are we always [F]stuck and running from
[Am]The bullets? The bullets? [C]
[G]We never learn, we been here [F]before`,

  /* ── THE POLICE ─────────────────────────────────────────────────── */
  'spol01': `[A]Every breath you take [F#m]
[D]Every move you make [E]
[A]Every bond you break [F#m]
[D]Every step you take [E]
[A]I'll be watching you [F#m] [D] [E]

[A]Every single day [F#m]
[D]Every word you say [E]
[A]Every game you play [F#m]
[D]Every night you stay [E]
[A]I'll be watching you [F#m] [D] [E]

[G]Oh can't you see [A]
You belong to me
[F#m]How my poor heart aches
[G]With every step you [E]take`,

  /* ── GUNS N' ROSES ──────────────────────────────────────────────── */
  'sgn01': `[D]She's got a smile that it seems to me
[Cadd9]Reminds me of childhood memories
[G]Where everything [D]was as fresh as the bright blue sky
[D]Now and then when I see her face
[Cadd9]She takes me away to that special place
[G]And if I stare too [D]long I'll probably break down and cry

[D]Whoa whoa whoa [C]sweet child o' [G]mine
[D]Whoa oh oh oh [C]sweet love of [G]mine

[D]She's got eyes of the bluest skies
[Cadd9]As if they thought of rain
[G]I hate to look into those eyes
[D]And see an ounce of pain
[D]Her hair reminds me of a warm safe place
[Cadd9]Where as a child I'd hide
[G]And pray for the thunder and the rain
[D]To quietly pass me by

[D]Whoa whoa whoa [C]sweet child o' [G]mine
[D]Whoa oh oh oh [C]sweet love of [G]mine

[Am]Where do we go? [C]Where do we go now?
[Am]Where do we go? [C]
[Am]Where do we go? [C]Where do we go now?
[D]Sweet child o' mine`,

  'sgn02': `[Em]Just a rag-tag [G]kid, looking for the [D]main attraction
[Em]Just a [G]rag-tag [D]kid

[Em]Welcome to the jungle [A]we got fun 'n' [D]games
[Em]We got everything you want [A]honey we know the [D]names
[Em]We are the people that can find [A]whatever you may [D]need
[Em]If you got the money honey [A]we got your dis[D]ease

In the [G]jungle [D]welcome to the jungle
[A]Watch it bring you to your sha na na na na na na [Em]knees, knees`,

  /* ── BON JOVI ────────────────────────────────────────────────────── */
  'sbj01': `[Em]Tommy used to work on the docks
[D]Union's been on strike
[C]He's down on his luck [G]it's tough, so tough
[Em]Gina works the diner all day
[D]Working for her man
[C]She brings home her [G]pay for love, for love

[Em]She says we've gotta [D]hold on to what we've got
[C]'Cause it doesn't make a difference [G]if we make it or not
[Em]We've got each other [D]and that's a lot
[C]For love we'll give it a [G]shot

[Em]Whoa we're halfway [D]there
[C]Whoa livin' on a [G]prayer
[Em]Take my hand we'll make [D]it I swear
[C]Whoa livin' on a [G]prayer

[Em]Tommy's got his six-string in hock
[D]Now he's holding in
[C]What he used to make it [G]talk so tough it's tough
[Em]Gina dreams of running away
[D]When she cries in the night
[C]Tommy whispers: Baby it's okay [G]someday

[Em]We've gotta hold [D]on ready or not
[C]You live for the fight when it's [G]all that you've got

[Em]Whoa we're halfway [D]there
[C]Whoa livin' on a [G]prayer
[Em]Take my hand we'll make [D]it I swear
[C]Whoa livin' on a [G]prayer

[Em]Whoa we're halfway [D]there
[C]Whoa livin' on a [G]prayer
[Em]Take my hand we'll make [D]it I swear
[C]Whoa livin' on a [G]prayer`,

  /* ── АККОРДЫ НА РУССКОМ ─────────────────────────────────────────── */

  /* ── КИНО / ЦОЙ ─────────────────────────────────────────────────── */
  'srk01': `[Am]Тёплое место [F]но улицы ждут
[C]Отпечатков наших [G]ног
[Am]Звёздная ночь [F]и ты поёшь
[C]Что тебе нужен я [G]

[Am]Группа крови [F]на рукаве
[C]Мой порядковый [G]номер на рукаве
[Am]Пожелай мне [F]удачи в бою
[C]Пожелай мне [G]не остаться в этой траве

[Am]Пожелай мне [F]удачи
[C]Пожелай мне [G]удачи

[Am]И есть чем [F]платить
[C]Но я не хочу [G]победы любой ценой
[Am]Я никому [F]не хочу
[C]Ставить ногу на [G]грудь
[Am]Я хотел бы [F]остаться с тобой
[C]Просто остаться с [G]тобой

[Am]Но высокая в небе [F]звезда
[C]Зовёт меня [G]в путь

[Am]Группа крови [F]на рукаве
[C]Мой порядковый [G]номер на рукаве
[Am]Пожелай мне [F]удачи в бою
[C]Пожелай мне [G]не остаться в этой траве

[Am]Пожелай мне [F]удачи
[C]Пожелай мне [G]удачи`,

  'srk02': `[Am]Белый снег [F]серый лёд
[C]На растрескавшейся [G]земле
[Am]Одеялом лоскутным [F]на ней
[C]Город в дорожной [G]петле
[Am]А над городом [F]плывут облака
[C]Закрывая небесный [G]свет
[Am]А над городом [F]жёлтый дым
[C]Городу две тысячи [G]лет

[Am]Прожить ещё одну [F]зиму
[C]Увидеть любовь и [G]печаль
[Am]Звезда по имени Солнце [F]
[C] [G]`,

  'srk03': `[Am]Закрой за мной [F]дверь я ухожу
[Am]И уйди так же [F]тихо
[Am]Не спрашивай [E]зачем и почему
[Am]Ведь это твой [E]выбор

[Am]Кукушка [F]кукушка
[C]Напой мне [G]песенку
[Am]Я счастье спрятал [F]близко
[C]В берёзах твоих [G]

[Am]Мне сказали что все [F]что нужно
[C]Это потерять [G]себя
[Am]Но я не хочу [F]терять
[C]Ничего из [G]того что есть`,

  'srk04': `[Bm]Мы не можем похвастаться мудростью глаз
[G]И умелыми жестами рук
[D]Нам не нравится то что мы видим в зеркале
[A]Нам не нравится то что мы видим в зеркале

[Bm]Ощущение беспокойства
[G]В выходные и в рабочие дни
[D]Нас как детей застали врасплох
[A]Нас как детей застали врасплох

[Bm]Перемен! [G]требуют наши сердца
[D]Перемен! [A]требуют наши глаза
[Bm]В нашем смехе [G]и в наших слезах
[D]И в пульсации [A]вен:
[Bm]Перемен! [G]
Мы [D]ждём [A]перемен

[Bm]Электрический свет продолжает наш век
[G]Привожу к тебе ночь
[D]Солнце встанет потом
[A]Солнце встанет потом

[Bm]Перемен! [G]требуют наши сердца
[D]Перемен! [A]требуют наши глаза
[Bm]В нашем смехе [G]и в наших слезах
[D]И в пульсации [A]вен:
[Bm]Перемен! [G]
Мы [D]ждём [A]перемен`,

  /* ── ДДТ ─────────────────────────────────────────────────────────── */
  'srdt01': `[Am]Что такое [F]осень — это небо [C] [G]
[Am]Плачущее небо [F]под ногами [C] [G]
[Am]Лужи как зер[F]кала и в них [C]отраженья [G]
[Am]Жёлтых деревьев [F] [C] [G]

[Am]Что такое [F]осень — это ветер [C] [G]
[Am]Вновь играет рваными [F]цепями [C] [G]
[Am]Осень, я давно [F]не верую в приметы [C] [G]
[Am]Но я не смогу [F]пройти мимо [C] [G]

[Am]Осень, [F]в небе жгут [C]корабли [G]
[Am]Осень, [F]мне бы [C]прочь уй[G]ти
[Am]В небе стая ворон [F]кружит
[C]Что мне делать с [G]этой душой

[Am]Что такое [F]осень — это люди [C] [G]
[Am]Ждущие у [F]запертых дверей [C] [G]
[Am]Это листья, [F]рыжая монета [C] [G]
[Am]На которую [F]нельзя ничего купить [C] [G]

[Am]Осень, [F]в небе жгут [C]корабли [G]
[Am]Осень, [F]мне бы [C]прочь уй[G]ти
[Am]В небе стая ворон [F]кружит
[C]Что мне делать с [G]этой душой

[Am]Осень, [F]добрая моя [C] [G]
[Am]Осень, [F]смерть моя [C] [G]`,

  /* ── ЗЕМФИРА ─────────────────────────────────────────────────────── */
  'srz01': `[Am]Ты смеёшься [G]
[F]Я не понимаю [C]почему
[Am]Твои смешки [G]
[F]Достались не[C]зная
[Am]Тебе [G]
[F]Не мне [C]

[Am]Почему [G]
[F]Ты не берёшь трубку [C]
[Am]Я набираю [G]
[F]Восьмое число [C]
[Am]Почему [G]
[F] [C]`,

  'srz02': `[Am]Хочешь я убью [Dm]соседей
[Am]Тех что сверху и [E7]снизу
[Am]Хочешь я зарежу [Dm]прожектор
[Am]Направленный прямо на [E7]нас

[Am]Хочешь я сварю тебе кофе [Dm]
[Am]Хочешь я приду к тебе [E7]ночью
[Am]Хочешь всё что нужно [Dm]добуду
[Am]Всё что нужно [E7]нет

[Am]Ведь ты не зна[F]ешь
[Am]Ты не пони[E7]маешь
[Am]Ведь ты не зна[F]ешь
[Am]Ты не пони[E7]маешь мне`,

  /* ── СПЛИН ──────────────────────────────────────────────────────── */
  'srsp01': `[Em]Разлюби меня [G]
[D]Отпусти меня [Am]
[Em]Будет легче [G]нам обоим
[D]Без любви [Am]

[C]Я устала от [G]разлук
[D]Без тебя мне одиноко [Em]
[C]Ты мой первый [G]лучший друг
[D]Но я ухожу далеко

[Em]Мне не хватает тебя [G]
[D]Мне не хватает тебя [Am]
[Em]Где-то в пространстве [G]
[D]Тает моя [Am]любовь`,

  /* ── БИ-2 ─────────────────────────────────────────────────────────── */
  'srbi01': `[Am]Серые будни [F]и чёрные [C]ночи
[G]Вот и всё что нам [Am]с тобой досталось
[F]Серые будни [C]и чёрные [G]ночи
[Am]Вот и всё
[F] [C] [G]

[Am]Мой полковник [F]молчит
[C]Никто ему [G]не пишет
[Am]Не скулит [F]не кричит
[C]Ждёт [G]и слышит
[Am]Тишину [F]в тишине
[C]Безмолвно [G]безумно`,

  /* ── АЛИСА ──────────────────────────────────────────────────────── */
  'sral01': `[Am]Небо [F]тебя найдёт [C]
Небо [G]тебя найдёт [Am]
[F]Под землёй [C]из воды [G]
Небо тебя [Am]найдёт

[F]Я не знаю [C]
Что там [G]впереди [Am]
[F]Только знаю [C]
Небо тебя [G]найдёт`,

  /* ── НАУТИЛУС ПОМПИЛИУС ─────────────────────────────────────────── */
  'srnp01': `[Am]Там где [E]был я
[F]Там где [G]жил я
[Am]Ещё помнят [E]обо мне
[F]Но это [G]всё

[Am]Гудбай [E]Америка о
[F]Где я не [G]был никогда
[Am]Прощай нав[E]сегда
[F]Возьми бан[G]джо

[Am]Сыграй мне [E]на прощание
[F]Американскую [G]песню
[Am]Гудбай Амери[E]ка о

[Am]Ты так долго [E]ждала меня
[F]Но видно [G]зря
[Am]Между нами [E]не только
[F]Километры [G]

[Am]Гудбай [E]Америка о
[F]Где я не [G]был никогда
[Am]Прощай нав[E]сегда
[F]Возьми бан[G]джо

[Am]Я смотрю в ки[E]нохронику
[F]Среди толпы [G]ищу знакомые лица
[Am]Но там нет [E]моих друзей
[F]Все они [G]здесь

[Am]Гудбай [E]Америка о
[F]Где я не [G]был никогда
[Am]Прощай нав[E]сегда
[F]Возьми бан[G]джо`,

  /* ── АГАТА КРИСТИ ───────────────────────────────────────────────── */
  'srak01': `[Am]Как на войне [F]
[C]Под ударами судьбы [G]
[Am]Выживают лишь [F]сильнейшие
[C]Из нас с тобой [G]

[Am]Я гляжу в [F]зеркало
[C]Но там другой [G]
[Am]Незнакомый [F]силуэт
[C]Смотрит на [G]меня

[Am]Декаданс [F]
[C]Кружит голову [G]
[Am]Нам обоим [F]
[C]Ты и я [G]`,

  /* ── ЧИЖ & CO ────────────────────────────────────────────────────── */
  'srch01': `[D]О любви не говори [A]
[G]О ней всё сказано [D]
[G]Сердца два в ночи [D]горят
[A]О любви не говори [D]

[G]Как ты далеко [D]
[A]Хотя рядом [D]
[G]Так близко и [D]далеко
[A]Одновременно [D]

[D]Нам не нужны [A]слова
[G]Чтоб понять [D]друг друга
[G]Без слов говорит [D]
[A]Сердце за нас [D]`,

  /* ── СОВРЕМЕННЫЕ РУССКИЕ ────────────────────────────────────────── */
  'srmod01': `[Am]Я бы мог [F]бросить мир к твоим ногам
[C]Но не знаю [G]есть ли смысл
[Am]Ты ушла [F]нарисовавшись по губам
[C]Поцелуем [G]

[Am]Скажи как мне [F]жить без тебя
[C]Каждый вечер [G]эта рана свежа
[Am]Скажи как мне [F]жить без тебя
[C]Снег идёт [G]

[Am]Скажи мне [F] [C] [G]
[Am]Скажи мне [F] [C] [G]`,

  /* ── АРИЯ ─────────────────────────────────────────────────────────── */
  'srar01': `[Am]Небо тебя [E]найдёт
[Am]В любом конце [F]земли
[Am]Небо тебя [E]найдёт
[G]Ты слышишь [F]зов [E]

[Am]Один ты [E]стоишь на краю
[Am]Но небо не [F]оставит в тиши
[Am]Ты слышишь [E]зов
[G]Небо тебя [F]найдёт [E]`,

  /* ── POPULAR POP / SOUL ──────────────────────────────────────────── */
  'sp_sting01': `[F#m]Every little thing she does is magic
[D]Every thing she do just turns me on
[E]Even though my life before was tragic
[A]Now I know my love for her goes on

[F#m]Do do do do do
Do do do do do do
[D]Do do do do do [E]
Do do do do [A]

[F#m]I resolve to call her up a thousand times a day
[D]Ask her if she'll marry me in some old-fashioned way
[E]But my silent fears have gripped me long before I reach the phone
[A]Long before my tongue has tripped me, must I always be alone?`,

  'sp_billy01': `[Cm]In the middle of the night I go walking in my sleep
[Ab]From the mountains of faith
[Bb]To a river so deep
[Cm]I must be looking for something
[Ab]Something sacred I lost
[Bb]But the river is wide
[Cm]And it's too hard to cross

[Ab]And even though I know the river is wide
[Bb]I walk down every evening and I stand on the shore
[Cm]And try to cross to the opposite side
[Ab]So I can finally find out what I've been looking [Bb]for

[Eb]In the middle of the night [Bb]
[Ab]I go walking in my sleep [Eb]
[Bb]Through the jungle of doubt [Ab]
[Eb]To a river so deep [Bb]`,

  'sp_tracy01': `[D]Baby can I hold you tonight
[G]Baby if I told you the right words [D]
[G]Ooh at the right time [A]
[D]You'd be mine

[D]I love you [G]
Is all that you can't say [D]
[G]Years gone by and still [A]
[D]Words don't come easily
Like sorry like sorry

[D]Forgive me [G]
Is all that you can't say [D]
[G]Years gone by and still [A]
[D]Words don't come easily
Like forgive me forgive me`,

  /* ── MICHAEL JACKSON ────────────────────────────────────────────── */
  'smj01': `[Am]Billy Jean is not my lover [G]
[F]She's just a girl who claims that I am the one [G]
[Am]But the kid is not my son [G]
[F]She says I am the one [G]

[Am]She was more like a beauty queen
[G]From a movie scene
[F]I said don't mind, but what do you mean [G]
[Am]I am the one [G]
[F]Who will dance on the floor in the round [G]

[Am]People always told me be careful of what you do [G]
[F]And don't go around breaking young girls' hearts [G]`,

  /* ── WHITNEY HOUSTON ────────────────────────────────────────────── */
  'swh01': `[Ab]And I [Bb]am telling you [Cm]
[Bb]I'm not going [Ab]
[Bb]You're the best man I'll ever [Cm]know
[Bb]There's no way I can ever [Ab]go
[Gm]No no there's no way [Cm]
[Bb]No no no no [Ab]way [Bb]
[Ab]I'm living without [Bb]you
[Cm]I'm not living without [Ab]you
[Bb]I don't want to be [Ab]free
[Gm]I'm staying [Cm]
[Bb]I'm staying [Ab]
[Bb]And you [Ab]
And you [Bb]
You're gonna love [Cm]me`,

  /* ── ABBA ─────────────────────────────────────────────────────────── */
  'sabba01': `[Cm]I was cheated by you
And I think you know [Bb]when
[Fm]So I made up my mind it must come to an [G]end

[Cm]Look at me now [Bb]
Will I ever learn [Ab]
[Fm]I don't know how [G]
But I suddenly lose control
[Cm]There's a fire within my [Bb]soul

[Eb]Just one look and I can hear a bell ring
[Bb]One more look and I forget everything
[Ab]W-o-o-o-o [Eb]waterloo
[Bb]I was defeated you won the war
[Ab]W-o-o-o-o [Eb]waterloo
[Bb]Promise to love you for ever more`,

  'sabba02': `[Am]You are the dancing [G]queen
[F]Young and sweet [C]only seventeen
[Am]Dancing queen [G]
[F]Feel the beat [C]from the tambourine oh yeah

[Am]You can dance [G]
[F]You can jive [C]
[Am]Having the time of your life [G]
[F]See that girl [C]watch that scene
[Am]Dig in the dancing [G]queen [F] [C]`,

  /* ── ТЕМАТИЧЕСКИЕ ФОЛК / КАНТРИ ──────────────────────────────────── */
  'scountry01': `[G]Country roads [D]take me home
[Em]To the place [C]I belong
[G]West Virginia [D]mountain mama
[C]Take me home [G]country roads

[G]Almost heaven [D]West Virginia
[Em]Blue Ridge Mountains [C]Shenandoah River
[G]Life is old there [D]older than the trees
[Em]Younger than the mountains [C]blowing like a breeze

[G]Country roads [D]take me home [Em]
To the place [C]I belong
[G]West Virginia [D]mountain mama
[C]Take me home [G]country roads`,

  'sfolk01': `[G]Scarborough Fair [D]
[Am]Are you going to [C]Scarborough [G]Fair?
[Em]Parsley sage [G]rosemary and [D]thyme
[Am]Remember me [C]to one who lives [G]there
[Em]She once was a [G]true love of [D]mine`,

  /* ── JAZZ STANDARDS ──────────────────────────────────────────────── */
  'sjazz01': `[Cmaj7]Autumn leaves [Am7]
[Dm7]Just turn to gold [G7]
[Cmaj7]I see your lips [Am7]
[Dm7]The summer [G7]kisses
[Cmaj7]The sunburned hands [Am7]
[Dm7]I used to hold [G7] [E7]

[Am7]Since you went away [Dm7]
[G7]The days grow long [Cmaj7]
[F#m7b5]And soon I'll hear [B7]
[Em7]Old winter's song [Am7]
[Dm7]But I miss you [G7]most of all
My [Cmaj7]darling [Am7]
[Dm7]When autumn leaves [G7]start to [Cmaj7]fall`,

  'sjazz02': `[Cmaj7]Fly me to the [Dm7]moon
And let me [G7]play among the [Cmaj7]stars
[Am7]Let me see what [Dm7]spring is like on [G7]Jupiter and [C]Mars

[Cmaj7]In other words [Dm7]
[G7]Hold my [Cmaj7]hand [Am7]
[Dm7]In other words [G7]
[Cmaj7]Darling [Am7]kiss me

[Dm7]Fill my heart with [G7]song
[Cmaj7]And let me sing for [Am7]ever more
[Dm7]You are all I [G7]long for
[Cmaj7]All I worship and a[Am7]dore
[Dm7]In other words [G7]please be [C]true
[Am7]In other [Dm7]words
[G7]I love [C]you`,

  /* ── ДЕТСКИЕ / РОМАНСЫ ──────────────────────────────────────────── */
  'skidd01': `[C]Расскажи мне [F]мама
[G]Про любовь [C]
[C]Расскажи мне [F]мама
[G]Про любовь [C]

[Am]Как бывает [Em]всё сложно
[F]Непонятно [G]порой
[Am]Но бывает [Em]так нежно
[C]Что не дышишь [G]почти

[C]Расскажи мне [F]мама
[G]Как это [C]бывает`,

  /* ── НОВЫЙ ГОД / ЗИМА ────────────────────────────────────────────── */
  'swinter01': `[C]В лесу родилась ёлочка
[G7]В лесу она росла
[C]Зимой и летом [F]стройная
[C]Зелёная [G7]была [C]

[Am]Метель ей пела [Em]песенку
[F]Спи ёлочка [C]бай бай
[Am]Мороз снежком [Em]укутывал
[F]Смотри не [G7]замерзай [C]

[C]Пришла веселая [F]Зима
Пора ей в [G7]свет [C]
Срубил ея [F]Дед Мороз
[G7]Топор был лет семь [C]

[C]Теперь она нарядная
[G7]На праздник к нам [C]пришла
[F]И много много [C]радости [G7]детишкам при[C]несла`,

};
