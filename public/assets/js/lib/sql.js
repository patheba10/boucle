/* SQL : les requêtes de l'élève tournent dans un vrai SQLite (module sqlite3 de Python, dans Pyodide au navigateur
   et dans CPython pour npm run validate). Ce module fabrique le programme Python ; les moteurs l'exécutent.
   Un défi SQL : { db (script de création, sinon celui de la leçon ou du cours), starter, solution,
   check (requête de contrôle pour un exercice qui modifie les données), ordered (ordre exigé ; par défaut si la
   solution contient ORDER BY), columns (noms de colonnes exigés), hint, prompt }. */

export const SQL_MARK = "<<<BOUCLE-SQL>>>";

const RUNNER = String.raw`
import sqlite3, json

class ErreurSQL(Exception):
    pass

def _b_fmt(v):
    if v is None:
        return "NULL"
    if isinstance(v, float):
        return repr(round(v, 6))
    if isinstance(v, bytes):
        return "x'" + v.hex() + "'"
    return str(v)

def _b_table(cols, rows, limit=100):
    vals = [[_b_fmt(v) for v in r] for r in rows[:limit]]
    w = [max([len(c)] + [len(r[i]) for r in vals]) for i, c in enumerate(cols)]
    line = lambda cells: " | ".join(c.ljust(w[i]) for i, c in enumerate(cells)).rstrip()
    out = [line(cols), "-+-".join("-" * x for x in w)] + [line(r) for r in vals]
    if len(rows) > limit:
        out.append("…")
    out.append("(aucune ligne)" if not rows else "(%d ligne%s)" % (len(rows), "s" if len(rows) > 1 else ""))
    return "\n".join(out)

def _b_split(sql):
    parts, buf = [], ""
    for ch in sql:
        buf += ch
        if ch == ";" and sqlite3.complete_statement(buf):
            parts.append(buf)
            buf = ""
    if buf.strip():
        parts.append(buf)
    keep = []
    for p in parts:
        code = "\n".join(l for l in p.split("\n") if not l.strip().startswith("--")).strip().rstrip(";").strip()
        if code:
            keep.append(p)
    return keep

def _b_connect(db):
    con = sqlite3.connect(":memory:", isolation_level=None)
    if db:
        con.executescript(db)
    return con

def _b_exec(con, sql, show):
    results = []
    for n, st in enumerate(_b_split(sql), 1):
        try:
            cur = con.execute(st)
        except sqlite3.Warning:
            raise ErreurSQL("instruction %d : une seule instruction à la fois (il manque un point-virgule ?)" % n)
        except sqlite3.Error as e:
            raise ErreurSQL("instruction %d : %s" % (n, e)) from None
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            results.append((cols, rows))
            if show:
                print(_b_table(cols, rows))
                print()
        elif show and cur.rowcount >= 0 and st.lstrip().split(None, 1)[0].upper() in ("INSERT", "UPDATE", "DELETE", "REPLACE"):
            print("(%d ligne%s modifiée%s)" % (cur.rowcount, "s" if cur.rowcount > 1 else "", "s" if cur.rowcount > 1 else ""))
            print()
    return results

def _b_norm(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int, float)):
        f = round(float(v), 6)
        return int(f) if f == int(f) else f
    return v

def _b_key(row):
    return tuple((0, "") if v is None else (1, v) if isinstance(v, (int, float)) else (2, str(v)) for v in row)

def _b_run(db, sql):
    con = _b_connect(db)
    res = _b_exec(con, sql, True)
    if not res and not _b_split(sql):
        print("(aucune instruction)")

def _b_check(db, user, sol, check, ordered, columns):
    a = _b_connect(db)
    b = _b_connect(db)
    ra = _b_exec(a, user, True)
    rb = _b_exec(b, sol, False)
    if check:
        ca, cb = a.execute(check), b.execute(check)
        ra = [([d[0] for d in ca.description], ca.fetchall())]
        rb = [([d[0] for d in cb.description], cb.fetchall())]
    exp = rb[-1]
    v = {"ok": False, "expected": _b_table(*exp), "got": "", "note": ""}
    if not ra:
        v["got"] = "(aucun résultat)"
        v["note"] = "Ta requête ne renvoie pas de lignes : le défi attend un SELECT."
    else:
        got = ra[-1]
        v["got"] = _b_table(*got)
        ga = [tuple(_b_norm(x) for x in r) for r in got[1]]
        ea = [tuple(_b_norm(x) for x in r) for r in exp[1]]
        if len(got[0]) != len(exp[0]):
            v["note"] = "Attendu %d colonne%s, obtenu %d." % (len(exp[0]), "s" if len(exp[0]) > 1 else "", len(got[0]))
        elif columns and [c.lower() for c in got[0]] != [c.lower() for c in exp[0]]:
            v["note"] = "Les colonnes doivent s'appeler : " + ", ".join(exp[0]) + " (utilise AS)."
        elif ga == ea:
            v["ok"] = True
        elif sorted(ga, key=_b_key) == sorted(ea, key=_b_key):
            if ordered:
                v["note"] = "Les bonnes lignes, mais pas dans le bon ordre : vérifie ORDER BY."
            else:
                v["ok"] = True
        elif len(ga) != len(ea):
            v["note"] = "Attendu %d ligne%s, obtenu %d." % (len(ea), "s" if len(ea) > 1 else "", len(ga))
        else:
            v["note"] = "Le bon nombre de lignes, mais des valeurs différentes."
    print(${JSON.stringify("<<<BOUCLE-SQL>>>")})
    print(json.dumps(v, ensure_ascii=False))
`;

