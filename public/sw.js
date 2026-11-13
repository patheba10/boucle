/* Service worker de Boucle (AUDIT #19) : le site s'ouvre sans réseau.
   - Installation : tous les fichiers du site sont mis en cache (liste générée par scripts/precache.mjs).
   - Fichiers du site : réseau d'abord, pour être toujours à jour en ligne ; le cache sert quand le réseau manque.
   - CDN (Pyodide, JSCPP : adresses versionnées, donc immuables) : cache d'abord, gardés après la première
     utilisation. Python et C++ marchent donc hors ligne une fois qu'ils ont servi une fois.
   - Polices Google : cache, mis à jour en arrière-plan. */
// <precache> généré par scripts/precache.mjs, ne pas modifier à la main
const VERSION = "0c9dcc753a9d";
const PRECACHE = [
  "./",
  "assets/css/style.css",
  "assets/icons/icon-180.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon.svg",
  "assets/js/lib/ansible/ansible.js",
  "assets/js/lib/aws/account.js",
  "assets/js/lib/aws/cli.js",
  "assets/js/lib/aws/iam.js",
  "assets/js/lib/checker.js",
  "assets/js/lib/defis.js",
  "assets/js/lib/docker/catalog.js",
  "assets/js/lib/docker/cli.js",
  "assets/js/lib/docker/compose.js",
  "assets/js/lib/docker/dockerfile.js",
  "assets/js/lib/docker/engine.js",
  "assets/js/lib/editor.js",
  "assets/js/lib/engines.js",
  "assets/js/lib/exam.js",
  "assets/js/lib/examview.js",
  "assets/js/lib/exercices.js",
  "assets/js/lib/gitsim.js",
  "assets/js/lib/gitterm.js",
  "assets/js/lib/highlight.js",
  "assets/js/lib/icons.js",
  "assets/js/lib/indices.js",
  "assets/js/lib/k8s/cluster.js",
  "assets/js/lib/k8s/kubectl.js",
  "assets/js/lib/projets.js",
  "assets/js/lib/prom/cli.js",
  "assets/js/lib/prom/promql.js",
  "assets/js/lib/revision.js",
  "assets/js/lib/sauvegarde.js",
  "assets/js/lib/shell/commands.js",
  "assets/js/lib/shell/fs.js",
  "assets/js/lib/shell/parse.js",
  "assets/js/lib/shell/shell.js",
  "assets/js/lib/shell/text.js",
  "assets/js/lib/shterm.js",
  "assets/js/lib/sql.js",
  "assets/js/lib/state.js",
  "assets/js/lib/terraform/hcl.js",
  "assets/js/lib/terraform/terraform.js",
  "assets/js/lib/util.js",
  "assets/js/lib/wfview.js",
  "assets/js/lib/workflow.js",
  "assets/js/main.js",
  "assets/js/vendor/js-yaml.mjs",
  "assets/js/workers/cpp-worker.js",
  "assets/js/workers/python-worker.js",
  "assets/py/harness.py",
  "assets/py/mcu.h",
  "assets/py/minic.py",
  "assets/py/minikeras.py",
  "content/certifs/clf.js",
  "content/certifs/entretien-devops.js",
  "content/certifs/entretien-embarque.js",
  "content/certifs/entretien-ml.js",
  "content/certifs/index.js",
  "content/certifs/saa.js",
  "content/courses/algo.js",
  "content/courses/algo/patterns.js",
  "content/courses/algo/structures.js",
  "content/courses/api.js",
  "content/courses/api/tests.js",
  "content/courses/api/web.js",
  "content/courses/aws.js",
  "content/courses/aws/donnees.js",
  "content/courses/aws/exploitation.js",
  "content/courses/aws/fondations.js",
  "content/courses/aws/reseau.js",
  "content/courses/cicd.js",
  "content/courses/cicd/fondamentaux.js",
  "content/courses/cicd/livrer.js",
  "content/courses/cicd/pro.js",
  "content/courses/cicd/qualite.js",
  "content/courses/cicd/securite.js",
  "content/courses/cicd/tag.js",
  "content/courses/cicd/web.js",
  "content/courses/cicd/yaml.js",
  "content/courses/cpp.js",
  "content/courses/data.js",
  "content/courses/data/numpy.js",
  "content/courses/data/pandas.js",
  "content/courses/data/projet.js",
  "content/courses/data/scipy.js",
  "content/courses/data/sklearn.js",
  "content/courses/data/viz.js",
  "content/courses/dl.js",
  "content/courses/dl/keras.js",
  "content/courses/dl/litert.js",
  "content/courses/dl/neurones.js",
  "content/courses/dl/reseaux.js",
  "content/courses/docker.js",
  "content/courses/docker/bases.js",
  "content/courses/docker/commun.js",
  "content/courses/docker/compose.js",
  "content/courses/docker/images.js",
  "content/courses/docker/reseau.js",
  "content/courses/docker/situations.js",
  "content/courses/elec.js",
  "content/courses/elec/bases.js",
  "content/courses/elec/composants.js",
  "content/courses/embarque.js",
  "content/courses/embarque/langage.js",
  "content/courses/embarque/outils.js",
  "content/courses/embarque/peripheriques.js",
  "content/courses/entretiens.js",
  "content/courses/exploitation.js",
  "content/courses/exploitation/ansible.js",
  "content/courses/exploitation/observabilite.js",
  "content/courses/exploitation/sre.js",
  "content/courses/git.js",
  "content/courses/git/bases.js",
  "content/courses/git/branches.js",
  "content/courses/git/collaborer.js",
  "content/courses/git/github.js",
  "content/courses/kubernetes.js",
  "content/courses/kubernetes/avance.js",
  "content/courses/kubernetes/bases.js",
  "content/courses/kubernetes/commun.js",
  "content/courses/kubernetes/exploiter.js",
  "content/courses/kubernetes/production.js",
  "content/courses/linux.js",
  "content/courses/linux/bases.js",
  "content/courses/linux/droits.js",
  "content/courses/linux/reseau.js",
  "content/courses/linux/scripts.js",
  "content/courses/linux/situations.js",
  "content/courses/linux/systeme.js",
  "content/courses/linux/tag.js",
  "content/courses/linux/texte.js",
  "content/courses/logique.js",
  "content/courses/logique/combinatoire.js",
  "content/courses/logique/sequentielle.js",
  "content/courses/python.js",
  "content/courses/sql.js",
  "content/courses/sql/analyser.js",
  "content/courses/sql/base.js",
  "content/courses/sql/bases.js",
  "content/courses/sql/combiner.js",
  "content/courses/sql/ecrire.js",
  "content/courses/sysdesign.js",
  "content/courses/sysdesign/fondations.js",
  "content/courses/terraform.js",
  "content/courses/terraform/bases.js",
  "content/courses/terraform/equipe.js",
  "content/courses/terraform/structurer.js",
  "content/defis/algo.js",
  "content/defis/devops.js",
  "content/defis/embarque.js",
  "content/defis/index.js",
  "content/defis/py.js",
  "content/defis/sql.js",
  "content/exercices/algo.js",
  "content/exercices/devops.js",
  "content/exercices/embarque.js",
  "content/exercices/index.js",
  "content/exercices/py.js",
  "content/guides/installer.js",
  "content/index.js",
  "content/projets/cloud.js",
  "content/projets/devops.js",
  "content/projets/index.js",
  "content/projets/iot.js",
  "content/projets/ml.js",
  "content/roadmaps.js",
  "datasets/clients.csv",
  "datasets/commandes.csv",
  "datasets/exemple-notes.csv",
  "datasets/meteo-seattle.csv",
  "datasets/penguins.csv",
  "manifest.webmanifest",
  "index.html"
];
// </precache>

