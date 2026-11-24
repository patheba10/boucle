/* Exercices courts (audit #6) : prédire la sortie, compléter le code, remettre les lignes dans l'ordre.
   Format dans une leçon : exercices: [
     { type: "sortie", code, reponse, explain },              // l'élève écrit ce que le code affiche
     { type: "trous", code: "… ⟦réponse⟧ … ⟦a§b⟧ …", explain },  // une ou plusieurs réponses acceptées par trou, séparées par §
     { type: "ordre", lignes: [... dans le bon ordre], avant, apres, explain } ]   // présentées mélangées ; avant et apres :
                                                                             // code fixe affiché autour des lignes
   Chaque exercice peut avoir `indices` (textes, du plus général au plus précis) ; des indices calculés suivent.
   Le langage est celui de la leçon (ou `lang` sur l'exercice). scripts/validate.mjs exécute chaque code pour vérifier
   que la réponse attendue est juste. Les fonctions de correction sont pures et testées (tests/unit/exercices.test.mjs). */
import { esc, $, $$, norm } from "./util.js";
import { libelleIndice } from "./indices.js";

export const XP_EXERCICE = 5;
const TROU = /⟦([\s\S]+?)⟧/g;  // ⟦ ⟧ plutôt que [[ ]], qui apparaît dans du vrai code (listes de listes)

/** Les réponses acceptées pour chaque trou. */
export function trous(code) {
  return [...code.matchAll(TROU)].map((m) => m[1].split("§").map((s) => s.trim()));
}
/** Le programme complet d'un exercice « ordre » : code fixe avant, lignes, code fixe après. */
export const codeOrdre = (ex) => [ex.avant, ...ex.lignes, ex.apres].filter((x) => x != null).map((x) => x.replace(/^\n|\n$/g, "")).join("\n");
/** Le code complété avec la première réponse de chaque trou (pour l'exécuter en CI). */
export const codeComplet = (code) => code.replace(TROU, (_, r) => r.split("§")[0].trim());
/** Les morceaux de texte autour des trous. */
const morceaux = (code) => code.split(TROU).filter((_, i) => i % 2 === 0);

const compacte = (s) => droits(s).trim().replace(/\s+/g, " ").replace(/\s*([()[\]{},;:+\-*/%<>=!&|^.])\s*/g, "$1");
/** Guillemets typographiques (correcteur du clavier) et espaces insécables ramenés à leur forme simple. */
const droits = (s) => String(s).replace(/[\u201C\u201D\u201E]/g, '"').replace(/[\u2018\u2019\u201A]/g, "'").replace(/[\u00A0\u202F]/g, " ");
export const verifierSortie = (ex, saisie) => norm(droits(saisie)) === norm(droits(ex.reponse));
/** Une réponse de trou est juste si elle égale l'une des réponses acceptées, aux espaces près autour des opérateurs. */
export const verifierTrous = (ex, saisies) => trous(ex.code).map((ok, i) => ok.some((r) => compacte(r) === compacte(saisies[i] || "")));
export const verifierOrdre = (ex, ordre) => ordre.every((k, i) => ex.lignes[k] === ex.lignes[i]);

