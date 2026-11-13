/* Pages des comptes : connexion et inscription, nouveau mot de passe, mon compte ; lien de l'en-tête. */
import { esc, $, $$ } from "./util.js";
import {
  actif, utilisateur, nomAffiche, messageErreur, verifierFormulaire, connexion, inscription, connexionFournisseur,
  motDePasseOublie, changerMotDePasse, deconnexion, lireProfil, majProfil, supprimerCompte
} from "./compte.js";

const GITHUB = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';
const GOOGLE = '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';

const inactif = () => '<section class="card block auth"><h1>Comptes</h1><p class="muted">Les comptes ne sont pas encore activés sur ce site. Ta progression reste enregistrée dans ce navigateur ; tu peux l\'exporter en bas de page.</p></section>';

/* ---------------------------------------------------------------- en-tête */
export function majEntete(profil) {
  const lien = $("#compte-lien");
  if (!lien) return;
  lien.hidden = !actif();
  const u = utilisateur();
  if (!u) { lien.href = "#connexion"; lien.innerHTML = "Connexion"; lien.classList.remove("connecte"); return; }
  const nom = nomAffiche(u, profil);
  const avatar = (profil && profil.avatar_url) || (u.user_metadata && u.user_metadata.avatar_url) || "";
  lien.href = "#compte"; lien.classList.add("connecte");
  lien.innerHTML = (/^https:\/\//.test(avatar) ? '<img src="' + esc(avatar) + '" alt="" referrerpolicy="no-referrer">' : '<span class="initiale" aria-hidden="true">' + esc(nom.slice(0, 1).toUpperCase()) + "</span>") +
    '<span class="nom">' + esc(nom) + "</span>";
  lien.setAttribute("aria-label", "Mon compte : " + nom);
}

/* ---------------------------------------------------------------- connexion et inscription */
export function pageConnexion(mode) {
  if (!actif()) return inactif();
  const insc = mode === "inscription", oubli = mode === "oubli";
  if (oubli) {
    return '<section class="card block auth"><h1>Mot de passe oublié</h1><p class="muted">Indique ton adresse : tu recevras un lien pour choisir un nouveau mot de passe.</p>' +
      '<form class="auth-form" data-form="oubli" novalidate><label>Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>' +
      '<div data-auth-msg role="alert"></div><button class="btn primary" type="submit">Envoyer le lien</button></form>' +
      '<p class="auth-bas"><a href="#connexion">Retour à la connexion</a></p></section>';
  }
  return '<section class="card block auth"><h1>' + (insc ? "Créer un compte" : "Se connecter") + "</h1>" +
    '<p class="muted">' + (insc ? "Ta progression te suit sur tous tes appareils." : "Retrouve ta progression sur tous tes appareils.") + "</p>" +
    '<div class="auth-fournisseurs"><button class="btn" type="button" data-fournisseur="github">' + GITHUB + "Continuer avec GitHub</button>" +
    '<button class="btn" type="button" data-fournisseur="google">' + GOOGLE + "Continuer avec Google</button></div>" +
    '<p class="auth-ou"><span>ou avec ton adresse e-mail</span></p>' +
    '<form class="auth-form" data-form="' + (insc ? "inscription" : "connexion") + '" novalidate>' +
      (insc ? '<label>Nom affiché <span class="muted">(facultatif)</span><input type="text" name="nom" autocomplete="nickname" maxlength="60"></label>' : "") +
      '<label>Adresse e-mail<input type="email" name="email" autocomplete="email" required></label>' +
      '<label>Mot de passe<input type="password" name="mdp" autocomplete="' + (insc ? "new-password" : "current-password") + '" required' + (insc ? ' minlength="10" aria-describedby="regle-mdp"' : "") + "></label>" +
      (insc ? '<p class="muted petit" id="regle-mdp">Au moins 10 caractères, avec des lettres et des chiffres.</p>' : '<p class="petit"><a href="#mot-de-passe-oublie">Mot de passe oublié ?</a></p>') +
      '<div data-auth-msg role="alert"></div><button class="btn primary" type="submit">' + (insc ? "Créer mon compte" : "Se connecter") + "</button></form>" +
    '<p class="auth-bas">' + (insc ? 'Déjà un compte ? <a href="#connexion">Se connecter</a>' : 'Pas encore de compte ? <a href="#inscription">Créer un compte</a>') + "</p>" +
    '<p class="muted petit">En créant un compte, tu acceptes la <a href="#confidentialite">politique de confidentialité</a>.</p></section>';
}

function message(form, texte, ok) {
  const m = $("[data-auth-msg]", form);
  m.className = texte ? (ok ? "auth-ok" : "auth-err") : "";
  m.textContent = texte;
}

async function soumettre(form, action) {
  const bouton = $('button[type="submit"]', form);
  bouton.disabled = true;
  try { await action(); } catch (e) { message(form, messageErreur(e)); } finally { bouton.disabled = false; }
}

export function bindConnexion({ apres }) {
  if (!actif()) return;
  $$("[data-fournisseur]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await connexionFournisseur(b.dataset.fournisseur, apres); } catch (e) { b.disabled = false; message($(".auth-form"), messageErreur(e)); }
  }));
  const form = $(".auth-form");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const v = (n) => (form.elements[n] ? form.elements[n].value : undefined);
    const mode = form.dataset.form;
    const email = (v("email") || "").trim();
    const erreur = verifierFormulaire({ email, motDePasse: mode === "oubli" ? undefined : v("mdp"), inscription: mode === "inscription" });
    if (erreur) { message(form, erreur); return; }
    message(form, "");
    soumettre(form, async () => {
      if (mode === "connexion") await connexion(email, v("mdp"));
      else if (mode === "inscription") {
        const direct = await inscription(email, v("mdp"), (v("nom") || "").trim());
        if (!direct) message(form, "Compte créé. Ouvre le lien de confirmation envoyé à " + email + " pour l'activer.", true);
      } else {
        await motDePasseOublie(email);
        message(form, "Si un compte existe pour cette adresse, un lien vient d'y être envoyé.", true);
      }
    });
  });
}

