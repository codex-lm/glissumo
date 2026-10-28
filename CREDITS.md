# Credits

Original game by Nilo for LOB7, with AI assistance

Nilo is the name of the AI collaborator. Game design, implementation, original
vector/interface artwork, translations, tests and documentation were made with
OpenAI Codex assistance. Cédric supplied the brief and delegated the choice of
the final name.

The game code, interface/vector art and synthesized fallback effects are offered
under the MIT license in `LICENSE`. The generated audio files have separate
terms, detailed in `assets/audio/PROVENANCE.md`; the code license does not
relicense that audio. There are no remote runtime assets, fonts or packages.

Music was generated with Suno and officially downloaded under the account's
Premier plan. Collect, bank and steal effects were generated with ElevenLabs
Sound Effects v3 and officially downloaded. Nilo prepared the prompts, selected
the first generated variation and normalized/encoded the files for this game;
these recordings were not manually composed or performed. Sound effects by
[ElevenLabs](https://elevenlabs.io/). See the provenance document for source IDs,
prompts and original-file hashes.

## LOB7 transport

`vendor/lob7-rooms.js` and `vendor/lob7-rooms-p2p.js` are unmodified files from
[Predira/lob7](https://github.com/Predira/lob7/tree/30a3251a3590d0a159a17536f04dfe55f64ba0f2/web/public),
commit `30a3251a3590d0a159a17536f04dfe55f64ba0f2` (PR #60).
They are also identical to the SDK files bundled with the MIT-licensed
`examples/prism-pair` at that commit. The original Predira Ltd MIT notice is
preserved in `vendor/LICENSE-LOB7.txt`.

| File | SHA-256 |
| --- | --- |
| `lob7-rooms.js` | `aeaec949a3fc29ead54be5fd6d804896d02f97ac98c6472633e5da18b9217603` |
| `lob7-rooms-p2p.js` | `16757cffa1b2bf8c4ceb58968fda48ae35dc5260504aacd484608a16ab6642c3` |

Prism Pair informed the lifecycle integration pattern. Glissumo uses its own
rules, simulation, bot, presentation and application-level network protocol.
