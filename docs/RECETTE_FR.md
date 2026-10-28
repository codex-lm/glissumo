# Glissumo 0.1.0 — recette du 28 octobre 2026

Dépôt cible : `codex-lm/glissumo`. Le développement se trouve sur `main` ; la
branche `lob7` reçoit l’export statique destiné à préparer une édition exacte.
Le nom de code initial était `duo`.

Ce document sépare les tests automatiques, les observations dans un navigateur
réel et la recette LOB7 qui reste à faire. Il ne constitue pas un avis de
joueur humain sur le plaisir de jeu ou son équilibrage.

## Vérifications automatiques effectuées

Commande : `node --test tests/*.test.mjs`.

**19 tests réussis, aucun échec.** Ils couvrent notamment :

- génération déterministe, collecte et dépôt, déplacement de toute une rangée,
  collision et vol, limites de cadence et de capacité ;
- adversaires simulés capables de terminer et de marquer, récupération après
  des situations de poursuite et fonctionnement avec une cadence variable ;
- partie réseau complète de 120 secondes avec 140 ms de délai simulé, résultat
  convergent et revanche ;
- récupération d’un instantané de départ perdu, répétition d’un appui bref
  jusqu’à acquittement, arrêt d’un mouvement après perte du relâchement ;
- refus des états falsifiés par l’invité, isolation entre deux manches,
  visibilité de la disponibilité de l’hôte pour la revanche et annulation
  propre d’une connexion ;
- parcours applicatif solo, revanche, adaptation de la largeur mobile,
  commandes et retour au menu après fermeture, avec un DOM de test minimal.

Les tests réseau utilisent un transport injecté. Ils ne sollicitent ni les
comptes LOB7, ni sa signalisation, ni un vrai canal WebRTC. Le DOM minimal ne
valide pas le rendu visuel ou un écran tactile physique.

## Observations dans le navigateur intégré de Codex

L’agent principal a effectué les contrôles suivants sur l’aperçu HTTP local :

- une partie solo est arrivée au terme des 120 secondes ; le résultat affiché
  était **0–87** pendant le réglage de la difficulté ;
- une seconde partie complète avec le réglage Tranquille final a terminé
  **1–37** : une commande à l’écran a ramassé une étincelle et une flèche
  maintenue au clavier l’a déposée ; musique et bruitages activés, aucune
  erreur de console observée ;
- le bouton de revanche a lancé une nouvelle partie avec un nouveau plateau ;
- les commandes au clavier et les boutons directionnels à l’écran ont été
  activés ; les boutons ont été testés par clic, sans matériel tactile ;
- le rendu en portrait **390 × 844 pixels** a été observé par capture d’écran.
- les trois langues ont été affichées ; Microsoft Edge sur ordinateur a aussi
  chargé le jeu et démarré une partie solo.

Ce score ne sert pas à démontrer l’équilibrage entre personnes. Ces observations
confirment le parcours solo et le rendu dans ce navigateur, sans extrapoler à
Android, Edge mobile ou à une partie humaine à deux.

## Export et contraintes de la plateforme

L’export courant contient **22 fichiers autorisés**, dont 17 fichiers web servis.
Il a été accepté par `validate_game` du véritable validateur
`workers/browser-games/static_game.py` de la plateforme. Cette invocation était
locale et en lecture seule, avec Python `-B` pour ne pas écrire de cache dans
le dépôt de la plateforme. La présence et le contrôle statique des fichiers ne
constituent pas une exécution du jeu sur LOB7.

Le manifeste déclare seulement :

```json
"multiplayer": { "mode": "p2p", "maxPlayers": 2 }
```

Les deux SDK sont les copies intactes de
`Predira/lob7@30a3251a3590d0a159a17536f04dfe55f64ba0f2`, avec leurs empreintes et
la notice MIT Predira conservées. Les imports, styles, dessins et quatre MP3
sont locaux. La seule récupération de média dans le code du jeu est relative
à `assets/audio/`. Le SDK conserve les origines LOB7 et le STUN Cloudflare déjà
prévus par la plateforme ; aucun serveur de jeu ou relais TURN n’a été ajouté.

La licence MIT du code ne s’étend pas aux enregistrements générés : une boucle
Suno et trois effets ElevenLabs. Leur provenance et leurs conditions distinctes
sont documentées dans `assets/audio/PROVENANCE.md` et `CREDITS.md`.

## Recette encore nécessaire après publication par Cédric

- Une partie complète de cette édition entre **deux navigateurs et deux comptes
  LOB7 distincts**, avec observation de la connexion et du résultat des deux
  côtés.
- Une revanche depuis les deux places, puis un départ propre, sur le vrai
  transport LOB7/WebRTC.
- Le rendu et le maniement sur le **véritable Android 10 avec Edge en mode
  « site pour ordinateur »**. Le viewport de bureau ne remplace pas ce test.
- Un retour de deux personnes sur la compréhension, les interactions, le
  plaisir de jeu et l’équilibrage.

Le serveur LOB7 n’autorise les salons que pour une édition hébergée exacte,
publiée et visible. La recette à deux comptes de ce nouveau jeu dépend donc de
la publication que Cédric effectuera lui-même. La recette réussie de Prism Pair
ne vaut pas recette de Glissumo ; réutiliser son salon avec d’autres fichiers
ne validerait pas cette édition.

Aucune publication LOB7, fusion de PR, modification ou déploiement de la
plateforme n’a été effectué. **L’annonce #59 reste inchangée en brouillon.**
