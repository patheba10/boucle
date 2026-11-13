/* Worker C++ (AUDIT #22) : JSCPP tourne hors du fil principal. L'interface reste fluide, une boucle infinie est
   coupée en arrêtant le worker, et la page n'a plus besoin d'autoriser eval() dans sa Content-Security-Policy
   (JSCPP s'en sert pour décoder les séquences d'échappement comme \n). */
// JSCPP est servi par le site lui-même (copie du paquet npm, empreinte vérifiée par tests/unit/vendor.test.mjs) :
// pas de dépendance à un CDN tiers, que la Content-Security-Policy ne protège pas à l'intérieur d'un worker.
const LIB = "../vendor/JSCPP-2.0.6.es5.min.js";
let charge = null;

function charger() {
  if (charge) return charge;
  try { importScripts(LIB); } catch (e) { throw new Error("Échec du chargement de l'interpréteur C++ : " + ((e && e.message) || e)); }
  return (charge = true);
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
