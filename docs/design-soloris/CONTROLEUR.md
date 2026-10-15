# Contrôleur de périmètre — tests synthétiques

`scripts/controles/perimetre-design.mjs` remplace `controles/garde_fou_design.py` (cité par le cahier,
non fourni). Tests exécutés le 15/10/2026 sur la baseline `52ec190`, chaque modification étant annulée
après le test :

| Cas | Résultat attendu | Obtenu |
|---|---|---|
| Aucune modification applicative | accepté | accepté (code 0) |
| Espace ajouté à `QuoteForm.astro` | blocage | BLOCAGE « fichier gelé modifié » |
| CSS `.qform input { display:block }` | blocage | BLOCAGE « display/… sur un champ » |
| CSS avec `!important` | blocage | BLOCAGE |
| CSS conforme (couleur de bouton) | accepté | accepté |
| `<body class="x">` dans `Base.astro` | blocage | BLOCAGE « changement de layout hors activation » |
| `revealEstimation={false}` sur l'accueil (lot pages) | blocage | BLOCAGE « appels de composants sensibles modifiés » (après correction du contrôleur, qui ne comparait d'abord que les noms) |
| `id="rappel"` renommé (lot pages) | blocage | BLOCAGE « id supprimé » |
| Texte éditorial modifié (lot pages / lot visuel) | accepté / blocage | accepté / BLOCAGE « hors périmètre du lot visuel » |
| `<div>` inséré avant un `<QuoteForm>` (lot pages) | — | accepté : l'adjacence racine/script est interne à `QuoteForm.astro` (gelé) ; à couvrir par la recette navigateur |

Limite (comme le cahier) : le contrôle porte sur la source. Une règle CSS peut masquer un champ sans le
franchir ; `design-checks.mjs` compare donc la visibilité calculée de chaque élément de formulaire dans
le DOM rendu.
