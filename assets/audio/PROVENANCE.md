# Glissumo audio provenance

Created on 28 October 2026 through the user's connected Suno and ElevenLabs
accounts, with permission to make music and effects for Glissumo. No cloned
voices, reference recordings or artist imitation prompts were supplied.

## Music

Source: [Suno clip d7e6e2b0-21c5-41d1-a36e-3c0b5cecf8aa](https://suno.com/song/d7e6e2b0-21c5-41d1-a36e-3c0b5cecf8aa).
Model: v6-mini, Sounds, Loop. Two variations generated; first variation used.
The official Download dialog showed **Premier** and 4 available downloads.
Unlock & Download was used; the MP3 was saved successfully. No stream was ripped.

Prompt: “Glissumo: seamless playful instrumental arcade loop for a friendly
two-player sliding-row duel. 104 BPM, warm marimba and plucked synth, soft rounded
bass, tiny dry shuffled percussion, mischievous call-and-response motif. Light,
tactile, bouncy, focused, never epic. Stable groove, no intro or ending, no vocals
or speech, no loud treble, no sound effects. Leave space for game pings.”

Original MP3 SHA-256:
`003653c966c99a6d914ed329876fb595af923ff50d7ac0678900ca4349098409`.

Runtime `music.mp3`: 44.1 kHz, 112 kbps, about 20.77 s; FFmpeg loudness target
-24 LUFS / -3 dBTP / LRA 7, 15 ms opening fade. Repeated via Web Audio.

## Effects

ElevenLabs Sound Effects v3, Auto duration, no looping. Each request generated
four variations; variation #1 was officially downloaded as 48 kHz WAV. The plan
tier was not inspected. Attribution is retained regardless of tier:
**Sound effects by [ElevenLabs](https://elevenlabs.io/).**

- `collect.mp3`: source history `IH4qHZJjlIZoPIWlSn9Z`. Prompt: “One isolated
  tiny magical spark pickup for a playful tactile arcade game: a soft glassy
  pluck, a bright rounded two-note upward ping, very short 0.25 second decay.
  Clean dry studio sound, gentle and satisfying on phone speakers. No voices,
  no music, no ambience, no repetition, no harsh treble.” Original WAV SHA-256:
  `f8eb4ced1711164c18761893d15c559a1f43473d7161cbff09ce75d4596e6fc2`.
- `bank.mp3`: source history `4dDzg0Ndseo4Uric9ont`. Prompt: “One isolated score
  deposit for Glissumo, a playful arcade duel. Three warm rounded marimba-glass
  notes rising quickly, then a tiny soft satisfying wooden clack. 0.6 seconds
  total, clean dry short tail, friendly reward, clear on phone speakers. No
  voices, no music bed, no ambience, no repeats, no harsh high frequencies.”
  Original WAV SHA-256:
  `b9439891604e4730d995c65731c9fff1c7265c3790aacd399b900b6e7eea1dc4`.
- `steal.mp3`: source history `6UOlweQAQ9R1Z1wAKY1H`. Prompt: “One isolated
  mischievous spark-steal sound for Glissumo, a friendly arcade duel: a tiny
  stretchy rubber pluck followed by a quick low-to-high wooden pop and a cheeky
  descending glass chirp. 0.35 seconds, soft dry clean tail, small playful
  surprise, no harsh transients. No voices, music, ambience, or repetition.”
  Original WAV SHA-256:
  `51eea52b26c9233ef55d3f325001722c22a2174e50f2043188161f359dd3712c`.

Runtime effects: mono 44.1 kHz, 96 kbps MP3, loudness target -19 LUFS / -3 dBTP /
LRA 7. Collect has a 60 ms fade beginning at 0.42 s. Gameplay effects are quieter
than these file levels; music ducks on scoring and steals. Original downloads
remain outside the public export. Final-file hashes are in `BUILD.json`.

## Audio terms

These generated recordings are provided as the soundtrack/effects of Glissumo;
they are **not covered by the repository's MIT code license**. Do not infer an
independent unrestricted audio-redistribution license. Reuse must respect the
applicable [Suno terms](https://suno.com/terms/) and
[ElevenLabs terms](https://elevenlabs.io/terms-of-use), including attribution
where applicable. No legal exclusivity or human composition is claimed.

All gameplay remains readable with audio muted. Music and effects have separate
controls, start after interaction, and music pauses when the tab is hidden.
