/* Synchronisation de la progression avec le compte (AUDIT #16).
   - fusionner(a, b) : fonction pure. Rien de réussi n'est perdu : leçons, défis, exercices, étapes et jalons
     cochés, questions vues s'additionnent ; les XP gardent le maximum ; pour le reste (code, dernière leçon,
     atelier), l'état le plus récent l'emporte.
   - Synchro : à la connexion, relit la progression du compte, la fusionne avec celle du navigateur et renvoie
     le résultat. Ensuite, chaque sauvegarde part (groupée) vers le compte. La base refuse une écriture faite
     sur une révision périmée (un autre appareil a écrit entre-temps) : on relit, on fusionne, on réessaie.
   Testé dans tests/unit/synchro.test.mjs (fonction pure et scénarios avec une base simulée). */

const objet = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const plusRecent = (a, b) => ((a.maj || 0) >= (b.maj || 0) ? a : b);

/** OU logique, clé par clé, de deux objets de drapeaux ({ cle: true }). */
function union(a, b) {
  const r = { ...objet(a) };
  for (const [k, v] of Object.entries(objet(b))) if (v) r[k] = v;
  return r;
}

function fusionnerLecon(a, b) {
  const x = objet(a), y = objet(b);
  const r = { ...x, ...y };
  r.quiz = union(x.quiz, y.quiz);
  r.ch = !!(x.ch || y.ch);
  r.sol = !!(x.sol || y.sol);
  for (const k of ["ex", "defis", "solD"]) if (x[k] || y[k]) r[k] = union(x[k], y[k]);
  if (x.fails || y.fails) r.fails = Math.max(x.fails || 0, y.fails || 0);
  return r;
}

function fusionnerCert(a, b, recent) {
  const x = objet(a), y = objet(b);
  const vus = new Set();
  const exams = [...(x.exams || []), ...(y.exams || [])].filter((e) => { const k = JSON.stringify(e); return vus.has(k) ? false : vus.add(k); });
  return { ...x, ...y, seen: union(x.seen, y.seen), exams, current: (recent === "a" ? x : y).current || null };
}

export function fusionner(a, b) {
  const x = objet(a), y = objet(b);
  const recent = plusRecent(x, y) === x ? "a" : "b";
  const [ancien, neuf] = recent === "a" ? [y, x] : [x, y];
  const r = { ...ancien, ...neuf }; // champs inconnus et « le plus récent l'emporte »
  r.xp = Math.max(+x.xp || 0, +y.xp || 0);
  r.maj = Math.max(x.maj || 0, y.maj || 0);
  r.lessons = {};
  for (const id of new Set([...Object.keys(objet(x.lessons)), ...Object.keys(objet(y.lessons))])) r.lessons[id] = fusionnerLecon(objet(x.lessons)[id], objet(y.lessons)[id]);
  r.roadmap = union(x.roadmap, y.roadmap);
  r.projets = union(x.projets, y.projets);
  r.days = [...new Set([...(x.days || []), ...(y.days || [])])].sort().slice(-400);
  // Révision : si les deux appareils suivent la même question, on garde la série la plus courte (la plus prudente).
  r.revision = { ...objet(x.revision) };
  for (const [k, e] of Object.entries(objet(y.revision))) {
    const d = r.revision[k];
    r.revision[k] = !d || e.serie < d.serie || (e.serie === d.serie && e.due < d.due) ? e : d;
  }
  r.code = { ...objet(ancien.code), ...objet(neuf.code) };
  r.certs = {};
  for (const id of new Set([...Object.keys(objet(x.certs)), ...Object.keys(objet(y.certs))])) r.certs[id] = fusionnerCert(objet(x.certs)[id], objet(y.certs)[id], recent);
  return r;
}

/** Deux progressions identiques, à l'horodatage près ? */
export const memes = (a, b) => JSON.stringify({ ...a, maj: 0 }) === JSON.stringify({ ...b, maj: 0 });

const CONFLIT = "40001";

export class Synchro {
  /** client : client Supabase ; etat() : progression locale ; remplacer(e) : l'adopter ; utilisateur : id du compte. */
  constructor({ client, etat, remplacer, utilisateur, delai = 2000, onStatut = () => {} }) {
    Object.assign(this, { client, etat, remplacer, utilisateur, delai, onStatut });
    this.revision = null;
    this.minuteur = null;
    this.enCours = null;
    this.enAttente = false;
    this.arrete = false;
  }

  async lire() {
    const { data, error } = await this.client.from("progressions").select("donnees, revision").maybeSingle();
    if (error) throw error;
    return data ? { donnees: data.donnees || {}, revision: data.revision } : { donnees: {}, revision: 0 };
  }

  async ecrire(donnees) {
    const { data, error } = await this.client.rpc("enregistrer_progression", { donnees, revision_attendue: this.revision });
    if (error) throw error;
    this.revision = data;
  }

  /** Connexion : lit le compte, fusionne avec le navigateur, adopte le résultat et l'envoie s'il apporte du neuf. */
  async demarrer() {
    this.onStatut("synchro");
    const distant = await this.lire();
    this.revision = distant.revision;
    let local = this.etat();
    // Progression laissée par un autre compte sur ce navigateur : on ne la mélange pas, on prend celle du compte.
    if (local.compte && local.compte !== this.utilisateur) local = {};
    const fusion = { ...fusionner(local, distant.donnees), compte: this.utilisateur };
    this.remplacer(fusion);
    if (!memes(fusion, { ...distant.donnees, compte: this.utilisateur })) await this.envoyer();
    this.onStatut("ok");
  }

  /** À appeler après chaque sauvegarde locale : l'envoi part après un court délai, groupé. */
  planifier() {
    if (this.arrete || this.revision === null) return;
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => this.envoyer().catch(() => {}), this.delai);
  }

  /** Envoie la progression ; en cas de conflit, relit, fusionne et réessaie (3 fois au plus). */
  async envoyer() {
    if (this.enCours) { this.enAttente = true; return this.enCours; }
    this.enCours = (async () => {
      try {
        for (let essai = 0; essai < 3; essai++) {
          try {
            await this.ecrire({ ...this.etat(), compte: this.utilisateur });
            this.onStatut("ok");
            return;
          } catch (e) {
            if (e.code !== CONFLIT) throw e;
            const distant = await this.lire();
            this.revision = distant.revision;
            this.remplacer({ ...fusionner(this.etat(), distant.donnees), compte: this.utilisateur });
          }
        }
        throw new Error("Conflits répétés : synchronisation reportée.");
      } catch (e) {
        this.onStatut("erreur", e);
        throw e;
      } finally {
        this.enCours = null;
        if (this.enAttente) { this.enAttente = false; this.planifier(); }
      }
    })();
    return this.enCours;
  }

  arreter() { this.arrete = true; clearTimeout(this.minuteur); }
}
