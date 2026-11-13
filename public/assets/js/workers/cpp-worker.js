/* Worker C++ (AUDIT #22) : JSCPP tourne hors du fil principal. L'interface reste fluide, une boucle infinie est
   coupée en arrêtant le worker, et la page n'a plus besoin d'autoriser eval() dans sa Content-Security-Policy
   (JSCPP s'en sert pour décoder les séquences d'échappement comme \n). */
const LIBS = ["https://cdn.jsdelivr.net/npm/JSCPP@2.0.6/dist/JSCPP.es5.min.js", "https://unpkg.com/JSCPP@2.0.6/dist/JSCPP.es5.min.js"];
let charge = null;

function charger() {
  if (charge) return charge;
  let err = null;
  for (const u of LIBS) {
    try { importScripts(u); return (charge = true); } catch (e) { err = e; }
  }
  throw new Error("Échec du chargement de l'interpréteur C++ : " + ((err && err.message) || err));
}

self.onmessage = (e) => {
  const { id, code, stdin, limiteMs, maxOut } = e.data;
  let out = "";
  try {
    charger();
    self.postMessage({ id, statut: "Exécution…" });
    const dbg = self.JSCPP.run(code, stdin || "", { debug: true, stdio: { write: (s) => { if (out.length < maxOut) out += s; } } });
    const t0 = performance.now();
    for (let n = 0; ; n++) {
      if (dbg.next() !== false) break;
      if ((n & 4095) === 0 && performance.now() - t0 > limiteMs) { self.postMessage({ id, out, err: "TimeLimit" }); return; }
    }
    self.postMessage({ id, out });
  } catch (err) {
    self.postMessage({ id, out, err: String((err && err.message) || err) });
  }
};