const lit = (s) => JSON.stringify(String(s ?? ""));
/** Programme qui exécute du SQL sur une base neuve et affiche chaque résultat sous forme de tableau. */
export const sqlRunProgram = (db, code) => RUNNER + "\n_b_run(" + lit(db) + ", " + lit(code) + ")\n";
/** Programme qui compare le résultat de l'élève à celui de la solution (ou d'une requête de contrôle). */
export function sqlCheckProgram(ch, db, code) {
  const ordered = ch.ordered ?? /\border\s+by\b/i.test(ch.solution);
  return RUNNER + "\n_b_check(" + [lit(db), lit(code), lit(ch.solution), ch.check ? lit(ch.check) : "None", ordered ? "True" : "False", ch.columns ? "True" : "False"].join(", ") + ")\n";
}
/** Lit la sortie d'un programme de vérification : { pre (tableaux de l'élève), verdict }. */
export function parseSqlCheck(out) {
  const i = out.lastIndexOf(SQL_MARK + "\n");
  if (i < 0) return { pre: out, verdict: null };
  return { pre: out.slice(0, i), verdict: JSON.parse(out.slice(i + SQL_MARK.length + 1)) };
}

/** Conseil pour une erreur SQLite (texte de l'erreur levée par le programme). */
export function sqlTip(err) {
  const tips = [
    [/no such table/, "Table inconnue : vérifie son nom dans le schéma (les tables sont au pluriel ici)."],
    [/no such column/, "Colonne inconnue : faute de frappe, ou colonne d'une autre table ? Avec une jointure, préfixe-la (c.nom)."],
    [/ambiguous column name/, "Deux tables ont une colonne de ce nom : préfixe-la avec la table ou son alias (c.id, co.id)."],
    [/syntax error/, "Syntaxe : ordre des clauses SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT, virgules, parenthèses, guillemets simples pour le texte."],
    [/misuse of aggregate|aggregate functions are not allowed/, "Une fonction d'agrégation (SUM, COUNT…) ne va pas dans WHERE : filtre les groupes avec HAVING."],
    [/UNIQUE constraint failed/, "Cette valeur existe déjà dans une colonne UNIQUE ou une clé primaire."],
    [/NOT NULL constraint failed/, "Une colonne NOT NULL n'a pas reçu de valeur."],
    [/FOREIGN KEY constraint failed/, "La clé étrangère vise une ligne qui n'existe pas (ou d'autres lignes en dépendent encore)."],
    [/CHECK constraint failed/, "Une contrainte CHECK refuse cette valeur."],
    [/incomplete input/, "Instruction incomplète : parenthèse ou guillemet non fermé ?"],
    [/no such function/, "Fonction inconnue de SQLite : par exemple, pas de NOW() ni de YEAR() ; utilise date('now') et strftime('%Y', …)."]
  ];
  const t = tips.find(([rx]) => rx.test(err));
  return t ? t[1] : "";
}