/* ---------------------------------------------------------------- nouveau mot de passe (lien reçu par e-mail) */
export function pageNouveauMdp() {
  if (!actif()) return inactif();
  if (!utilisateur()) return '<section class="card block auth"><h1>Nouveau mot de passe</h1><p class="muted">Ce lien a expiré ou a déjà servi. Demande-en un nouveau.</p><p><a class="btn" href="#mot-de-passe-oublie">Mot de passe oublié</a></p></section>';
  return '<section class="card block auth"><h1>Nouveau mot de passe</h1><form class="auth-form" data-form="nouveau" novalidate>' +
    '<label>Nouveau mot de passe<input type="password" name="mdp" autocomplete="new-password" required minlength="10"></label>' +
    '<label>Confirmation<input type="password" name="conf" autocomplete="new-password" required minlength="10"></label>' +
    '<p class="muted petit">Au moins 10 caractères, avec des lettres et des chiffres.</p>' +
    '<div data-auth-msg role="alert"></div><button class="btn primary" type="submit">Enregistrer</button></form></section>';
}

export function bindNouveauMdp({ fini }) {
  const form = $('.auth-form[data-form="nouveau"]');
  if (!form) return;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const mdp = form.elements.mdp.value, conf = form.elements.conf.value;
    const erreur = verifierFormulaire({ email: utilisateur().email || "x@x.x", motDePasse: mdp, confirmation: conf });
    if (erreur) { message(form, erreur); return; }
    soumettre(form, async () => { await changerMotDePasse(mdp); fini(); });
  });
}

/* ---------------------------------------------------------------- mon compte : profil, tableau de bord, sécurité */
export const OBJECTIFS = { devops: "DevOps", cloud: "Cloud", ml: "Machine learning", iot: "Embarqué et IoT" };
const CONFIRMATION = "SUPPRIMER";

const barre = (pct, couleur) => '<div class="bar"' + (couleur ? ' style="--c:' + couleur + '"' : "") + '><i style="width:' + pct + '%"></i></div>';

