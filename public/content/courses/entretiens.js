/* Cours « Entretiens » (étape 8, US-9d #97) : le processus de recrutement, la méthode STAR, les questions
   comportementales, parler de ses projets, les entretiens par métier et l'après-entretien. Leçons de théorie avec
   quiz ; l'entraînement chronométré se fait dans les entretiens blancs (page Certifs). */
const PRATIQUE = `<p><strong>Entraîne-toi pour de vrai</strong> : enregistre-toi (vidéo ou audio) en répondant à voix haute, réécoute, coupe tout ce qui dépasse deux minutes. Puis fais un entretien blanc avec une personne qui joue le recruteur, en français puis en anglais.</p>`;

export default {
  id: "entretiens", route: "entretiens", badge: "INT", name: "Entretiens", tag: "Recrutement · STAR · métiers", lang: "py",
  blurb: "Tout ce qui entoure le code : le processus de recrutement tech, la méthode STAR et ta banque d'histoires, les questions comportementales en français et en anglais, parler de tes projets, les entretiens DevOps, ML et embarqué, puis négocier et suivre.",
  note: "Ces leçons se travaillent à voix haute. Les entretiens techniques blancs, chronométrés et corrigés, sont sur la page Certifs : DevOps et Cloud, ML, embarqué.",
  lessons: [
    {
      id: "it-01", section: "Préparer", title: "Le processus de recrutement tech", xp: 50, theoryOnly: true,
      theory: `<p>Un recrutement de développeur, d'ingénieur DevOps ou d'ingénieur ML suit presque toujours les mêmes étapes, sur deux à six semaines :</p>
~~~text
1. Candidature       CV lu d'abord par un logiciel de suivi (ATS) puis par un humain, souvent en moins d'une minute
2. Appel de tri      15 à 30 min avec un recruteur : parcours, motivation, disponibilité, salaire, langues
3. Test technique    exercice en ligne chronométré (algorithmes) ou travail à la maison (petit projet)
4. Entretien(s)      code en direct, questions techniques du métier, system design pour les profils expérimentés
5. Comportemental    travail en équipe, conflits, échecs, motivation : la méthode STAR
6. Références, offre vérification des références, proposition, négociation
~~~
<p>Ce qui fait passer chaque étape :</p>
<ul><li><strong>CV</strong> : une page pour un junior, des verbes d'action et des résultats chiffrés, les mots-clés de l'offre (l'ATS les cherche), un lien GitHub avec des projets lisibles ;</li><li><strong>tri</strong> : un récit de deux minutes « qui je suis, ce que je sais faire, ce que je cherche », et une fourchette de salaire préparée ;</li><li><strong>technique</strong> : la démarche à voix haute compte autant que la solution (cours Algorithmique et System design) ;</li><li><strong>comportemental</strong> : des histoires vraies, préparées, structurées.</li></ul>
<p>Au Québec et dans la région d'Ottawa-Gatineau, beaucoup de postes demandent le français et l'anglais : prépare ton récit et tes histoires dans les deux langues. Les stages et les programmes pour nouveaux diplômés recrutent souvent six à neuf mois à l'avance.</p>`,
      setup: PRATIQUE,
      quiz: [
        { q: "Pourquoi reprendre les mots-clés de l'offre dans son CV ?", options: ["Par politesse", "Un logiciel de suivi des candidatures (ATS) filtre souvent les CV sur ces mots avant qu'un humain les lise", "Pour allonger le CV", "C'est inutile"], answer: 1, explain: "Sans les bons mots-clés, un bon profil peut être écarté automatiquement. Ils doivent rester vrais." },
        { q: "Pendant l'appel de tri, on te demande tes attentes salariales. La meilleure préparation ?", options: ["Dire « je ne sais pas »", "Une fourchette réaliste, fondée sur des données du marché pour ce poste et cette ville", "Le salaire le plus haut possible", "Refuser de répondre"], answer: 1, explain: "Les sources sont listées dans la dernière leçon du cours." }
      ]
    },
    {
      id: "it-02", section: "Préparer", title: "La méthode STAR et ta banque d'histoires", xp: 60, theoryOnly: true,
      theory: `<p>Les questions comportementales (« Parle-moi d'une fois où… ») cherchent à prédire ton comportement futur à partir de ton passé. La méthode <strong>STAR</strong> structure une réponse de deux minutes :</p>
~~~text
S  Situation   le contexte en une ou deux phrases : où, quand, quel enjeu
T  Tâche       ce qui t'incombait à toi, précisément
A  Action      ce que TU as fait (dis « je », pas « on »), étape par étape : c'est le cœur, environ 60 % du temps
R  Résultat    l'effet, chiffré si possible, et ce que tu en as appris
~~~
<p>Exemple, pour « Parle-moi d'un problème technique difficile » :</p>
<blockquote><p><em>S</em> : pendant mon stage, notre pipeline de déploiement échouait une fois sur cinq, sans message clair. <em>T</em> : on m'a confié de le fiabiliser avant une mise en production. <em>A</em> : j'ai d'abord ajouté des journaux à chaque étape, ce qui a montré que les échecs venaient d'un test dépendant de l'heure ; je l'ai isolé, rendu déterministe en injectant l'horloge, puis j'ai ajouté une relance automatique limitée aux erreurs réseau. <em>R</em> : plus aucun échec aléatoire pendant les trois mois suivants, et l'équipe a repris la même technique sur deux autres projets.</p></blockquote>
<p>Prépare une <strong>banque de 6 à 8 histoires</strong> vraies, chacune adaptable à plusieurs questions : une réussite technique, un échec et ce que tu en as tiré, un désaccord, une situation d'urgence, un apprentissage rapide, une initiative, un travail d'équipe difficile, un retour critique reçu. Tes projets d'études, de stage, ce site, un laboratoire refait sur ta machine : tout compte, s'il y a une décision et un résultat.</p>`,
      setup: PRATIQUE,
      practice: { title: "S'entraîner", body: `<p>Écris tes 6 à 8 histoires dans un tableau : une ligne par histoire, une colonne par lettre STAR, et une colonne avec les questions auxquelles elle répond. Raconte chacune à voix haute en moins de deux minutes, en français puis en anglais. Coupe tout ce qui n'est pas ton action.</p>` },
      quiz: [
        { q: "Dans une réponse STAR, quelle partie doit prendre le plus de temps ?", options: ["La situation", "La tâche", "L'action, ce que tu as fait personnellement", "Le résultat"], answer: 2, explain: "Le recruteur évalue ce que toi tu fais ; une longue mise en contexte le perd." },
        { q: "Pourquoi dire « je » plutôt que « on » dans l'action ?", options: ["Par vanité", "Le recruteur doit distinguer ta contribution de celle de l'équipe", "C'est plus court", "Les deux sont équivalents"], answer: 1, explain: "On peut reconnaître le travail d'équipe dans la situation ou le résultat." }
      ]
    },
    {
      id: "it-03", section: "Préparer", title: "Questions comportementales, en français et en anglais", xp: 60, theoryOnly: true,
      theory: `<p>Les plus fréquentes, avec ce qu'elles cherchent vraiment et l'histoire à mobiliser :</p>
<div class="qa">
<details><summary>Présente-toi. / Tell me about yourself.</summary><p>Ton récit de deux minutes : présent (ce que tu fais), passé (le chemin qui y mène), futur (pourquoi ce poste). Pas ta biographie, pas tout ton CV.</p></details>
<details><summary>Pourquoi ce poste, pourquoi nous ? / Why this role, why us?</summary><p>Ce que tu sais de l'entreprise (produit, technologies, valeurs) et le lien avec ce que tu as déjà fait. Ne jamais dire « je cherche juste un stage ».</p></details>
<details><summary>Parle-moi d'un échec. / Tell me about a time you failed.</summary><p>Un vrai échec, assumé, et surtout ce que tu as changé depuis. Le piège : un faux échec (« je travaille trop »).</p></details>
<details><summary>Un désaccord avec un collègue ou un responsable ? / A conflict with a teammate?</summary><p>Montrer qu'on écoute, qu'on argumente avec des faits, et qu'on s'aligne une fois la décision prise (disagree and commit). Jamais dénigrer l'autre.</p></details>
<details><summary>Une fois où tu as dû apprendre très vite ? / Learning something new quickly?</summary><p>Ta méthode : documentation officielle, petit prototype, questions ciblées, et le résultat livré dans les temps.</p></details>
<details><summary>Une situation sous pression ou une urgence ? / Working under pressure?</summary><p>Priorisation, communication avec les personnes touchées, et ce que tu as mis en place pour que ça ne se reproduise pas (le postmortem).</p></details>
<details><summary>Quel est ton principal défaut ? / What is your biggest weakness?</summary><p>Un vrai point à améliorer, sans rapport avec le cœur du poste, et ce que tu fais concrètement pour progresser.</p></details>
<details><summary>Où te vois-tu dans cinq ans ? / Where do you see yourself in five years?</summary><p>Une trajectoire cohérente avec le poste : approfondir un domaine, prendre des responsabilités, sans annoncer que tu partiras.</p></details>
</div>
<p>Vocabulaire utile en anglais : <em>I was responsible for…</em>, <em>I decided to…</em>, <em>As a result, …</em>, <em>What I learned is…</em>, <em>In hindsight, I would…</em>. Un accent ne pose aucun problème ; une réponse désorganisée, si.</p>`,
      setup: PRATIQUE,
      quiz: [
        { q: "« Quel est ton plus grand défaut ? » La meilleure approche ?", options: ["« Je suis trop perfectionniste »", "Un vrai point faible, sans rapport avec le cœur du poste, avec ce que tu fais pour t'améliorer", "Dire que tu n'en as pas", "Citer un défaut rédhibitoire pour le poste"], answer: 1, explain: "Les faux défauts sont repérés tout de suite et nuisent à la crédibilité." },
        { q: "Face à une question sur un conflit, que faut-il éviter ?", options: ["Expliquer les faits", "Dénigrer le collègue ou le responsable", "Montrer comment la décision a été prise", "Dire ce que tu as appris"], answer: 1, explain: "Le recruteur se demande comment tu parleras de lui plus tard." }
      ]
    },
    {
      id: "it-04", section: "Préparer", title: "Parler de ses projets techniques", xp: 60, theoryOnly: true,
      theory: `<p>« Présente-moi un projet dont tu es fier » ouvre presque tous les entretiens techniques de junior. Une bonne présentation tient en trois minutes et suit ce plan :</p>
~~~text
1. Le problème        pour qui, quel besoin, en une phrase
2. L'architecture     un schéma mental simple : composants, données, déploiement
3. Tes choix          deux ou trois décisions et leurs alternatives (pourquoi Pyodide plutôt qu'un serveur ?)
4. La difficulté      le bogue ou l'obstacle le plus intéressant, et comment tu l'as résolu
5. Le résultat        chiffres : utilisateurs, temps gagné, couverture de tests, coût, latence
6. Le recul           ce que tu referais autrement aujourd'hui
~~~
<p>Le recruteur va creuser : « pourquoi ce choix ? », « que se passe-t-il si la charge est multipliée par dix ? », « comment l'as-tu testé ? ». Ce sont des occasions de montrer ta compréhension, pas des pièges. Connais chaque ligne de ce que tu présentes : un projet copié se voit au deuxième « pourquoi ».</p>
<p>Ce qui rend un projet convaincant sur GitHub : un README qui explique le but, l'architecture et comment le lancer en une commande ; des tests et une CI verte ; un historique de commits lisible ; une démo en ligne. Un seul projet soigné vaut mieux que dix tutoriels recopiés.</p>`,
      setup: PRATIQUE,
      practice: { title: "S'entraîner", body: `<p>Choisis ton meilleur projet et prépare sa présentation en six points, avec un schéma dessinable en une minute. Fais-toi poser cinq « pourquoi » d'affilée sur tes choix par quelqu'un qui ne connaît pas le projet. Mets à jour son README pour qu'un recruteur comprenne tout en deux minutes.</p>` },
      quiz: [
        { q: "Le recruteur demande « pourquoi as-tu choisi cette base de données ? ». Que veut-il savoir ?", options: ["Si tu connais le nom d'autres bases", "Si tu as pesé des alternatives et compris les compromis de ton choix", "Si tu as suivi un tutoriel", "Rien de particulier"], answer: 1, explain: "« Parce que c'était dans le tutoriel » est la réponse qui fait le plus de tort." },
        { q: "Qu'est-ce qui rend un dépôt GitHub convaincant pour un recruteur ?", options: ["Beaucoup de dépôts", "Un README clair, des tests et une CI verte, un historique lisible, une démo", "Un code sans commentaires", "Des commits tous nommés « update »"], answer: 1, explain: "Le recruteur passe souvent moins de deux minutes sur un dépôt." }
      ]
    },
    {
      id: "it-05", section: "Par métier", title: "Les entretiens DevOps, ML et embarqué", xp: 60, theoryOnly: true,
      theory: `<p>Chaque métier a ses questions types. Les entretiens blancs chronométrés de la page Certifs couvrent chacun : <a href="#cert-entretien-devops">DevOps, SRE et Cloud</a>, <a href="#cert-entretien-ml">ML et MLOps</a>, <a href="#cert-entretien-embarque">embarqué et firmware</a>.</p>
~~~text
DevOps / SRE / Cloud
  Diagnostic       « le site est lent », « le pod redémarre en boucle » : démarche ordonnée, commandes précises
  Conception       un pipeline CI/CD complet, une infrastructure Terraform, une architecture AWS à haute disponibilité
  Culture          incidents et postmortems, SLO, automatisation, sécurité dans le pipeline
  Cours Boucle     Linux, Docker, Kubernetes, CI/CD, Terraform, AWS, SRE, System design

ML / MLOps
  Fondamentaux     métriques, validation, surapprentissage, fuite de données, classes déséquilibrées
  Cas pratique     « prédire le départ des clients » : données, métrique, modèle de base, évaluation, mise en production
  Production       servir un modèle, surveiller la dérive, réentraîner, versionner données et modèles
  Cours Boucle     Data, SQL, Deep learning, API et tests

Embarqué / firmware
  C bas niveau     volatile, masques de bits, pointeurs, débordements, boutisme
  Matériel         lire une datasheet, dimensionner une résistance, diagnostiquer un bus I2C à l'analyseur logique
  Système          interruptions, RTOS, énergie, watchdog, mise à jour à distance
  Cours Boucle     Électronique, Logique numérique, C embarqué
~~~
<p>Dans tous les cas, on attend la même posture : dire ce qu'on vérifie et pourquoi, annoncer ses hypothèses, reconnaître ce qu'on ne sait pas et expliquer comment on le trouverait. « Je ne sais pas, mais je chercherais dans la documentation de… et je testerais… » vaut mieux qu'une invention.</p>`,
      setup: PRATIQUE,
      quiz: [
        { q: "On te pose une question technique dont tu ignores la réponse. Que faire ?", options: ["Inventer une réponse plausible", "Le dire, puis expliquer comment tu raisonnerais et où tu chercherais", "Changer de sujet", "Te taire"], answer: 1, explain: "Les recruteurs testent aussi l'honnêteté et la méthode." },
        { q: "« Le site est lent » en entretien DevOps : qu'attend-on d'abord ?", options: ["Ajouter des serveurs", "Une démarche : préciser le symptôme, mesurer (latences, erreurs, saturation), isoler le composant, puis agir", "Redémarrer tout", "Changer de langage"], answer: 1, explain: "Les quatre signaux d'or guident le diagnostic." }
      ]
    },
    {
      id: "it-06", section: "Conclure", title: "Poser ses questions, négocier et suivre", xp: 60, theoryOnly: true,
      theory: `<p>À la fin, « Avez-vous des questions ? » n'est pas une formalité : ne rien demander passe pour un manque d'intérêt. Prépare-en trois ou quatre :</p>
<ul><li>« À quoi ressemble une journée type dans l'équipe ? Comment se passe un déploiement ? »</li><li>« Comment l'équipe gère-t-elle les incidents et l'astreinte ? »</li><li>« Qu'attendez-vous de la personne recrutée à trois mois, à six mois ? »</li><li>« Quel accompagnement pour un junior : mentorat, revue de code, formation ? »</li></ul>
<p><strong>Après l'entretien</strong> : un court message de remerciement dans les 24 heures, qui rappelle un point précis de l'échange. Sans nouvelle après le délai annoncé, une relance polie. Note pour toi les questions posées : elles reviendront ailleurs.</p>
<p><strong>Le salaire</strong> : renseigne-toi avant le premier appel. Sources pour le Canada : le Guichet-Emplois du gouvernement du Canada (salaires par métier et par région), les rapports salariaux des agences de recrutement, Glassdoor et Levels.fyi pour les grandes entreprises. Donne une fourchette, laisse de la place pour négocier, et compare les offres dans leur ensemble : salaire, horaires, télétravail, formation, assurances, régime de retraite, et ce que tu apprendras. Une offre se négocie poliment, avec des arguments (une autre offre, une compétence rare), et presque jamais par écrit sous le coup de l'émotion.</p>`,
      setup: PRATIQUE,
      quiz: [
        { q: "Le recruteur demande : « Avez-vous des questions ? » Meilleure réaction ?", options: ["« Non, tout est clair »", "Deux ou trois questions préparées sur l'équipe, les pratiques et les attentes", "Demander le salaire en premier", "Demander combien de candidats restent"], answer: 1, explain: "Les questions montrent ton intérêt et t'aident à choisir aussi." },
        { q: "Tu reçois une offre un peu en dessous de ta fourchette. Que faire ?", options: ["Refuser sèchement", "Remercier, puis négocier poliment avec des arguments, en regardant l'offre dans son ensemble", "Accepter sans rien dire", "Ignorer le message"], answer: 1, explain: "Une demande argumentée et courtoise est normale et attendue." }
      ]
    }
  ]
};
