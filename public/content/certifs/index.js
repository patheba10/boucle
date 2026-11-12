/* Préparation aux certifications : une banque de questions par examen (voir lib/exam.js pour le format). */
import clf from "./clf.js";
import saa from "./saa.js";
import entretienDevops from "./entretien-devops.js";
import entretienMl from "./entretien-ml.js";
import entretienEmbarque from "./entretien-embarque.js";

// kind: "entretien" : entretien technique blanc par métier, même moteur que les examens (US-9d #97).
export const CERTS = [clf, saa, entretienDevops, entretienMl, entretienEmbarque];