const SITE = "boucle-site-" + VERSION;
const CDN = "boucle-cdn-v1";
const IMMUABLES = ["https://cdn.jsdelivr.net/", "https://unpkg.com/"];
const POLICES = ["https://fonts.googleapis.com/", "https://fonts.gstatic.com/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SITE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((k) => k.startsWith("boucle-site-") && k !== SITE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function reseauDabord(req) {
  const cache = await caches.open(SITE);
  try {
    const rep = await fetch(req);
    if (rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch (err) {
    const enCache = await cache.match(req, { ignoreSearch: true });
    if (enCache) return enCache;
    if (req.mode === "navigate") return cache.match("index.html");
    throw err;
  }
}

async function cacheDabord(req) {
  const cache = await caches.open(CDN);
  const enCache = await cache.match(req.url);
  if (enCache) return enCache;
  // importScripts demande le fichier en mode no-cors : la réponse serait opaque (statut 0), impossible à
  // vérifier et coûteuse en quota. Le CDN accepte CORS : on redemande en mode cors, réponse lisible et cachable.
  const rep = await fetch(req.url, { mode: "cors", credentials: "omit" });
  if (rep.ok) cache.put(req.url, rep.clone());
  return rep;
}

async function cachePuisMaj(req) {
  const cache = await caches.open(CDN);
  const enCache = await cache.match(req);
  const maj = fetch(req).then((rep) => { if (rep.ok) cache.put(req, rep.clone()); return rep; });
  if (enCache) { maj.catch(() => {}); return enCache; }
  return maj;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = req.url;
  if (url.startsWith(self.location.origin + "/")) e.respondWith(reseauDabord(req));
  else if (IMMUABLES.some((p) => url.startsWith(p))) e.respondWith(cacheDabord(req));
  else if (POLICES.some((p) => url.startsWith(p))) e.respondWith(cachePuisMaj(req));
});