/** tdb : tableau de bord calculé par main.js ; roadmaps : [{ id, name }] ; profil : ligne de la table profils. */
export function pageCompte(tdb, roadmaps, profil) {
  if (!actif()) return inactif();
  const u = utilisateur();
  if (!u) return '<section class="card block auth"><h1>Mon compte</h1><p class="muted">Tu n\'es pas connecté.</p><p><a class="btn primary" href="#connexion">Se connecter</a></p></section>';
  const p = profil || {};
  const nom = nomAffiche(u, p);
  const avatar = p.avatar_url || (u.user_metadata && u.user_metadata.avatar_url) || "";
  const fournisseur = (u.app_metadata && u.app_metadata.provider) || "email";
  const opt = (v, t, sel) => '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(t) + "</option>";
  const suivie = roadmaps.find((r) => r.id === p.roadmap);
  const rmSuivie = suivie ? tdb.roadmaps.find((r) => r.id === suivie.id) : null;
  return '<div class="espace">' +
    '<section class="card block compte-tete"><div class="compte-id" data-compte-id>' +
      (/^https:\/\//.test(avatar) ? '<img class="avatar" src="' + esc(avatar) + '" alt="" referrerpolicy="no-referrer">' : '<span class="avatar initiale" aria-hidden="true">' + esc(nom.slice(0, 1).toUpperCase()) + "</span>") +
      "<div><h1>" + esc(nom) + '</h1><p class="muted">' + esc(u.email || "") + " · connecté avec " + esc({ github: "GitHub", google: "Google" }[fournisseur] || "e-mail") + "</p></div></div>" +
      '<div class="compte-chiffres"><div><b>' + tdb.xp + "</b><span>XP · niveau " + tdb.niveau + "</span></div><div><b>" + tdb.serie + "</b><span>jour" + (tdb.serie > 1 ? "s" : "") + " de suite</span></div><div><b>" + tdb.lecons.d + "</b><span>leçon" + (tdb.lecons.d > 1 ? "s" : "") + " sur " + tdb.lecons.n + "</span></div><div><b>" + tdb.revisions + '</b><span>à réviser aujourd\'hui</span></div></div></section>' +
    '<div class="compte-grille">' +
    '<section class="card block"><h2>Tableau de bord</h2>' +
      (rmSuivie ? '<div class="tdb-rm"><p><b>Roadmap ' + esc(suivie.name) + '</b> <a href="#' + esc(suivie.id) + '">ouvrir</a></p>' + barre(rmSuivie.pct) + '<p class="muted petit">' + rmSuivie.d + (rmSuivie.d > 1 ? " étapes" : " étape") + " sur " + rmSuivie.n + " (" + rmSuivie.pct + " %)</p></div>" : '<p class="muted">Choisis une roadmap dans ton profil pour suivre ta progression ici.</p>') +
      (tdb.revisions ? '<p><a class="btn sm primary" href="#revision">Réviser ' + tdb.revisions + " question" + (tdb.revisions > 1 ? "s" : "") + "</a></p>" : tdb.prochaine ? '<p class="muted petit">Prochaine révision le ' + esc(tdb.prochaine) + ".</p>" : "") +
      "<h3>Cours commencés</h3>" + (tdb.cours.length ? '<ul class="tdb-cours">' + tdb.cours.map((c) => '<li><a href="#' + esc(c.route) + '">' + esc(c.nom) + "</a>" + barre(c.pct, c.couleur) + '<span class="muted petit">' + c.d + " / " + c.n + "</span></li>").join("") + "</ul>" : '<p class="muted">Aucun pour l\'instant. <a href="#cours">Choisir un cours</a></p>') +
      (tdb.projets.length ? "<h3>Projets en cours</h3><ul class=\"tdb-cours\">" + tdb.projets.map((x) => '<li><a href="#' + esc(x.id) + '">' + esc(x.titre) + "</a>" + barre(x.pct) + '<span class="muted petit">' + x.d + " / " + x.n + " jalons</span></li>").join("") + "</ul>" : "") +
    "</section>" +
    '<div class="compte-col">' +
    '<section class="card block"><h2>Profil</h2><form class="auth-form" data-form="profil" novalidate>' +
      '<label>Nom affiché<input type="text" name="nom" maxlength="60" value="' + esc(p.nom || "") + '" autocomplete="nickname"></label>' +
      '<label>Objectif<select name="objectif">' + opt("", "Pas encore choisi", p.objectif || "") + Object.entries(OBJECTIFS).map(([v, t]) => opt(v, t, p.objectif)).join("") + "</select></label>" +
      '<label>Roadmap suivie<select name="roadmap">' + opt("", "Aucune", p.roadmap || "") + roadmaps.map((r) => opt(r.id, r.name, p.roadmap)).join("") + "</select></label>" +
      '<div data-auth-msg role="status"></div><button class="btn primary" type="submit">Enregistrer</button></form></section>' +
    '<section class="card block"><h2>Sécurité</h2>' +
      (fournisseur === "email" ? '<p><a class="btn sm" href="#nouveau-mot-de-passe">Changer de mot de passe</a></p>' : '<p class="muted petit">Tu te connectes avec ' + esc({ github: "GitHub", google: "Google" }[fournisseur] || fournisseur) + " : ton mot de passe est géré là-bas.</p>") +
      '<p><button class="btn sm" type="button" data-deconnexion>Se déconnecter</button></p></section>' +
    '<section class="card block danger"><h2>Supprimer mon compte</h2><p class="muted petit">Efface immédiatement ton compte, ton profil et ta progression enregistrée en ligne, ainsi que la copie de ce navigateur. C\'est définitif. Tu peux d\'abord « Exporter » ta progression en bas de page.</p>' +
      '<form class="auth-form" data-form="suppression" novalidate><label>Pour confirmer, écris ' + CONFIRMATION + '<input type="text" name="conf" autocomplete="off" spellcheck="false"></label>' +
      '<div data-auth-msg role="alert"></div><button class="btn danger" type="submit" disabled>Supprimer définitivement</button></form></section>' +
    "</div></div></div>";
}

export function bindCompte({ deconnecte, supprime, profilMaj }) {
  const b = $("[data-deconnexion]");
  if (b) b.addEventListener("click", async () => { b.disabled = true; await deconnexion(); deconnecte(); });
  const fp = $('.auth-form[data-form="profil"]');
  if (fp) fp.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nom = fp.elements.nom.value.trim();
    if (nom.length > 60) { message(fp, "Nom trop long (60 caractères au plus)."); return; }
    soumettre(fp, async () => {
      const p = await majProfil({ nom, objectif: fp.elements.objectif.value, roadmap: fp.elements.roadmap.value });
      profilMaj(p);
      message(fp, "Profil enregistré.", true);
    });
  });
  const fs = $('.auth-form[data-form="suppression"]');
  if (fs) {
    const bouton = $('button[type="submit"]', fs);
    fs.elements.conf.addEventListener("input", () => { bouton.disabled = fs.elements.conf.value.trim() !== CONFIRMATION; });
    fs.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (fs.elements.conf.value.trim() !== CONFIRMATION) return;
      soumettre(fs, async () => { await supprimerCompte(); supprime(); });
    });
  }
}

