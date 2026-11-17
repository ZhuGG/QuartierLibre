# Quartier Libre — Soleil / Lune

Réécriture de [Neversmoonsun](https://github.com/ZhuGG/Neversmoonsun) pour les sorties à **Lyon 7e**. Deux identités de bornes d’arcade, une seule affichée après le choix initial. Interface française en pixel art, roue Three.js réellement modélisée, boutons physiques, écran CRT et ticket de sortie.

## Lancer

Node.js 22.12+ ou 24+ et npm. Double-cliquer `Lancer-Quartier-Libre.cmd`, ou :

```sh
npm ci
npm run dev
```

Ouvrir http://127.0.0.1:5187. `npm run build` produit `dist/`, à servir par HTTP. `npm run preview` sert le build sur le port 4187. `npm test` vérifie le tirage, les filtres, les exclusions et l’alignement de la roue.

## Jouer

Choisir Soleil (journée) ou Lune (soirée), puis le quartier et l’envie. Tirer le levier vers le bas et relâcher, au doigt ou à la souris. Un clic simple sur le levier fonctionne aussi. Au clavier, maintenir Espace puis relâcher. Flèches gauche/droite ou joystick : changer d’envie. RESET : retirer tous les filtres. Le son est désactivé par défaut ; SON ON active les sons synthétisés par Web Audio.

L’amplitude du levier modifie l’élan, la durée et le nombre de tours. Le résultat est tiré uniformément parmi les lieux affichés. Une sélection aléatoire de six lieux maximum maintient la roue lisible ; chaque lieu éligible a la même probabilité d’intégrer cette sélection. Les noms apparaissent sur deux lignes et sont repris dans un bandeau sous la roue. Les trois dernières adresses sont écartées lorsque d’autres choix existent. Les favoris, le compteur et ces derniers tirages restent dans le stockage local du navigateur.

Les mouvements réduits du système sont respectés. En cas d’absence de WebGL, un affichage de secours conserve le tirage et les fiches. Aucune donnée personnelle, aucun compte, aucune API payante.

## Données et extension

Les données sont isolées dans `src/data.js` : identifiant, nom, quartier, catégorie, modes, adresse, description, URL source, date de consultation et disponibilité. Pour élargir ensuite le périmètre, ajouter les données et les filtres de quartier ; le moteur de jeu reste indépendant.

22 lieux sont intégrés, dont les sept exemples demandés. Les modes jour/nuit sont éditoriaux, pas des horaires en direct. La sélection n’est pas exhaustive. Les événements, conditions d’entrée et horaires doivent être vérifiés sur les sources liées depuis chaque fiche. Le Court-Circuit reste au carnet mais est exclu des tirages tant que son statut après une fermeture temporaire signalée en novembre 2026 n’est pas revérifié.

Les sources ont été consultées le 17 novembre 2026. Le détail des liens est disponible dans « À propos & sources » et les données. Ne pas confondre une date de consultation avec une garantie d’ouverture actuelle.

## Structure

- `src/main.js` : interface, commandes, stockage et état du jeu.
- `src/wheel.js` : modélisation, éclairage et animation Three.js.
- `src/data.js` : catalogue et règles pures testables.
- `src/sound.js` : synthèse sonore locale.
- `src/style.css` et `src/cabinet.css` : deux variantes de borne, levier et mise en page responsive.
- `public/assets/guillotiere.png` : décor pixel art original généré avec le mode intégré imagegen.
- `public/assets/fonts/` : Press Start 2P, licence SIL OFL incluse.
- `docs/guillotiere-asset.md` : prompt du décor intégré ; le premier essai non retenu est décrit dans `docs/asset-prompts.md`.
- `legacy-original.html` et `assets/` : version historique et ses assets, conservés pour référence ; non utilisés dans la nouvelle application.

Three.js est sous licence MIT. Le code et les assets du dépôt historique restent soumis à leurs droits d’origine ; aucune nouvelle licence n’est présumée pour eux.

## État des dépendances

Vite 8.3.8 et Three.js 0.185.1 sont verrouillés. Au 17 novembre 2026, `npm audit` signale encore une vulnérabilité de calcul de motifs dans Picomatch, dépendance de l’outillage de développement. La dernière version publiée consultée (4.0.7) reste dans la plage signalée. Picomatch n’est pas embarqué dans le site statique ; aucune rétrogradation forcée de Vite n’a été appliquée pour masquer cette alerte.
