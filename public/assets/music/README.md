# Signature music (drop-in, licensed material only)

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
