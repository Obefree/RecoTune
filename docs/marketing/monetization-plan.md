# RecoTune — Monetization & Low-Cost Growth Plan

Updated: 2026-09-09

## Goal

Build monetization with minimal paid marketing. RecoTune should not be positioned as only a tuner. The free tuner is the acquisition layer; paid value comes from practice tools, advanced music utilities, and later teacher/school workflows.

## Current product snapshot

### Already implemented / present in the current app

Based on the current main branch and recent changelog:

- Tuner with pitch detection, note/string targeting, smoothing, octave guards and stable display.
- Studio / multitrack recording workflow, overdub and latency compensation.
- Chords section with song library, offline chord/tab data, song search and chord reference.
- Melody recognition / sung melody transcription and playback timing.
- Media tools including recorder, live microphone monitoring and saving recordings.
- AI Lab section exists in the app navigation.
- Player / recorder / video screens are present in the codebase.
- Offline song/chord data and supporting Vercel/proxy infrastructure are already part of the project.

This means the monetization plan should use the broader music-toolset that already exists instead of selling RecoTune as a single-function tuner.

### In progress / near-term product work

- Note playback / reference-tone UX.
- Piano-style keys so the user can tap a note and hear it.
- Continue improving the core tuner and music-practice flow before adding a paywall.

## Product positioning

Primary positioning:

> Free universal tuner + paid music practice companion.

Longer-term positioning:

> Tune. Hear. Practice. Improve.

The tuner should remain genuinely useful in the free tier. Do not intentionally cripple basic tuning to force payment.

## Monetization model

### Free

Keep the core experience free:

- chromatic tuner;
- common instruments and standard tunings;
- note detection;
- cents / Hz display;
- reference note playback;
- piano/reference keys;
- basic saved settings.

The purpose of Free is acquisition, habit formation and word of mouth.

### RecoTune Pro

Initial pricing hypothesis:

- €14.99 / year
- €24.99 lifetime

Later, once practice features are significantly stronger:

- around €19.99 / year
- around €34.99 lifetime

Potential Pro features:

- all instruments and alternate tunings;
- custom tunings;
- extended reference frequency range;
- sensitivity and noise filtering controls;
- pitch history / stability graphs;
- intonation mode;
- advanced practice tools;
- ear training;
- pitch matching;
- interval exercises;
- vocal/instrument note drills;
- saved practice routines.

Lifetime purchase is important for this category because many users think of a tuner as a utility rather than a subscription service.

## Core paid-value direction: Tune → Hear → Play → Check

Build on the note playback feature:

1. App plays a target note.
2. User plays or sings it.
3. RecoTune listens.
4. App evaluates pitch accuracy and stability.
5. User retries or moves to the next note.

This can grow into:

- ear training;
- relative pitch exercises;
- vocal drills;
- violin / wind intonation practice;
- scale exercises;
- note-sequence repetition;
- pitch stability training.

This is more monetizable than a tuner alone and reuses technology already present in RecoTune.

## Low-cost acquisition strategy

### 1. Web tuner / SEO

Create real browser tools, not content-only SEO pages.

Examples:

- /guitar-tuner
- /drop-d-tuner
- /dadgad-tuner
- /7-string-guitar-tuner
- /bass-tuner
- /ukulele-tuner
- /violin-tuner
- /cello-tuner
- /chromatic-tuner
- /440hz
- /432hz
- /note/a4
- /note/c4

Flow:

Google/search → working web tuner → app install → repeat use → Pro.

Start with a limited number of genuinely useful pages rather than mass-generated SEO pages.

### 2. Shareable tunings

Allow a user to create a tuning and share a link.

Example:

`recotune.app/t/xxxx`

The recipient opens the exact tuning in the web app and can save/open it in RecoTune.

Useful distribution channels:

- Reddit;
- Discord;
- musician forums;
- band chats;
- YouTube descriptions;
- teachers and students.

This creates a user-driven acquisition loop.