/* ---------------------------------------------------------------- confidentialité (Loi 25 du Québec, RGPD) */
export function pageConfidentialite() {
  return '<section class="card block prose legal"><h1>Politique de confidentialité</h1>' +
    "<p>Boucle est un projet personnel d'apprentissage, gratuit et sans publicité. Cette page explique quelles données sont gardées quand tu crées un compte, et ce que tu peux en faire.</p>" +
    "<h2>Sans compte</h2><p>Rien ne quitte ton navigateur : ta progression est enregistrée dans son stockage local. Aucun cookie de suivi, aucune mesure d'audience, aucun outil publicitaire.</p>" +
    "<h2>Avec un compte</h2><ul>" +
      "<li><b>Ce qui est gardé</b> : ton adresse e-mail, ton nom affiché et ton avatar (fournis par GitHub ou Google si tu te connectes avec eux), ton objectif et ta roadmap si tu les choisis, et ta progression (XP, leçons, défis, code écrit dans les exercices, révisions).</li>" +
      "<li><b>Pourquoi</b> : te connecter et retrouver ta progression sur tous tes appareils. Rien d'autre : pas de revente, pas de profilage, pas de courriel commercial.</li>" +
      "<li><b>Où</b> : chez Supabase (authentification et base de données), sur des serveurs situés au Canada. Les mots de passe ne sont jamais stockés en clair.</li>" +
      "<li><b>Qui y a accès</b> : toi seul, par les règles de sécurité de la base. Le responsable du projet peut y accéder pour l'administration technique.</li>" +
      "<li><b>Combien de temps</b> : tant que ton compte existe.</li></ul>" +
    "<h2>Tes droits</h2><ul>" +
      "<li><b>Accès et portabilité</b> : « Exporter », en bas de chaque page, télécharge ta progression complète.</li>" +
      "<li><b>Rectification</b> : ton nom, ton objectif et ta roadmap se modifient dans Mon compte.</li>" +
      "<li><b>Suppression</b> : « Supprimer mon compte », dans Mon compte, efface immédiatement ton compte et toutes ses données.</li></ul>" +
    "<h2>Contact</h2><p>Pour toute question sur tes données : formulaire de signalement privé du dépôt GitHub du projet (onglet Security), ou une issue si la question n'a rien de personnel.</p>" +
    '<p class="muted petit">Dernière mise à jour : 13 novembre 2026.</p></section>';
}
