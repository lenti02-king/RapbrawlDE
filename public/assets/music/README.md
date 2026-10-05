# Music drop-ins (licensed material only)

When a fighter's Signature cinematic starts, the game plays `<fighter>.mp3` from this folder as a short excerpt
(default: from 0 s, 8 s long, max 15 s) and ducks the in-game beat. Optional `<fighter>.json`:

```json
{ "start": 42.5, "length": 7 }
```

Without a file the game plays an original, procedurally generated stinger (no third-party music).

**Rights:** only add a track when its use in the game is licensed in writing. For a released song that means the
composition (publisher / GEMA-administered rights, incl. the synchronisation licence for a game) **and** the master
recording (label). Short excerpts are not automatically free; the artist alone often cannot grant all rights.
Do not commit unlicensed audio to this repository.

## Background music (`bgm.mp3`)

The fights run on an original, procedurally performed rap beat ("Block Beats", 90 BPM, generated in
`src/audio/audio.ts` — GEMA-free because nothing third-party is used). For the MVP you can drop your own track here
as `bgm.mp3`; it then loops instead of the generated beat (ducked under the Signature music like the beat).
Optional `bgm.json`:

```json
{ "gain": 0.8 }
```

The Beat-Drop mechanic judges hits on the game's fixed 90 BPM clock, so a dropped-in track should be 90 BPM (or a
half/double-time feel of it) for the on-beat ring to match what you hear.

Audio files in this folder are **git-ignored** on purpose: the repository is public, and unlicensed songs must not be
published with it. Copy the files into a local checkout (or the release build) only.