### 3. App Store / Play Store organic search

Focus on ASO before paid traffic:

- clear tuner keyword coverage;
- strong screenshots of actual tuner/practice functions;
- localized store listings;
- reviews prompted only after successful use;
- instrument-specific wording where allowed.

### 4. Teacher-driven acquisition

A teacher can become a distribution node: one teacher may invite many students, each becoming a RecoTune user.

This can produce both B2B revenue and B2C acquisition without paid advertising.

## IDEA — Teacher / School platform

Status: IDEA / later validation. Do not treat as committed near-term scope yet.

Concept: an online music-learning workspace built around RecoTune's audio tools.

### Teacher account

Potential functions:

- student list;
- assignments;
- practice plans;
- target notes / scales / exercises;
- student submissions;
- automatic pitch / stability results;
- practice history;
- teacher comments;
- later: integrated video lessons.

### Student account

- homework list;
- tuner and reference-note tools;
- play/sing target note;
- automatic pitch accuracy feedback;
- practice timer/history;
- send results to teacher.

### Later video lesson room

Possible integrated tools during a lesson:

- video call;
- tuner;
- metronome;
- reference piano/keyboard;
- live pitch display;
- note history / pitch graph;
- shared exercises;
- recordings.

Differentiation versus generic music-teaching platforms:

> RecoTune should understand and measure what the student actually plays, not merely host a video call and files.

Potential teacher pricing hypothesis:

- Teacher: €9.99–14.99/month for a limited number of active students.
- School: from roughly €49/month depending on teachers/students/features.
- Students can remain free when invited by a teacher.

Do not build a full LMS first. Validate with the smallest workflow:

Teacher → student → assignment → pitch/tuner measurement → result.

Video calling, CRM, payments and administration can come later.

## What not to prioritize now

- banner ads;
- large paid user-acquisition campaigns;
- expensive AI features with no proven paid use case;
- a huge licensed song-content library;
- building a full school LMS before validating teacher demand.

## Analytics to add / track

Core events:

- app_open
- first_note_detected
- successful_tune
- second_session
- pro_feature_clicked
- paywall_opened
- purchase

Additional useful events:

- reference_note_played
- practice_started
- practice_completed
- tuning_shared
- shared_tuning_opened
- teacher_invite_opened

Primary activation metric:

> User successfully gets a useful tuning/pitch result within seconds of first launch.

Retention metric to watch:

> Percentage of users who use RecoTune at least 3 times in 30 days.

Initial monetization target:

- ~1% Free → paid: acceptable early signal
- ~2%: good
- 3%+: very strong for this type of freemium utility/practice product

## Recommended execution order

### Phase 1 — Core readiness

- finish note playback / piano-key experience;
- stabilize tuner and key music utilities;
- add analytics;
- identify which current features belong in Free vs Pro.

### Phase 2 — First monetization

- implement Pro entitlement;
- test €14.99/year + €24.99 lifetime;
- put advanced/practice features behind Pro without degrading the basic tuner.

### Phase 3 — Organic acquisition

- launch web tuner;
- build 10–20 high-intent instrument/tuning pages;
- implement shareable tuning links;
- improve ASO/localization.

### Phase 4 — Practice companion

- target-note playback;
- pitch matching;
- note-sequence exercises;
- scale/intonation exercises;
- progress history.

### Phase 5 — Teacher validation

- basic teacher account;
- student invite;
- assignment;
- student performs exercise;
- automatic pitch/stability result;
- teacher views result.

### Phase 6 — School / live lessons only if validated

- video lesson room;
- shared music tools;
- class/admin features;
- school billing.

## Marketing-budget principle

For the first stages, target near-zero paid marketing spend. Invest development effort into:

1. a better free product;
2. web SEO tools;
3. shareable objects/links;
4. ASO and localization;
5. teacher referral loops;
6. analytics and conversion experiments.

Paid ads should come only after organic activation, retention and Free→Pro conversion are measured and healthy.
