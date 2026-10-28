# Glissumo

Original game by Nilo for LOB7, with AI assistance

Version **0.1.0**. Source repository: `codex-lm/glissumo`.

A two-minute duel on a board that both players can move. Hop between rows,
collect sparks, and slide a whole row toward your bank. Anyone on that row
comes along for the ride. Solo play includes a deterministic opponent.

## Rules in ten seconds

- **Up/down:** move to the neighboring row.
- **Left/right:** slide your entire row one space; it wraps at the edge.
- Collect up to three sparks. Reach your colored edge to bank them.
- Bump into the rival vertically to swap places and steal one carried spark.
- The higher banked score after 120 seconds wins. Ties are allowed; rematch!

Movement has the same 180 ms cooldown for both players. A steal gives both
players a 900 ms steal cooldown. Shared rows also move sparks, so reaching a
spark normally requires a hop between rows. Every match uses a fresh seed.

## Run and test

Node.js is needed only for local development. There are no npm dependencies.

```sh
git clone https://github.com/codex-lm/glissumo.git
cd glissumo
npm start
npm test
npm run build
```

Open the local address printed by the server. The game uses browser ES modules,
so serve it over HTTP rather than opening `index.html` as a `file:` URL.
Keyboard and on-screen direction buttons operate the same actions. Interface
languages are English, French and Spanish.

## Audio

Four MP3 files are bundled in `assets/audio/`: one Suno-generated music loop
and three ElevenLabs-generated effects for collecting, banking and stealing.
Music and sound effects have separate controls. The interface remains playable
while muted, and locally synthesized sounds cover the other actions and provide
a fallback. Audio loads from the same game origin; no provider service is
contacted at runtime.

The MIT license covers the code, original vector/interface art and synthesized
fallback effects. Generated recordings retain separate terms; see
[audio provenance](assets/audio/PROVENANCE.md) for the providers, generation
prompts, source identifiers, file processing and rights scope.

## LOB7 edition source

`main` contains the maintainable source, tests and local tools. The `lob7`
branch is reserved for the generated static export: its root contains only the
files allowlisted by `tools/build.mjs`, with no package manifest or test tools.
Use the exact **static-export commit**, not an arbitrary main-branch commit,
when preparing an edition. LOB7 does not execute npm scripts and rejects build
manifests in static game archives.

`npm run build` writes `dist/` and a deterministic `BUILD.json` containing the
version and each included file's SHA-256. It refuses unexpected existing
output files. Keep all license and credit files when copying that export.
The game manifest contains:

```json
"multiplayer": { "mode": "p2p", "maxPlayers": 2 }
```

There is no `network` field, game server, TURN relay, external asset dependency,
account token, email, global account identifier, or account nickname in game code.
The exact SDK copies are documented in [CREDITS.md](CREDITS.md).

## Multiplayer lifecycle

After Cédric publishes the chosen commit on LOB7, two separate signed-in accounts
create/join the same edition's room and accept LOB7's direct-connection notice.
Each selects **Play together** inside the game. Both then select **Ready**. Mint is
the fixed host and banks on the left; coral is the guest and banks on the right.
Each player's color, seat and goal are shown before the match. Both select the
rematch button to start a fresh board over the same connection.

The host alone advances the simulation. The guest sends bounded intentions,
never position or score claims. Full snapshots repair missed state updates;
numbered taps are resent until acknowledged; held intentions expire after
350 ms. Round numbers prevent old-game packets affecting a rematch. Start,
result and readiness are repeated, and movement is validated and rate-limited.

The game disables Connect and Solo during active play. Leaving, a closed room,
or a failed connection ends the session and restores the menu. Keep the host
tab open. Direct connections use the SDK's Cloudflare STUN configuration; some
networks cannot connect, and there is no automatic host migration.

## Verification scope

**19 automated tests pass** for version 0.1.0. `npm test` covers deterministic rules, bot completion, shared-row interactions,
tap acknowledgement, lost snapshots and input, delayed transport, full match
completion, rematch, malformed data, connection cancellation and application
lifecycle. Network tests include a complete 120-second match with 140 ms of
simulated transport delay, plus packet-loss scenarios. They use an injected
transport and do not establish an authenticated LOB7 connection.

A complete 120-second solo round was observed in the Codex in-app browser
(0–87 during tuning), followed by a rematch with a new board. A second complete
round with the final Chill setting ended 1–37: an on-screen hop collected a spark
and held keyboard movement banked it. Music and effects were enabled without
console errors. Microsoft Edge desktop also loaded the game and started solo.
A portrait viewport
of 390 × 844 pixels was visually inspected. These observations verify local
operation and layout; they do not establish human enjoyment or physical-phone
compatibility. The exact LOB7 static worker also accepted the generated export.

Actual LOB7 two-account acceptance must follow publication: the platform only
creates rooms for exact, visible, published hosted editions. A local session or
Prism Pair's published edition cannot validate this game's edition. No LOB7
publication, platform merge or deployment is performed by this repository.

Still pending: a complete game in two browsers with different LOB7 accounts,
real direct-connection departure and rematch, and physical Android 10 Edge in
desktop-site mode. No LOB7 publication or update of announcement #59 was made.
A desktop viewport emulation is not a physical Android test. See the
[detailed acceptance record](https://github.com/codex-lm/glissumo/blob/main/docs/RECETTE_FR.md)
for the distinction between automated, browser-observed and pending checks.

See [LOB7 rooms](https://lob7.com/rooms.md) and the
[multiplayer reference](https://lob7.com/agents/reference.md#multiplayer).
