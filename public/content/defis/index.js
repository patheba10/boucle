/* Défis gradués, rangés par cours et rattachés aux leçons par leur id (voir content/index.js). */
import py from "./py.js";
import algo from "./algo.js";
import sql from "./sql.js";
import embarque from "./embarque.js";

export const DEFIS = { ...py, ...algo, ...sql, ...embarque };