const pluriel = (n, mot) => n + " " + mot + (n > 1 ? "s" : "");
const sansEspaces = (s) => s.replace(/\s+/g, "");
const sansGuillemets = (s) => s.replace(/["']/g, "");

/** Ce qui cloche dans une réponse fausse, sans donner la réponse. `reponse` : le texte saisi (sortie), la liste
    des saisies (trous) ou l'ordre des lignes (ordre). Renvoie un texte (le code est entre @@ @@). */
export function diagnostic(ex, reponse, lang) {
  if (ex.type === "sortie") {
    if (!String(reponse || "").trim()) return "Écris ce que le programme affiche, une ligne par affichage.";
    const a = norm(droits(ex.reponse)).split("\n"), s = norm(droits(reponse)).split("\n");
    if (s.length !== a.length) return "Le programme affiche " + pluriel(a.length, "ligne") + ", ta réponse en a " + s.length + ". " + (lang === "py" ? "Chaque @@print@@ écrit une ligne." : "Repère chaque saut de ligne.");
    const fausses = a.map((l, i) => i).filter((i) => s[i] !== a[i]), k = fausses[0], n = k + 1;
    if (s[k].toLowerCase() === a[k].toLowerCase()) return "Presque : ligne " + n + ", seules les majuscules et minuscules diffèrent. Le programme affiche le texte exactement comme il est écrit.";
    if (sansEspaces(s[k]) === sansEspaces(a[k])) return "Presque : ligne " + n + ", ce sont les espaces." + (lang === "py" ? " Une virgule dans @@print@@ ajoute une espace entre les valeurs." : "");
    if (sansGuillemets(s[k]) === sansGuillemets(a[k])) return "Presque : ligne " + n + ", ce sont les guillemets. Ceux qui entourent une chaîne ne s'affichent pas ; ceux qui sont à l'intérieur, si.";
    return "La ligne " + n + " n'est pas juste" + (fausses.length > 1 ? " (" + pluriel(fausses.length, "ligne") + " à revoir)" : "") + ". Suis le code ligne par ligne, en notant la valeur de chaque variable.";
  }
  if (ex.type === "trous") {
    const t = trous(ex.code), saisies = reponse || [], res = verifierTrous(ex, saisies);
    const faux = res.map((r, i) => i).filter((i) => !res[i]);
    const casse = faux.filter((i) => t[i].some((r) => compacte(r).toLowerCase() === compacte(saisies[i] || "").toLowerCase()));
    const vides = faux.filter((i) => !String(saisies[i] || "").trim());
    return pluriel(faux.length, "trou") + " à revoir, en rouge." +
      (casse.length ? " Trou " + casse.map((i) => i + 1).join(", ") + " : attention aux majuscules et minuscules, le langage les distingue." : "") +
      (vides.length === faux.length ? "" : vides.length ? " " + (vides.length > 1 ? "Des trous sont restés vides." : "Un trou est resté vide.") : "");
  }
  const places = reponse.filter((k, i) => ex.lignes[k] === ex.lignes[i]).length;
  return (places ? pluriel(places, "ligne") + " sur " + ex.lignes.length + (places > 1 ? " sont déjà à leur place." : " est déjà à sa place.") : "Aucune ligne n'est encore à sa place.") + " Pense à ce qui doit exister avant d'être utilisé.";
}

/** Indices d'un exercice, du plus général au plus précis : ceux de l'auteur (`indices`), puis des indices calculés
    à partir de la réponse. Le dernier ne donne jamais toute la réponse. */
export function indicesExercice(ex) {
  const auteur = Array.isArray(ex.indices) ? ex.indices.slice() : [];
  const auto = [];
  if (ex.type === "sortie") {
    const a = norm(ex.reponse).split("\n");
    auto.push("Le programme affiche " + pluriel(a.length, "ligne") + ".");
    if (a.length > 1) auto.push("La première ligne est @@" + a[0] + "@@.");
    else {
      const mots = a[0].trim().split(/\s+/);
      auto.push(mots.length > 1 ? "Elle commence par @@" + mots[0] + "@@." : "Elle fait " + pluriel(a[0].length, "caractère") + ".");
    }
  } else if (ex.type === "trous") {
    const t = trous(ex.code).map((r) => r[0]);
    auto.push(t.map((r, i) => (t.length > 1 ? "Trou " + (i + 1) + " : " : "Le trou fait ") + pluriel(r.length, "caractère")).join(" ; ") + ".");
    const longs = t.map((r, i) => [r, i]).filter(([r]) => r.length > 1);
    if (longs.length) auto.push(longs.map(([r, i]) => (t.length > 1 ? "Le trou " + (i + 1) : "Il") + " commence par @@" + r[0] + "@@").join(" ; ") + ".");
  } else if (ex.type === "ordre") {
    const l = ex.lignes;
    auto.push("La première ligne est @@" + l[0].trim() + "@@.");
    if (l.length > 3) auto.push("La dernière ligne est @@" + l[l.length - 1].trim() + "@@.");
  }
  return auteur.concat(auto);
}

/** Mélange déterministe (même ordre à chaque visite), jamais identique à l'ordre correct. */
export function melange(n, graine) {
  let h = 2166136261;
  for (const c of graine) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const alea = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const ordre = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [ordre[i], ordre[j]] = [ordre[j], ordre[i]]; }
  if (n > 1 && ordre.every((k, i) => k === i)) ordre.push(ordre.shift());
  return ordre;
}

/** Texte avec du code entre @@ @@, échappé une seule fois. */
const texte = (s) => String(s).split(/@@([\s\S]+?)@@/).map((p, i) => (i % 2 ? "<code>" + esc(p) + "</code>" : esc(p))).join("");

const TITRES = { sortie: "Que va afficher ce code ?", trous: "Complète le code", ordre: "Remets les lignes dans l'ordre" };

export function exercicesHTML(l, L, highlight, lang, I) {
  const exs = l.exercices || [];
  if (!exs.length) return "";
  const faits = exs.filter((_, i) => L.ex && L.ex[i]).length;
  return '<section class="card block" id="exercices"><div class="block-h"><span class="n">' + I.target + '</span><h2>Exercices</h2><span class="chip' + (faits === exs.length ? " ok" : " acc") + '" data-ex-chip>' + (faits === exs.length ? I.check + "Réussis" : faits + " / " + exs.length) + "</span></div>" +
    exs.map((ex, i) => {
      const lg = ex.lang || lang; const fait = !!(L.ex && L.ex[i]);
      let corps = "";
      if (ex.type === "sortie") corps = '<pre class="ex-code">' + highlight(ex.code, lg) + '</pre><label class="ex-l">Sortie du programme</label><textarea class="ex-saisie" rows="' + Math.min(8, ex.reponse.split("\n").length + 1) + '" spellcheck="false">' + (fait ? esc(ex.reponse) : "") + "</textarea>";
      else if (ex.type === "trous") {
        const parts = morceaux(ex.code), t = trous(ex.code);
        corps = '<pre class="ex-code">' + parts.map((p, k) => esc(p) + (k < t.length ? '<input class="trou" size="' + Math.max(3, t[k][0].length + 1) + '" spellcheck="false" autocomplete="off" aria-label="Trou ' + (k + 1) + '" value="' + (fait ? esc(t[k][0]) : "") + '">' : "")).join("") + "</pre>";
      } else if (ex.type === "ordre") {
        const ordre = fait ? ex.lignes.map((_, k) => k) : melange(ex.lignes.length, l.id + "/" + i);
        corps = (ex.avant ? '<pre class="ex-code ex-fixe">' + highlight(ex.avant.replace(/\n$/, ""), lg) + "</pre>" : "") +
          '<ol class="ex-ordre" data-ordre="' + ordre.join(",") + '">' + ordre.map((k) => ligneHTML(ex.lignes[k], lg, highlight)).join("") + "</ol>" +
          (ex.apres ? '<pre class="ex-code ex-fixe">' + highlight(ex.apres.replace(/^\n/, ""), lg) + "</pre>" : "");
      }
      return '<div class="ex' + (fait ? " fait" : "") + '" data-ex="' + i + '"><p class="quiz-q">' + (i + 1) + ". " + TITRES[ex.type] + "</p>" + (ex.consigne ? '<p class="ex-consigne">' + texte(ex.consigne) + "</p>" : "") + corps +
        '<div class="row"><button class="btn sm' + (fait ? "" : " primary") + '" type="button" data-ex-verif>' + (fait ? "Réussi" : "Vérifier") + "</button>" +
        (fait ? "" : '<button class="btn sm" type="button" data-ex-indice>' + I.bulb + "<span>" + libelleIndice(indicesExercice(ex), 0) + "</span></button>") +
        '</div><div data-ex-indices></div><div data-ex-fb>' + (fait ? '<p class="explain"><b>Exact.</b> ' + texte(ex.explain) + "</p>" : "") + "</div></div>";
    }).join("") + "</section>";
}

function ligneHTML(texte, lg, highlight) {
  const ind = texte.length - texte.trimStart().length; // indentation rendue en marge, réduite sur petit écran
  return '<li><code style="--ind:' + ind + '">' + highlight(texte.trimStart(), lg) + '</code><span class="ex-fl"><button type="button" class="ex-fleche" data-monter aria-label="Monter">↑</button><button type="button" class="ex-fleche" data-descendre aria-label="Descendre">↓</button></span></li>';
}

export function bindExercices(l, L, { gain, highlight, lang, I }) {
  const exs = l.exercices || [];
  $$("[data-ex]").forEach((bloc) => {
    const i = +bloc.dataset.ex; const ex = exs[i]; const lg = ex.lang || lang; const fb = $("[data-ex-fb]", bloc);
    if (ex.type === "ordre") {
      const ol = $(".ex-ordre", bloc);
      ol.addEventListener("click", (e) => {
        const b = e.target.closest("[data-monter],[data-descendre]"); if (!b) return;
        const li = b.closest("li"); const items = [...ol.children]; const k = items.indexOf(li);
        const j = b.hasAttribute("data-monter") ? k - 1 : k + 1; if (j < 0 || j >= items.length) return;
        const ordre = ol.dataset.ordre.split(",").map(Number); [ordre[k], ordre[j]] = [ordre[j], ordre[k]]; ol.dataset.ordre = ordre.join(",");
        ol.innerHTML = ordre.map((x) => ligneHTML(ex.lignes[x], lg, highlight)).join("");
        const nouv = ol.children[j]; const cible = nouv && nouv.querySelector(b.hasAttribute("data-monter") ? "[data-monter]" : "[data-descendre]"); if (cible) cible.focus();
      });
    }
    const bIndice = $("[data-ex-indice]", bloc);
    if (bIndice) {
      const liste = indicesExercice(ex); let n = 0;
      bIndice.addEventListener("click", () => {
        if (n < liste.length) n++;
        $("[data-ex-indices]", bloc).innerHTML = '<div class="hint-box">' + liste.slice(0, n).map((t, k) => "<p><b>Indice " + (k + 1) + (liste.length > 1 ? " / " + liste.length : "") + ".</b> " + texte(t) + "</p>").join("") + "</div>";
        $("span", bIndice).textContent = libelleIndice(liste, n);
        bIndice.disabled = n >= liste.length;
      });
    }
    $("[data-ex-verif]", bloc).addEventListener("click", () => {
      let ok = false, rep;
      if (ex.type === "sortie") { rep = $(".ex-saisie", bloc).value; ok = verifierSortie(ex, rep); }
      else if (ex.type === "trous") {
        const champs = $$(".trou", bloc); rep = champs.map((c) => c.value); const res = verifierTrous(ex, rep);
        champs.forEach((c, k) => c.classList.toggle("faux", !res[k])); ok = res.every(Boolean);
      } else { rep = $(".ex-ordre", bloc).dataset.ordre.split(",").map(Number); ok = verifierOrdre(ex, rep); }
      if (ok) {
        fb.innerHTML = '<p class="explain"><b>Exact.</b> ' + texte(ex.explain) + "</p>";
        bloc.classList.add("fait");
        if (bIndice) bIndice.remove();
        if (!(L.ex && L.ex[i])) { L.ex = L.ex || {}; L.ex[i] = true; gain(XP_EXERCICE, "exercice réussi"); }
        const faits = exs.filter((_, k) => L.ex[k]).length; const chip = $("[data-ex-chip]");
        if (chip) { chip.className = "chip" + (faits === exs.length ? " ok" : " acc"); chip.innerHTML = faits === exs.length ? I.check + "Réussis" : faits + " / " + exs.length; }
      } else {
        fb.innerHTML = '<p class="explain no"><b>Pas encore.</b> ' + texte(diagnostic(ex, rep, lg)) + "</p>";
      }
    });
  });
}
