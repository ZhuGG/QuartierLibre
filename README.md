# Quartier Libre — Soleil / Lune

Jeu d’arcade pour choisir ses sorties à **Lyon 7e**. Deux identités de bornes, une seule affichée après le choix initial. Interface française en pixel art, roue Three.js réellement modélisée, commandes mécaniques, écran CRT et ticket de sortie.

## Lancer

Version en ligne : https://zhugg.github.io/QuartierLibre/

Le workflow `.github/workflows/deploy-pages.yml` vérifie les règles, compile puis déploie `dist/` à chaque envoi sur `main`. Le build GitHub utilise `GITHUB_PAGES=true` et le nom du dépôt fourni par `GITHUB_REPOSITORY` pour servir correctement les fichiers sous `/QuartierLibre/`. Les builds locaux conservent leur chemin racine.

Node.js 22.12+ ou 24+ et npm. Double-cliquer `Lancer-Quartier-Libre.cmd`, ou :

```sh
npm ci
npm run dev
```

Ouvrir http://127.0.0.1:5187. `npm run build` produit `dist/`, à servir par HTTP. `npm run preview` sert le build sur le port 4187. `npm test` vérifie le tirage, les filtres, les exclusions et l’alignement de la roue.

## Installer

Ouvrir Quartier Libre dans le navigateur. Utiliser « Installer » quand le bouton apparaît ou passer par le menu du navigateur. Sur iPhone, dans Safari, choisir Partager, puis « Sur l’écran d’accueil » et « Ouvrir comme app web » si l’option est proposée.

Après le premier chargement en ligne, les deux bornes, le carnet et les tirages restent accessibles hors connexion. La carte, l’agenda Ville Morte et « Un détour » utilisent des services en ligne. Le service worker est activé dans le build de production, sur une URL HTTPS ou dans un aperçu local sur `127.0.0.1`.

## Jouer

Choisir Soleil (journée) ou Lune (soirée), puis le quartier et l’activité. Tirer le levier vers le bas et relâcher, au doigt ou à la souris. Un clic simple sur le levier fonctionne aussi. Au clavier, maintenir Espace puis relâcher. Flèches gauche/droite ou sélecteur rotatif : changer d’activité. AUTRES LIEUX renouvelle les six adresses en conservant les filtres et privilégie celles absentes de la roue. Si moins de six autres lieux existent, la sélection est complétée avec les lieux déjà affichés ; si aucun autre n’existe, leur ordre change. RESET retire les filtres. Le son est désactivé par défaut ; SON ON active les sons du levier, du cliquet de la roue et du ticket. Les timbres diffèrent entre Soleil et Lune et sont synthétisés dans le navigateur.

L’amplitude du levier modifie l’élan, la durée et le nombre de tours. Le résultat est tiré uniformément parmi les lieux affichés. Une sélection aléatoire de six lieux maximum maintient la roue lisible. Les noms suivent la courbe de chaque segment, sur un ou deux arcs, en caractères gras. Le lettrage reste solidaire de la roue et la liste numérotée reprend les noms complets sous l’écran. Le nom sous le pointeur est repris en grand. Les trois dernières adresses sont écartées lorsque d’autres choix existent. Les favoris, le compteur et ces derniers tirages restent dans le stockage local du navigateur. Le levier pivote vers le joueur et revient par un mouvement de ressort ; le rendu reste dans la largeur de la borne sur petit écran.

Les mouvements réduits du système sont respectés. En cas d’absence de WebGL, un affichage de secours conserve le tirage et les fiches. Aucune donnée personnelle, aucun compte, aucune API payante.

Les filtres, le catalogue d’adresses, les commandes audio, l’aide et le dernier ticket sont intégrés à la borne. Le panneau Filtres s’ouvre à la demande ; le bouton Adresses affiche le catalogue sous les commandes. Sur mobile, la poignée et sa course restent à l’intérieur du meuble pour conserver son centrage. Les libellés fonctionnels utilisent une police plus lisible, tandis que les titres et les détails graphiques gardent le caractère pixel art.

La carte OpenStreetMap se charge à l’ouverture du ticket. L’adresse du lieu est convertie en coordonnées par la Géoplateforme de l’IGN. En cas d’échec, le lien de recherche OpenStreetMap reste disponible.

« Un détour » propose un lieu décrit par Wikipédia à moins de 650 mètres du lieu tiré. La distance est à vol d’oiseau. Le tirage Ville Morte consulte son agenda public et propose une sortie dans le 7e ce soir ou parmi les sept prochains jours. Chaque suggestion renvoie à l’annonce originale. Le ticket affiche également la prochaine annonce Ville Morte du lieu dans les sept jours, puis les autres dates à déplier.

## Données et extension

Les données sont isolées dans `src/data.js` et `src/places-extra.js` : identifiant, nom, quartier, catégorie, modes, adresse, description, URL source, date de consultation et disponibilité. Pour élargir ensuite le périmètre, ajouter les données et les filtres de quartier ; le moteur de jeu reste indépendant.

69 lieux sont intégrés, dont la MPT des Rancy dans le 3e. Le filtre « Tout le 7e » retire cette exception de proximité. Le Bouillon Paradis figure au carnet, hors tirage tant que son ouverture reste à vérifier. La Faute aux Ours a été retirée après signalement de sa fermeture par l’utilisateur. Les modes jour/nuit sont éditoriaux, pas des horaires en direct. La sélection n’est pas exhaustive. Les événements, conditions d’entrée et horaires doivent être vérifiés sur les sources liées depuis chaque fiche. Le Court-Circuit est inclus dans les tirages Soleil et Lune.

Les dates de consultation et les liens sont indiqués dans « À propos & sources » et dans les données. Ne pas confondre une date de consultation avec une garantie d’ouverture actuelle.

## Structure

- `src/main.js` : interface, commandes, stockage et état du jeu.
- `src/cabinet-hud.js`, `src/cabinet-hud.css` : commandes intégrées et disposition de la borne sur mobile.
- `src/wheel.js` : modélisation, éclairage et animation Three.js.
- `src/wheel-type.js` : composition du lettrage sur les arcs des segments.
- `src/data.js` : catalogue et règles pures testables.
- `src/sound.js` : synthèse sonore locale.
- `src/style.css`, `src/cabinet.css` et `src/arcade.css` : structure, deux variantes de borne, commandes mécaniques, éclairage et mise en page responsive.
- `public/assets/retro-bay.png` : décor de la baie technique.
- `public/assets/hub-sun.png`, `hub-moon.png` et `panel-grain.png` : badges pixel art et texture des panneaux.
- `public/assets/arcade-abstract-v1.png` : texture des cartes de choix et du bandeau de la borne.
- `public/assets/fonts/` : Press Start 2P, licence SIL OFL incluse.
- `docs/retro-bay-asset.md` : prompt du décor de la baie technique.

Three.js est sous licence MIT. Press Start 2P est sous licence SIL OFL, incluse avec la police.

## État des dépendances

Vite 8.3.8 et Three.js 0.185.1 sont verrouillés. Au 17 novembre 2026, `npm audit` signale encore une vulnérabilité de calcul de motifs dans Picomatch, dépendance de l’outillage de développement. La dernière version publiée consultée (4.0.7) reste dans la plage signalée. Picomatch n’est pas embarqué dans le site statique ; aucune rétrogradation forcée de Vite n’a été appliquée pour masquer cette alerte.
