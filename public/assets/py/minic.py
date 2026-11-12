"""minic : un interpréteur C (C11, sous-ensemble large) écrit en Python au-dessus de pycparser.

Il sert au cours de C embarqué : le navigateur n'a pas de compilateur C, et l'interpréteur C++ du site (JSCPP) ne gère
ni struct, ni enum, ni volatile, ni l'arithmétique modulaire des entiers non signés. minic suit le modèle LP64 de gcc
sur x86-64 (int 32 bits, long et pointeurs 64 bits, petit-boutiste, alignements naturels) : le même programme compilé
par gcc en CI (scripts/validate.mjs, avec -fwrapv) doit afficher exactement la même chose.

Le code est préprocessé (#include, #define avec ou sans paramètres, #if/#ifdef), analysé par pycparser, puis compilé en
fermetures Python ; la mémoire est un bytearray adressable octet par octet (globales, pile, tas)."""
import math
import operator
import os
import re
import struct
import sys

from pycparser import c_ast, c_parser


class ErreurC(Exception):
    """Erreur de compilation ou d'exécution, avec un message en français et la ligne du code C."""


def _err(node, msg):
    ligne = getattr(getattr(node, "coord", None), "line", None)
    return ErreurC(("ligne %d : " % ligne if ligne else "") + msg)


# ---------------------------------------------------------------- préprocesseur

ICI = os.path.dirname(os.path.abspath(__file__))
STD = {"stdint.h", "stdio.h", "stdbool.h", "string.h", "stdlib.h", "math.h", "stddef.h", "limits.h", "assert.h",
       "inttypes.h", "ctype.h"}
PRELUDE = """typedef signed char int8_t; typedef unsigned char uint8_t; typedef short int16_t; typedef unsigned short uint16_t;
typedef int int32_t; typedef unsigned int uint32_t; typedef long int64_t; typedef unsigned long uint64_t;
typedef unsigned long size_t; typedef long ptrdiff_t; typedef long intptr_t; typedef unsigned long uintptr_t;
"""
MACROS_STD = {
    "true": "1", "false": "0", "bool": "_Bool", "NULL": "((void*)0)",
    "INT8_MAX": "127", "INT8_MIN": "(-128)", "UINT8_MAX": "255", "INT16_MAX": "32767", "INT16_MIN": "(-32768)",
    "UINT16_MAX": "65535", "INT32_MAX": "2147483647", "INT32_MIN": "(-2147483647-1)", "UINT32_MAX": "4294967295U",
    "INT_MAX": "2147483647", "INT_MIN": "(-2147483647-1)", "UINT_MAX": "4294967295U", "CHAR_BIT": "8",
    "INT64_MAX": "9223372036854775807L", "UINT64_MAX": "18446744073709551615UL",
}
TOKEN = re.compile(r"""\s+|[A-Za-z_]\w*|\.?\d(?:[eEpP][+-]|[\w.])*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\#\#|.""", re.S)


def _sans_commentaires(src):
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c in "\"'":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1])
            i = j + 1
        elif src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("\n" * src.count("\n", i, j) or " ")
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


class Preprocesseur:
    def __init__(self, fichiers=None):
        self.macros = {k: (None, v) for k, v in MACROS_STD.items()}
        self.fichiers = fichiers or {}
        self.inclus = set()

    def _developper(self, texte, interdits=frozenset()):
        toks = TOKEN.findall(texte)
        out, i = [], 0
        while i < len(toks):
            t = toks[i]
            if t in self.macros and t not in interdits:
                params, corps = self.macros[t]
                if params is None:
                    out.append(self._developper(corps, interdits | {t}))
                    i += 1
                    continue
                j = i + 1
                while j < len(toks) and toks[j].isspace():
                    j += 1
                if j < len(toks) and toks[j] == "(":
                    args, prof, cur, j = [], 0, [], j + 1
                    while j < len(toks):
                        x = toks[j]
                        if x == "(":
                            prof += 1
                        elif x == ")":
                            if prof == 0:
                                break
                            prof -= 1
                        elif x == "," and prof == 0:
                            args.append("".join(cur).strip())
                            cur = []
                            j += 1
                            continue
                        cur.append(x)
                        j += 1
                    args.append("".join(cur).strip())
                    if params == [] and args == [""]:
                        args = []
                    if len(args) != len(params) and not (params and params[-1] == "..."):
                        raise ErreurC("macro %s : %d argument(s) attendu(s)" % (t, len(params)))
                    valeurs = dict(zip(params, args))
                    if params and params[-1] == "...":
                        valeurs["__VA_ARGS__"] = ", ".join(args[len(params) - 1:])
                    ctoks, res, k = TOKEN.findall(corps), [], 0
                    while k < len(ctoks):
                        c = ctoks[k]
                        if c == "#" and k + 1 < len(ctoks) and ctoks[k + 1] in valeurs:
                            res.append('"%s"' % valeurs[ctoks[k + 1]].replace("\\", "\\\\").replace('"', '\\"'))
                            k += 2
                            continue
                        if c == "##":
                            while res and res[-1].isspace():
                                res.pop()
                            k += 1
                            while k < len(ctoks) and ctoks[k].isspace():
                                k += 1
                            if k < len(ctoks):
                                nxt = ctoks[k]
                                res.append(valeurs.get(nxt, nxt))
                                k += 1
                            continue
                        res.append(self._developper(valeurs[c], interdits) if c in valeurs else c)
                        k += 1
                    out.append(self._developper("".join(res), interdits | {t}))
                    i = j + 1
                    continue
            out.append(t)
            i += 1
        return "".join(out)

    def _condition(self, expr, ligne):
        expr = re.sub(r"defined\s*\(\s*(\w+)\s*\)|defined\s+(\w+)",
                      lambda m: "1" if (m.group(1) or m.group(2)) in self.macros else "0", expr)
        expr = self._developper(expr)
        expr = re.sub(r"\b[A-Za-z_]\w*\b", "0", expr)
        expr = re.sub(r"(\d+)[uUlL]+", r"\1", expr).replace("&&", " and ").replace("||", " or ")
        expr = re.sub(r"!(?!=)", " not ", expr)
        try:
            return bool(eval(expr, {"__builtins__": {}}))
        except Exception:
            raise ErreurC("ligne %d : condition #if illisible" % ligne)

    def traiter(self, src, nom="<code>"):
        src = _sans_commentaires(src.replace("\\\n", ""))
        out, pile = ['# 1 "%s"' % nom], []
        actif = lambda: all(p[0] for p in pile)
        for num, ligne in enumerate(src.split("\n"), 1):
            m = re.match(r"\s*#\s*(\w*)\s*(.*)$", ligne)
            if not m:
                out.append(self._developper(ligne) if actif() else "")
                continue
            d, reste = m.group(1), m.group(2).strip()
            out.append("")
            if d in ("ifdef", "ifndef"):
                v = (reste.split()[0] in self.macros) if reste else False
                pile.append([actif() and (v if d == "ifdef" else not v), False])
                pile[-1][1] = pile[-1][0]
            elif d == "if":
                v = actif() and self._condition(reste, num)
                pile.append([v, v])
            elif d == "elif":
                if not pile:
                    raise ErreurC("ligne %d : #elif sans #if" % num)
                p = pile.pop()
                v = not p[1] and actif() and self._condition(reste, num)
                pile.append([v, p[1] or v])
            elif d == "else":
                if not pile:
                    raise ErreurC("ligne %d : #else sans #if" % num)
                p = pile.pop()
                pile.append([not p[1] and actif(), True])
            elif d == "endif":
                if not pile:
                    raise ErreurC("ligne %d : #endif sans #if" % num)
                pile.pop()
            elif not actif():
                continue
            elif d == "define":
                m2 = re.match(r"(\w+)(\(([^)]*)\))?\s*(.*)$", reste)
                if not m2:
                    raise ErreurC("ligne %d : #define illisible" % num)
                params = None if m2.group(2) is None else [p.strip() for p in m2.group(3).split(",") if p.strip()]
                self.macros[m2.group(1)] = (params, m2.group(4))
            elif d == "undef":
                self.macros.pop(reste, None)
            elif d == "include":
                f = reste.strip('<>"')
                if f in STD:
                    continue
                if f not in self.fichiers:
                    raise ErreurC("ligne %d : fichier d'en-tête inconnu : %s" % (num, f))
                if f not in self.inclus:
                    self.inclus.add(f)
                    out[-1] = self.traiter(self.fichiers[f], f) + '\n# %d "%s"' % (num + 1, nom)
            elif d == "error":
                raise ErreurC("ligne %d : #error %s" % (num, reste))
            elif d in ("pragma", "line", ""):
                continue
            else:
                raise ErreurC("ligne %d : directive inconnue #%s" % (num, d))
        if pile:
            raise ErreurC("#if sans #endif")
        return "\n".join(out)


# ---------------------------------------------------------------- types (modèle LP64 de gcc sur x86-64)

class T:
    __slots__ = ("k", "size", "align", "signed", "nom", "to", "n", "champs", "complet", "ret", "params", "variadique")

    def __init__(self, k, size=0, align=1, signed=False, nom="", to=None, n=None):
        self.k, self.size, self.align, self.signed, self.nom, self.to, self.n = k, size, align, signed, nom, to, n
        self.champs, self.complet, self.ret, self.params, self.variadique = None, True, None, None, False

    def __repr__(self):
        if self.k == "ptr":
            return repr(self.to) + " *"
        if self.k == "array":
            return "%r[%s]" % (self.to, self.n)
        return self.nom or self.k


def _int(size, signed, nom):
    return T("int", size, size, signed, nom)


BOOL = _int(1, False, "_Bool")
CHAR, SCHAR, UCHAR = _int(1, True, "char"), _int(1, True, "signed char"), _int(1, False, "unsigned char")
SHORT, USHORT = _int(2, True, "short"), _int(2, False, "unsigned short")
INT, UINT = _int(4, True, "int"), _int(4, False, "unsigned int")
LONG, ULONG = _int(8, True, "long"), _int(8, False, "unsigned long")
FLOAT, DOUBLE = T("float", 4, 4, True, "float"), T("float", 8, 8, True, "double")
VOID = T("void", 1, 1, nom="void")
NOMS_BASE = {
    ("_Bool",): BOOL, ("char",): CHAR, ("signed", "char"): SCHAR, ("unsigned", "char"): UCHAR,
    ("short",): SHORT, ("unsigned", "short"): USHORT, ("int",): INT, ("signed",): INT, ("unsigned",): UINT,
    ("long",): LONG, ("unsigned", "long"): ULONG, ("float",): FLOAT, ("double",): DOUBLE, ("void",): VOID,
}


def ptr(t):
    return T("ptr", 8, 8, False, "", to=t)


def type_base(noms):
    noms = [n for n in noms if n not in ("int",) or len(noms) == 1]
    noms = tuple(sorted(set(n for n in noms if n != "long") | ({"long"} if "long" in noms else set()),
                        key=["signed", "unsigned", "char", "short", "long", "int", "float", "double", "void", "_Bool"].index))
    if noms == ("signed", "long") or noms == ("signed", "short"):
        noms = noms[1:]
    if noms == ("long", "double"):
        return DOUBLE
    return NOMS_BASE.get(noms)


def entier(t):
    return t.k == "int"


def arith(t):
    return t.k in ("int", "float")


def scalaire(t):
    return t.k in ("int", "float", "ptr")


def promu(t):
    return INT if t.k == "int" and t.size < 4 else t


def commun(a, b):
    """Conversions arithmétiques usuelles."""
    if a.k == "float" or b.k == "float":
        return DOUBLE if DOUBLE in (a, b) or a.size == 8 and a.k == "float" or b.size == 8 and b.k == "float" else FLOAT
    a, b = promu(a), promu(b)
    if a.size == b.size:
        return a if not a.signed else b
    grand, petit = (a, b) if a.size > b.size else (b, a)
    return grand


# ---------------------------------------------------------------- machine

TAILLE_MEMOIRE = 8 << 20
DEBUT_GLOBALES, DEBUT_PILE, DEBUT_TAS = 0x1000, 0x300000, 0x600000
BASE_FONCTIONS = 0x7F000000
LIMITE_PAS = 2_000_000
BRK, CONT, RET = object(), object(), object()


class Cadre:
    __slots__ = ("base", "ret")

    def __init__(self, base):
        self.base, self.ret = base, None


class Fonction:
    def __init__(self, nom, t, adresse):
        self.nom, self.t, self.adresse = nom, t, adresse
        self.corps, self.taille, self.params, self.native = None, 0, [], None


class Programme:
    def __init__(self, sortie=None):
        self.mem = bytearray(TAILLE_MEMOIRE)
        self.glob = DEBUT_GLOBALES
        self.sp = DEBUT_PILE
        self.tas = DEBUT_TAS
        self.pas = 0
        self.sortie = sortie if sortie is not None else bytearray()
        self.portees = [{}]
        self.etiquettes = [{}]
        self.fonctions = []
        self.chaines = {}
        self.cadre_courant = None
        self.init_globales = []
        self.fonction_courante = None
        self._natives()

    # -- mémoire
    def allouer_global(self, taille, align):
        self.glob = (self.glob + align - 1) // align * align
        a = self.glob
        self.glob += max(taille, 1)
        if self.glob >= DEBUT_PILE:
            raise ErreurC("mémoire globale épuisée")
        return a

    def chargeur(self, t, node=None):
        mem = self.mem
        if t.k == "int":
            n, s = t.size, t.signed
            if t is BOOL:
                def ld(a):
                    if a < DEBUT_GLOBALES or a >= TAILLE_MEMOIRE:
                        raise self._adresse(a, node)
                    return 1 if mem[a] else 0
                return ld

            def ld(a):
                if a < DEBUT_GLOBALES or a + n > TAILLE_MEMOIRE:
                    raise self._adresse(a, node)
                return int.from_bytes(mem[a:a + n], "little", signed=s)
            return ld
        if t.k == "ptr":
            def ld(a):
                if a < DEBUT_GLOBALES or a + 8 > TAILLE_MEMOIRE:
                    raise self._adresse(a, node)
                return int.from_bytes(mem[a:a + 8], "little")
            return ld
        if t.k == "float":
            fmt, n = ("<f", 4) if t.size == 4 else ("<d", 8)

            def ld(a):
                if a < DEBUT_GLOBALES or a + n > TAILLE_MEMOIRE:
                    raise self._adresse(a, node)
                return struct.unpack_from(fmt, mem, a)[0]
            return ld
        return lambda a: a  # tableaux, structures, fonctions : la valeur est l'adresse

    def ecriveur(self, t, node=None):
        mem = self.mem
        if t.k in ("int", "ptr"):
            n, s = t.size, t.signed and t.k == "int"

            def st(a, v):
                if a < DEBUT_GLOBALES or a + n > TAILLE_MEMOIRE:
                    raise self._adresse(a, node)
                mem[a:a + n] = v.to_bytes(n, "little", signed=s)
            return st
        if t.k == "float":
            fmt, n = ("<f", 4) if t.size == 4 else ("<d", 8)

            def st(a, v):
                if a < DEBUT_GLOBALES or a + n > TAILLE_MEMOIRE:
                    raise self._adresse(a, node)
                struct.pack_into(fmt, mem, a, v)
            return st
        if t.k in ("struct", "array"):
            n = t.size

            def st(a, v):
                if isinstance(v, (bytes, bytearray)):
                    mem[a:a + n] = v
                else:
                    mem[a:a + n] = mem[v:v + n]
            return st
        raise ErreurC("affectation impossible vers le type %r" % t)

    def _adresse(self, a, node):
        if a < DEBUT_GLOBALES:
            return _err(node, "déréférencement d'un pointeur NULL ou invalide (adresse 0x%x)" % a)
        return _err(node, "accès mémoire hors limites (adresse 0x%x)" % a)

    def chaine(self, a, limite=1 << 16):
        mem = self.mem
        if a < DEBUT_GLOBALES:
            raise ErreurC("chaîne à l'adresse NULL")
        fin = mem.find(0, a, a + limite)
        if fin < 0:
            raise ErreurC("chaîne sans caractère nul de fin")
        return bytes(mem[a:fin])

    # -- conversions
    def conv(self, fn, de, vers, node=None):
        if vers.k == "void":
            return fn
        if de.k == vers.k == "int" and de.size == vers.size and de.signed == vers.signed and vers is not BOOL:
            return fn
        if vers is BOOL:
            return lambda f: 1 if fn(f) else 0
        if vers.k == "int":
            n, s = vers.size * 8, vers.signed
            masque, demi = (1 << n) - 1, 1 << (n - 1)
            if de.k == "float":
                def cv(f):
                    v = fn(f)
                    if v != v or v in (math.inf, -math.inf):
                        raise _err(node, "conversion d'un flottant infini ou NaN en entier")
                    v = int(v)
                    return ((v + demi) & masque) - demi if s else v & masque
                return cv
            if s:
                return lambda f: ((fn(f) + demi) & masque) - demi
            return lambda f: fn(f) & masque
        if vers.k == "float":
            if vers.size == 4:
                pk, up = struct.pack, struct.unpack
                return lambda f: up("<f", pk("<f", float(fn(f))))[0]
            if de.k == "float":
                return fn
            return lambda f: float(fn(f))
        if vers.k == "ptr":
            if de.k == "float":
                raise _err(node, "conversion d'un flottant en pointeur")
            if de.k == "ptr" or de.k in ("array", "func"):
                return fn
            return lambda f: fn(f) & 0xFFFFFFFFFFFFFFFF
        if vers.k == "struct":
            return fn
        raise _err(node, "conversion impossible de %r vers %r" % (de, vers))

    def enveloppe(self, t):
        """Ramène un résultat Python dans le domaine du type t (arithmétique modulaire)."""
        if t.k != "int":
            if t.k == "float" and t.size == 4:
                return lambda v: struct.unpack("<f", struct.pack("<f", v))[0]
            return None
        n = t.size * 8
        masque, demi = (1 << n) - 1, 1 << (n - 1)
        if t.signed:
            return lambda v: ((v + demi) & masque) - demi
        return lambda v: v & masque

    # -- portées
    def chercher(self, nom):
        for p in reversed(self.portees):
            if nom in p:
                return p[nom]
        return None

    def chercher_etiquette(self, nom):
        for p in reversed(self.etiquettes):
            if nom in p:
                return p[nom]
        return None

    # ------------------------------------------------------------ types depuis l'AST
    def type_de(self, node):
        if isinstance(node, c_ast.Typename):
            return self.type_de(node.type)
        if isinstance(node, c_ast.TypeDecl):
            return self.type_de(node.type)
        if isinstance(node, c_ast.PtrDecl):
            return ptr(self.type_de(node.type))
        if isinstance(node, c_ast.ArrayDecl):
            el = self.type_de(node.type)
            n = None if node.dim is None else self.constante(node.dim)
            if n is not None and n < 0:
                raise _err(node, "taille de tableau négative")
            t = T("array", el.size * (n or 0), el.align, to=el, n=n)
            return t
        if isinstance(node, c_ast.FuncDecl):
            t = T("func", 1, 1)
            t.ret = self.type_de(node.type)
            t.params = []
            if node.args:
                for p in node.args.params:
                    if isinstance(p, c_ast.EllipsisParam):
                        t.variadique = True
                        continue
                    pt = self.type_de(p.type if isinstance(p, (c_ast.Decl, c_ast.Typename)) else p)
                    if pt.k == "void":
                        continue
                    if pt.k == "array":
                        pt = ptr(pt.to)
                    if pt.k == "func":
                        pt = ptr(pt)
                    t.params.append(pt)
            return t
        if isinstance(node, c_ast.IdentifierType):
            if len(node.names) == 1:
                s = self.chercher(node.names[0])
                if s and s[0] == "typedef":
                    return s[1]
            t = type_base(node.names)
            if t is None:
                raise _err(node, "type inconnu : %s" % " ".join(node.names))
            return t
        if isinstance(node, (c_ast.Struct, c_ast.Union)):
            return self.type_struct(node)
        if isinstance(node, c_ast.Enum):
            if node.values:
                v = -1
                for e in node.values.enumerators:
                    v = v + 1 if e.value is None else self.constante(e.value)
                    self.portees[-1][e.name] = ("enum", v)
            return INT
        if isinstance(node, c_ast.Decl):
            return self.type_de(node.type)
        raise _err(node, "déclaration non prise en charge (%s)" % type(node).__name__)

    def type_struct(self, node):
        union = isinstance(node, c_ast.Union)
        cle = ("union " if union else "struct ") + (node.name or "#%d" % id(node))
        t = None
        if node.decls is None:
            t = self.chercher_etiquette(cle)
            if t is None:
                t = T("struct", 0, 1, nom=cle)
                t.complet = False
                self.etiquettes[-1][cle] = t
            return t
        if node.name:
            t = self.etiquettes[-1].get(cle)
        if t is None:
            t = T("struct", 0, 1, nom=cle)
            if node.name:
                self.etiquettes[-1][cle] = t
        champs, off, align, taille = {}, 0, 1, 0
        for d in node.decls:
            ct = self.type_de(d.type)
            if d.bitsize is not None:
                raise _err(d, "les champs de bits ne sont pas pris en charge : utilise des masques")
            if ct.k == "struct" and not ct.complet or ct.k == "array" and ct.n is None:
                raise _err(d, "champ de type incomplet")
            if union:
                o = 0
                taille = max(taille, ct.size)
            else:
                o = (off + ct.align - 1) // ct.align * ct.align
                off = o + ct.size
            align = max(align, ct.align)
            if d.name:
                champs[d.name] = (o, ct)
            elif ct.k == "struct":
                for k, (o2, t2) in ct.champs.items():
                    champs[k] = (o + o2, t2)
        taille = taille if union else off
        t.size, t.align, t.champs, t.complet = (taille + align - 1) // align * align, align, champs, True
        return t

    def constante(self, node):
        t, fn = self.rv(node)
        if not entier(t):
            raise _err(node, "constante entière attendue")
        return fn(None)

    # ------------------------------------------------------------ déclarations
    def declarer(self, decl, globale):
        if decl.name is None:  # struct S { … }; ou enum { … };
            self.type_de(decl.type)
            return None
        if "typedef" in decl.storage:
            self.portees[-1][decl.name] = ("typedef", self.type_de(decl.type))
            return None
        t = self.type_de(decl.type)
        if t.k == "func":
            s = self.chercher(decl.name)
            if s and s[0] == "func":
                return None
            f = Fonction(decl.name, t, BASE_FONCTIONS + len(self.fonctions))
            if decl.name in self.natives:
                f.native = self.natives[decl.name]
            self.fonctions.append(f)
            self.portees[0][decl.name] = ("func", f)
            return None
        if t.k == "array" and t.n is None and decl.init is not None:
            if isinstance(decl.init, c_ast.InitList):
                n = len(decl.init.exprs)
            elif isinstance(decl.init, c_ast.Constant) and decl.init.type == "string":
                n = len(self.octets_chaine(decl.init.value)) + 1
            else:
                raise _err(decl, "initialisation de tableau invalide")
            t = T("array", t.to.size * n, t.to.align, to=t.to, n=n)
        if t.k == "void" or t.k == "struct" and not t.complet:
            raise _err(decl, "variable de type incomplet : %s" % decl.name)
        statique = globale or "static" in decl.storage
        if "extern" in decl.storage:
            s = self.chercher(decl.name)
            if s:
                return None
        if statique:
            ancien = self.portees[-1].get(decl.name) if globale else None
            if ancien and ancien[0] == "var" and ancien[3]:
                a = ancien[2]
            else:
                a = self.allouer_global(t.size, t.align)
            self.portees[-1][decl.name] = ("var", t, a, True)
            if decl.init is not None:
                init = self.initialiseur(t, decl.init, lambda f, a=a: a)
                self.init_globales.append(init) if globale else init(None)
            return None
        fc = self.fonction_courante
        off = (fc.taille + t.align - 1) // t.align * t.align
        fc.taille = off + t.size
        self.portees[-1][decl.name] = ("var", t, off, False)
        if decl.init is None:
            return None
        return self.initialiseur(t, decl.init, lambda f, off=off: f.base + off, zero=True)

    def initialiseur(self, t, init, adr, zero=False):
        """Renvoie une fonction qui initialise l'objet de type t à l'adresse adr(f)."""
        mem = self.mem
        actions = []

        def remplir(t, init, depl):
            if t.k == "array" and isinstance(init, c_ast.Constant) and init.type == "string" and t.to.size == 1:
                b = self.octets_chaine(init.value) + b"\0"
                b = b[:t.size].ljust(t.size, b"\0")
                actions.append(lambda f, depl=depl: mem.__setitem__(slice(adr(f) + depl, adr(f) + depl + len(b)), b))
                return
            if t.k in ("array", "struct") and isinstance(init, c_ast.InitList):
                if t.k == "array":
                    i = 0
                    for e in init.exprs:
                        if isinstance(e, c_ast.NamedInitializer):
                            i = self.constante(e.name[0])
                            e = e.expr
                        if t.n is not None and i >= t.n:
                            raise _err(init, "trop d'éléments dans l'initialisation")
                        remplir(t.to, e, depl + i * t.to.size)
                        i += 1
                else:
                    noms = list(t.champs)
                    i = 0
                    for e in init.exprs:
                        if isinstance(e, c_ast.NamedInitializer):
                            nom = e.name[0].name
                            if nom not in t.champs:
                                raise _err(e, "champ inconnu : %s" % nom)
                            i = noms.index(nom)
                            e = e.expr
                        if i >= len(noms):
                            raise _err(init, "trop d'éléments dans l'initialisation")
                        o, ct = t.champs[noms[i]]
                        remplir(ct, e, depl + o)
                        i += 1
                return
            if isinstance(init, c_ast.InitList):
                if len(init.exprs) != 1:
                    raise _err(init, "initialisation invalide")
                init = init.exprs[0]
            et, ef = self.rv(init)
            self.verifier_affectation(t, et, init)
            ef = self.conv(ef, et, t, init)
            st = self.ecriveur(t, init)
            actions.append(lambda f, depl=depl: st(adr(f) + depl, ef(f)))

        remplir(t, init, 0)
        taille = t.size

        def run(f):
            if zero:
                a = adr(f)
                mem[a:a + taille] = bytes(taille)
            for x in actions:
                x(f)
        return run

    def verifier_affectation(self, cible, source, node):
        if cible.k == "struct":
            if source is not cible:
                raise _err(node, "types de structures incompatibles")
        elif cible.k == "ptr" and source.k == "float" or cible.k == "float" and source.k == "ptr":
            raise _err(node, "conversion impossible entre pointeur et flottant")

    # ------------------------------------------------------------ expressions
    def octets_chaine(self, lit):
        corps = lit[1:-1]
        out = bytearray()
        i = 0
        echappements = {"n": 10, "t": 9, "r": 13, "0": 0, "\\": 92, "'": 39, '"': 34, "a": 7, "b": 8, "f": 12, "v": 11, "?": 63}
        while i < len(corps):
            c = corps[i]
            if c == "\\":
                i += 1
                c = corps[i]
                if c == "x":
                    m = re.match(r"[0-9a-fA-F]+", corps[i + 1:])
                    out.append(int(m.group(0), 16) & 0xFF)
                    i += 1 + len(m.group(0))
                    continue
                if c in "01234567":
                    m = re.match(r"[0-7]{1,3}", corps[i:])
                    out.append(int(m.group(0), 8) & 0xFF)
                    i += len(m.group(0))
                    continue
                out.append(echappements.get(c, ord(c)))
            else:
                out += c.encode("utf-8")
            i += 1
        return bytes(out)

    def litteral(self, node):
        v, ty = node.value, node.type
        if ty == "string":
            b = self.octets_chaine(v)
            if b not in self.chaines:
                a = self.allouer_global(len(b) + 1, 1)
                self.mem[a:a + len(b)] = b
                self.chaines[b] = a
            a = self.chaines[b]
            return T("array", len(b) + 1, 1, to=CHAR, n=len(b) + 1), lambda f: a
        if ty == "char":
            b = self.octets_chaine(v)
            if len(b) != 1:
                raise _err(node, "constante caractère invalide : %s" % v)
            x = b[0] - 256 if b[0] > 127 else b[0]
            return INT, lambda f: x
        if ty in ("float", "double"):
            s = v.rstrip("fFlL")
            x = float.fromhex(s) if s.lower().startswith("0x") else float(s)
            if v[-1] in "fF":
                x = struct.unpack("<f", struct.pack("<f", x))[0]
                return FLOAT, lambda f: x
            return DOUBLE, lambda f: x
        m = re.match(r"(0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]*|[1-9]\d*)([uUlL]*)$", v)
        if not m:
            raise _err(node, "constante invalide : %s" % v)
        corps, suf = m.group(1), m.group(2).lower()
        if corps[:2].lower() == "0x":
            x = int(corps, 16)
        elif corps[:2].lower() == "0b":
            x = int(corps[2:], 2)
        elif corps.startswith("0") and len(corps) > 1:
            x = int(corps, 8)
        else:
            x = int(corps)
        decimal = corps[0] != "0" or corps == "0"
        if "u" in suf:
            t = UINT if "l" not in suf and x < 1 << 32 else ULONG
        elif "l" in suf:
            t = LONG if x < 1 << 63 else ULONG
        elif x < 1 << 31:
            t = INT
        elif not decimal and x < 1 << 32:
            t = UINT
        elif x < 1 << 63:
            t = LONG
        else:
            t = ULONG
        return t, lambda f: x

    def lv(self, node):
        """Expression désignant un objet : renvoie (type, fonction qui calcule son adresse)."""
        if isinstance(node, c_ast.ID):
            s = self.chercher(node.name)
            if s is None:
                raise _err(node, "« %s » n'est pas déclaré" % node.name)
            if s[0] == "var":
                _, t, a, glob = s
                if glob:
                    return t, lambda f: a
                return t, lambda f: f.base + a
            if s[0] == "func":
                fn = s[1]
                return fn.t, lambda f: fn.adresse
            raise _err(node, "« %s » n'est pas une variable" % node.name)
        if isinstance(node, c_ast.UnaryOp) and node.op == "*":
            t, fn = self.rv(node.expr)
            if t.k != "ptr":
                raise _err(node, "on ne peut déréférencer que des pointeurs (type %r)" % t)
            if t.to.k == "void":
                raise _err(node, "déréférencement d'un pointeur void * : convertis-le d'abord")
            return t.to, fn
        if isinstance(node, c_ast.ArrayRef):
            bt, bf = self.rv(node.name)
            it, iff = self.rv(node.subscript)
            if bt.k != "ptr" and it.k == "ptr":
                bt, bf, it, iff = it, iff, bt, bf
            if bt.k != "ptr" or not entier(it):
                raise _err(node, "indexation invalide")
            el = bt.to
            n = el.size
            return el, lambda f: bf(f) + iff(f) * n
        if isinstance(node, c_ast.StructRef):
            if node.type == "->":
                bt, bf = self.rv(node.name)
                if bt.k != "ptr" or bt.to.k != "struct":
                    raise _err(node, "-> s'utilise sur un pointeur vers une structure")
                st = bt.to
            else:
                st, bf = self.lv(node.name)
                if st.k != "struct":
                    raise _err(node, ". s'utilise sur une structure")
            if not st.complet:
                raise _err(node, "structure incomplète")
            nom = node.field.name
            if nom not in st.champs:
                raise _err(node, "pas de champ « %s » dans %r" % (nom, st))
            o, ct = st.champs[nom]
            return ct, lambda f: bf(f) + o
        if isinstance(node, c_ast.Constant) and node.type == "string":
            return self.litteral(node)
        if isinstance(node, c_ast.FuncCall):
            t, fn = self.rv(node)
            if t.k == "struct":
                return t, fn
        if isinstance(node, c_ast.CompoundLiteral):
            t = self.type_de(node.type)
            fc = self.fonction_courante
            if fc is None:
                a = self.allouer_global(t.size, t.align)
                self.initialiseur(t, node.init, lambda f: a)(None)
                return t, lambda f: a
            off = (fc.taille + t.align - 1) // t.align * t.align
            fc.taille = off + t.size
            init = self.initialiseur(t, node.init, lambda f: f.base + off, zero=True)

            def cl(f):
                init(f)
                return f.base + off
            return t, cl
        raise _err(node, "cette expression ne désigne pas un objet modifiable")

    def rv(self, node):
        """Expression évaluée : renvoie (type, fonction qui calcule sa valeur). Tableaux et fonctions → adresse."""
        t, fn = self.rv_brut(node)
        if t.k == "array":
            return ptr(t.to), fn
        if t.k == "func":
            return ptr(t), fn
        return t, fn

    def rv_brut(self, node):
        if isinstance(node, c_ast.Constant):
            return self.litteral(node)
        if isinstance(node, c_ast.ID):
            s = self.chercher(node.name)
            if s and s[0] == "enum":
                v = s[1]
                return INT, lambda f: v
            t, adr = self.lv(node)
            ld = self.chargeur(t, node)
            if t.k in ("array", "struct", "func"):
                return t, adr
            return t, lambda f: ld(adr(f))
        if isinstance(node, (c_ast.ArrayRef, c_ast.StructRef)) or isinstance(node, c_ast.UnaryOp) and node.op == "*":
            t, adr = self.lv(node)
            if t.k in ("array", "struct", "func"):
                return t, adr
            ld = self.chargeur(t, node)
            return t, lambda f: ld(adr(f))
        if isinstance(node, c_ast.CompoundLiteral):
            t, adr = self.lv(node)
            if t.k in ("array", "struct"):
                return t, adr
            ld = self.chargeur(t, node)
            return t, lambda f: ld(adr(f))
        if isinstance(node, c_ast.Cast):
            cible = self.type_de(node.to_type)
            t, fn = self.rv(node.expr)
            if cible.k == "void":
                return VOID, fn
            if cible.k == "struct" or t.k == "struct":
                raise _err(node, "conversion de structure impossible")
            return cible, self.conv(fn, t, cible, node)
        if isinstance(node, c_ast.UnaryOp):
            return self.unaire(node)
        if isinstance(node, c_ast.BinaryOp):
            return self.binaire(node)
        if isinstance(node, c_ast.Assignment):
            return self.affectation(node)
        if isinstance(node, c_ast.TernaryOp):
            ct, cf = self.rv(node.cond)
            at, af = self.rv(node.iftrue)
            bt, bf = self.rv(node.iffalse)
            if arith(at) and arith(bt):
                rt = commun(at, bt)
                af, bf = self.conv(af, at, rt), self.conv(bf, bt, rt)
            elif at.k == "ptr":
                rt = at
            elif bt.k == "ptr":
                rt = bt
            else:
                rt = at
            return rt, lambda f: af(f) if cf(f) else bf(f)
        if isinstance(node, c_ast.FuncCall):
            return self.appel(node)
        if isinstance(node, c_ast.ExprList):
            parts = [self.rv(e) for e in node.exprs]
            fns = [p[1] for p in parts]

            def virgule(f):
                v = None
                for x in fns:
                    v = x(f)
                return v
            return parts[-1][0], virgule
        if isinstance(node, c_ast.Typename):
            raise _err(node, "type inattendu ici")
        raise _err(node, "expression non prise en charge (%s)" % type(node).__name__)

    def taille_de(self, node):
        if isinstance(node, c_ast.Typename):
            t = self.type_de(node)
        else:
            portees = [dict(p) for p in self.portees]
            t, _ = self.rv_brut(node)
            self.portees = portees
        if t.k == "func" or t.k == "struct" and not t.complet:
            raise _err(node, "sizeof sur un type incomplet")
        return t.size

    def unaire(self, node):
        op = node.op
        if op == "sizeof":
            n = self.taille_de(node.expr)
            return ULONG, lambda f: n
        if op == "&":
            if isinstance(node.expr, c_ast.ID):
                s = self.chercher(node.expr.name)
                if s and s[0] == "func":
                    fn = s[1]
                    return ptr(fn.t), lambda f: fn.adresse
            t, adr = self.lv(node.expr)
            return ptr(t), adr
        if op in ("++", "--", "p++", "p--"):
            t, adr = self.lv(node.expr)
            if not scalaire(t):
                raise _err(node, "++ et -- s'appliquent à des nombres ou des pointeurs")
            pas = t.to.size if t.k == "ptr" else 1
            pas = -pas if "-" in op else pas
            ld, st = self.chargeur(t, node), self.ecriveur(t, node)
            env = self.enveloppe(t) or (lambda v: v)
            if t.k == "ptr":
                env = lambda v: v & 0xFFFFFFFFFFFFFFFF
            if op[0] == "p":
                def post(f):
                    a = adr(f)
                    v = ld(a)
                    st(a, env(v + pas))
                    return v
                return t, post

            def pre(f):
                a = adr(f)
                v = env(ld(a) + pas)
                st(a, v)
                return v
            return t, pre
        t, fn = self.rv(node.expr)
        if op == "!":
            if not scalaire(t):
                raise _err(node, "! s'applique à un scalaire")
            return INT, lambda f: 0 if fn(f) else 1
        if op == "-" or op == "+" or op == "~":
            if not arith(t) or op == "~" and not entier(t):
                raise _err(node, "opérateur %s invalide sur %r" % (op, t))
            rt = promu(t)
            fn = self.conv(fn, t, rt)
            if op == "+":
                return rt, fn
            env = self.enveloppe(rt) or (lambda v: v)
            if op == "-":
                return rt, lambda f: env(-fn(f))
            return rt, lambda f: env(~fn(f))
        raise _err(node, "opérateur %s non pris en charge" % op)

    OPS = {"+": operator.add, "-": operator.sub, "*": operator.mul, "&": operator.and_, "|": operator.or_,
           "^": operator.xor, "<": operator.lt, ">": operator.gt, "<=": operator.le, ">=": operator.ge,
           "==": operator.eq, "!=": operator.ne}

    def operation(self, op, lt, lf, rt, rf, node):
        """Calcule l op r avec les règles du C ; renvoie (type, fonction)."""
        if op in ("&&", "||"):
            if not scalaire(lt) or not scalaire(rt):
                raise _err(node, "%s s'applique à des scalaires" % op)
            if op == "&&":
                return INT, lambda f: 1 if lf(f) and rf(f) else 0
            return INT, lambda f: 1 if lf(f) or rf(f) else 0
        if op in ("+", "-") and (lt.k == "ptr" or rt.k == "ptr"):
            if lt.k == "ptr" and rt.k == "ptr":
                if op != "-":
                    raise _err(node, "on ne peut pas additionner deux pointeurs")
                n = lt.to.size or 1
                return LONG, lambda f: int((lf(f) - rf(f)) / n)
            if rt.k == "ptr":
                if op == "-":
                    raise _err(node, "entier moins pointeur : invalide")
                lt, lf, rt, rf = rt, rf, lt, lf
            if not entier(rt):
                raise _err(node, "pointeur plus un non-entier")
            n = lt.to.size if lt.to.k != "void" else 1
            if op == "+":
                return lt, lambda f: (lf(f) + rf(f) * n) & 0xFFFFFFFFFFFFFFFF
            return lt, lambda f: (lf(f) - rf(f) * n) & 0xFFFFFFFFFFFFFFFF
        if op in ("==", "!=", "<", ">", "<=", ">=") and (lt.k == "ptr" or rt.k == "ptr"):
            o = self.OPS[op]
            return INT, lambda f: 1 if o(lf(f), rf(f)) else 0
        if not arith(lt) or not arith(rt):
            raise _err(node, "opérandes invalides pour %s (%r et %r)" % (op, lt, rt))
        if op in ("<<", ">>"):
            if not entier(lt) or not entier(rt):
                raise _err(node, "décalage sur un non-entier")
            res = promu(lt)
            lf = self.conv(lf, lt, res)
            env = self.enveloppe(res)
            bits = res.size * 8
            if op == "<<":
                def gauche(f):
                    n = rf(f)
                    if n < 0 or n >= bits:
                        raise _err(node, "décalage de %d bits sur un entier de %d bits" % (n, bits))
                    return env(lf(f) << n)
                return res, gauche

            def droite(f):
                n = rf(f)
                if n < 0 or n >= bits:
                    raise _err(node, "décalage de %d bits sur un entier de %d bits" % (n, bits))
                return lf(f) >> n
            return res, droite
        ct = commun(lt, rt)
        lf, rf = self.conv(lf, lt, ct), self.conv(rf, rt, ct)
        if op in ("<", ">", "<=", ">=", "==", "!="):
            o = self.OPS[op]
            return INT, lambda f: 1 if o(lf(f), rf(f)) else 0
        if op in ("&", "|", "^") and ct.k == "float" or op == "%" and ct.k == "float":
            raise _err(node, "opérateur %s invalide sur des flottants" % op)
        env = self.enveloppe(ct)
        if op in ("/", "%"):
            flottant = ct.k == "float"

            def div(f):
                a, b = lf(f), rf(f)
                if b == 0:
                    if flottant:
                        return math.copysign(math.inf, a) if a else math.nan
                    raise _err(node, "division par zéro")
                if flottant:
                    q = a / b
                    return env(q) if env else q
                q = abs(a) // abs(b)
                if (a < 0) != (b < 0):
                    q = -q
                return env(q if op == "/" else a - b * q)
            return ct, div
        o = self.OPS[op]
        if env is None:
            return ct, lambda f: o(lf(f), rf(f))
        return ct, lambda f: env(o(lf(f), rf(f)))

    def binaire(self, node):
        lt, lf = self.rv(node.left)
        rt, rf = self.rv(node.right)
        return self.operation(node.op, lt, lf, rt, rf, node)

    def affectation(self, node):
        t, adr = self.lv(node.lvalue)
        if t.k == "array":
            raise _err(node, "on ne peut pas affecter un tableau entier")
        st = self.ecriveur(t, node)
        et, ef = self.rv(node.rvalue)
        if node.op == "=":
            self.verifier_affectation(t, et, node)
            ef = self.conv(ef, et, t, node)

            def aff(f):
                a = adr(f)
                v = ef(f)
                st(a, v)
                return v
            return t, aff
        ld = self.chargeur(t, node)
        cache = {}
        courant = lambda f: ld(cache["a"])
        rt, rf = self.operation(node.op[:-1], t, courant, et, ef, node)
        rf = self.conv(rf, rt, t, node)

        def compose(f):
            cache["a"] = a = adr(f)
            v = rf(f)
            st(a, v)
            return v
        return t, compose

    # ------------------------------------------------------------ appels
    def appel(self, node):
        args = node.args.exprs if node.args else []
        direct = None
        if isinstance(node.name, c_ast.ID):
            s = self.chercher(node.name.name)
            if s is None:
                if node.name.name in self.natives:
                    raise _err(node, "fonction %s utilisée sans son #include" % node.name.name)
                raise _err(node, "fonction « %s » non déclarée (déclare-la ou définis-la avant de l'appeler)" % node.name.name)
            if s[0] == "func":
                direct = s[1]
        if direct is not None:
            ft = direct.t
            cible = lambda f: direct
        else:
            pt, pf = self.rv(node.name)
            if pt.k != "ptr" or pt.to.k != "func":
                raise _err(node, "appel de quelque chose qui n'est pas une fonction")
            ft = pt.to
            fonctions = self.fonctions

            def cible(f):
                a = pf(f)
                i = a - BASE_FONCTIONS
                if not 0 <= i < len(fonctions):
                    raise _err(node, "appel par un pointeur de fonction invalide")
                return fonctions[i]
        if len(args) < len(ft.params) or len(args) > len(ft.params) and not ft.variadique:
            raise _err(node, "%d argument(s) attendu(s), %d donné(s)" % (len(ft.params), len(args)))
        evals, types = [], []
        for i, a in enumerate(args):
            at, af = self.rv(a)
            if i < len(ft.params):
                pt = ft.params[i]
                self.verifier_affectation(pt, at, a)
                af = self.conv(af, at, pt, a)
                at = pt
            else:
                if at.k == "float":
                    af, at = self.conv(af, at, DOUBLE), DOUBLE
                elif at.k == "int":
                    p = promu(at)
                    af, at = self.conv(af, at, p), p
            if at.k == "struct":
                n = at.size
                mem = self.mem
                af = (lambda g, n: lambda f: bytes(mem[g(f):g(f) + n]))(af, n)
            evals.append(af)
            types.append(at)
        rt = ft.ret
        prog = self
        tmp = None
        if rt.k == "struct":
            fc = self.fonction_courante
            if fc is None:
                raise _err(node, "appel hors d'une fonction")
            tmp = (fc.taille + rt.align - 1) // rt.align * rt.align
            fc.taille = tmp + rt.size

        def call(f):
            fn = cible(f)
            vals = [e(f) for e in evals]
            if fn.native is not None:
                return fn.native(list(zip(types, vals)), node)
            v = prog.invoquer(fn, vals, node)
            if tmp is not None:
                a = f.base + tmp
                prog.mem[a:a + rt.size] = v
                return a
            return v
        return rt, call

    def invoquer(self, fn, vals, node=None):
        if fn.corps is None:
            raise _err(node, "fonction « %s » déclarée mais jamais définie" % fn.nom)
        self.pas += 1
        if self.pas > LIMITE_PAS:
            raise _err(node, "trop d'étapes : boucle infinie ou récursion sans fin ?")
        base = self.sp
        self.sp = (base + fn.taille + 15) // 16 * 16
        if self.sp >= DEBUT_TAS:
            self.sp = base
            raise _err(node, "dépassement de pile (récursion trop profonde ?)")
        self.mem[base:self.sp] = bytes(self.sp - base)
        f = Cadre(base)
        for (off, st), v in zip(fn.params, vals):
            st(base + off, v)
        try:
            fn.corps(f)
        finally:
            self.sp = base
        return f.ret

    # ------------------------------------------------------------ instructions
    def instr(self, node):
        if node is None or isinstance(node, c_ast.EmptyStatement):
            return lambda f: None
        if isinstance(node, c_ast.Compound):
            self.portees.append({})
            self.etiquettes.append({})
            fns = [self.instr(x) for x in (node.block_items or [])]
            self.portees.pop()
            self.etiquettes.pop()
            fns = [x for x in fns if x is not None]

            def bloc(f):
                for x in fns:
                    r = x(f)
                    if r is not None:
                        return r
            return bloc
        if isinstance(node, c_ast.Decl):
            init = self.declarer(node, False)
            if init is None:
                return None
            def decl(f):
                init(f)
            return decl
        if isinstance(node, c_ast.DeclList):
            inits = [self.declarer(d, False) for d in node.decls]
            inits = [i for i in inits if i]

            def decls(f):
                for i in inits:
                    i(f)
            return decls
        if isinstance(node, (c_ast.Typedef,)):
            self.portees[-1][node.name] = ("typedef", self.type_de(node.type))
            return None
        if isinstance(node, c_ast.Return):
            fc = self.fonction_courante
            if node.expr is None:
                def ret0(f):
                    return RET
                return ret0
            et, ef = self.rv(node.expr)
            rt = fc.t.ret
            if rt.k == "void":
                raise _err(node, "return avec une valeur dans une fonction void")
            self.verifier_affectation(rt, et, node)
            ef = self.conv(ef, et, rt, node)
            if rt.k == "struct":
                mem, n, g = self.mem, rt.size, ef
                ef = lambda f: bytes(mem[g(f):g(f) + n])

            def ret(f):
                f.ret = ef(f)
                return RET
            return ret
        if isinstance(node, c_ast.If):
            ct, cf = self.rv(node.cond)
            a, b = self.instr(node.iftrue) or (lambda f: None), self.instr(node.iffalse) or (lambda f: None)
            return lambda f: a(f) if cf(f) else b(f)
        if isinstance(node, (c_ast.While, c_ast.DoWhile, c_ast.For)):
            return self.boucle(node)
        if isinstance(node, c_ast.Break):
            return lambda f: BRK
        if isinstance(node, c_ast.Continue):
            return lambda f: CONT
        if isinstance(node, c_ast.Switch):
            return self.switch(node)
        if isinstance(node, (c_ast.Case, c_ast.Default)):
            raise _err(node, "case ou default en dehors d'un switch")
        if isinstance(node, (c_ast.Goto, c_ast.Label)):
            raise _err(node, "goto n'est pas pris en charge : utilise une boucle ou une fonction")
        if isinstance(node, c_ast.Pragma):
            return None
        t, fn = self.rv(node)

        def expression(f):
            fn(f)
        return expression

    def boucle(self, node):
        self.portees.append({})
        init = None
        if isinstance(node, c_ast.For) and node.init is not None:
            init = self.instr(node.init)
        cond = self.rv(node.cond)[1] if node.cond is not None else (lambda f: 1)
        suite = self.rv(node.next)[1] if isinstance(node, c_ast.For) and node.next is not None else None
        corps = self.instr(node.stmt) or (lambda f: None)
        self.portees.pop()
        prog = self
        faire = isinstance(node, c_ast.DoWhile)

        def run(f):
            if init:
                init(f)
            premier = faire
            while premier or cond(f):
                premier = False
                prog.pas += 1
                if prog.pas > LIMITE_PAS:
                    raise _err(node, "trop d'étapes : boucle infinie ?")
                r = corps(f)
                if r is not None:
                    if r is BRK:
                        break
                    if r is not CONT:
                        return r
                if suite:
                    suite(f)
        return run

    def switch(self, node):
        ct, cf = self.rv(node.cond)
        if not entier(ct):
            raise _err(node, "switch sur un non-entier")
        cf = self.conv(cf, ct, promu(ct))
        items = node.stmt.block_items if isinstance(node.stmt, c_ast.Compound) else [node.stmt]
        self.portees.append({})
        fns, cas, defaut = [], {}, None
        for it in items or []:
            while isinstance(it, (c_ast.Case, c_ast.Default)):
                if isinstance(it, c_ast.Case):
                    v = self.constante(it.expr)
                    if v in cas:
                        raise _err(it, "case %d en double" % v)
                    cas[v] = len(fns)
                else:
                    defaut = len(fns)
                stmts = it.stmts or []
                if not stmts:
                    it = None
                    break
                for s in stmts[:-1]:
                    x = self.instr(s)
                    if x:
                        fns.append(x)
                it = stmts[-1]
            if it is not None:
                x = self.instr(it)
                if x:
                    fns.append(x)
        self.portees.pop()

        def run(f):
            i = cas.get(cf(f), defaut)
            if i is None:
                return None
            for x in fns[i:]:
                r = x(f)
                if r is not None:
                    if r is BRK:
                        return None
                    return r
        return run

    # ------------------------------------------------------------ unité de traduction
    def definir(self, node):
        nom = node.decl.name
        self.declarer(node.decl, True)
        fn = self.portees[0][nom][1]
        if fn.corps is not None:
            raise _err(node, "fonction « %s » définie deux fois" % nom)
        t = self.type_de(node.decl.type)
        fn.t = t
        fn.taille = 0
        self.fonction_courante = fn
        self.portees.append({})
        self.etiquettes.append({})
        params = []
        fd = node.decl.type
        if fd.args:
            for p in fd.args.params:
                if isinstance(p, c_ast.EllipsisParam):
                    continue
                pt = self.type_de(p.type)
                if pt.k == "void":
                    continue
                if pt.k == "array":
                    pt = ptr(pt.to)
                if not p.name:
                    raise _err(p, "paramètre sans nom")
                off = (fn.taille + pt.align - 1) // pt.align * pt.align
                fn.taille = off + pt.size
                self.portees[-1][p.name] = ("var", pt, off, False)
                params.append((off, self.ecriveur(pt, p)))
        fn.params = params
        corps = self.instr(node.body)
        self.portees.pop()
        self.etiquettes.pop()
        self.fonction_courante = None
        fn.corps = corps

    def compiler(self, ast):
        for ext in ast.ext:
            if isinstance(ext, c_ast.FuncDef):
                self.definir(ext)
            elif isinstance(ext, c_ast.Decl):
                self.declarer(ext, True)
            elif isinstance(ext, c_ast.Typedef):
                self.portees[0][ext.name] = ("typedef", self.type_de(ext.type))
            elif isinstance(ext, c_ast.Pragma):
                pass
            else:
                raise _err(ext, "déclaration non prise en charge")

    def executer(self, point_entree="main"):
        for init in self.init_globales:
            init(None)
        s = self.portees[0].get(point_entree)
        if not s or s[0] != "func" or s[1].corps is None:
            raise ErreurC("pas de fonction %s() : le programme n'a pas de point d'entrée" % point_entree)
        r = self.invoquer(s[1], [])
        return r

    # ------------------------------------------------------------ bibliothèque standard
    def _natives(self):
        prog = self

        def ecrire(b):
            prog.sortie += b
            if len(prog.sortie) > 200_000:
                raise ErreurC("sortie trop longue : boucle d'affichage sans fin ?")

        def printf(args, node):
            b = prog.formater(args, node)
            ecrire(b)
            return len(b)

        def sprintf(args, node):
            dest = args[0][1]
            b = prog.formater(args[1:], node)
            prog.mem[dest:dest + len(b) + 1] = b + b"\0"
            return len(b)

        def snprintf(args, node):
            dest, n = args[0][1], args[1][1]
            b = prog.formater(args[2:], node)
            if n > 0:
                c = b[:n - 1]
                prog.mem[dest:dest + len(c) + 1] = c + b"\0"
            return len(b)

        def puts(args, node):
            ecrire(prog.chaine(args[0][1]) + b"\n")
            return 1

        def putchar(args, node):
            c = args[0][1] & 0xFF
            ecrire(bytes([c]))
            return c

        def memset(args, node):
            a, v, n = args[0][1], args[1][1] & 0xFF, args[2][1]
            prog.verifier_zone(a, n, node)
            prog.mem[a:a + n] = bytes([v]) * n
            return a

        def memcpy(args, node):
            d, s, n = args[0][1], args[1][1], args[2][1]
            prog.verifier_zone(d, n, node)
            prog.verifier_zone(s, n, node)
            prog.mem[d:d + n] = prog.mem[s:s + n]
            return d

        def memcmp(args, node):
            a, b, n = args[0][1], args[1][1], args[2][1]
            x, y = bytes(prog.mem[a:a + n]), bytes(prog.mem[b:b + n])
            return (x > y) - (x < y)

        def strlen(args, node):
            return len(prog.chaine(args[0][1]))

        def strcmp(args, node):
            x, y = prog.chaine(args[0][1]), prog.chaine(args[1][1])
            return (x > y) - (x < y)

        def strncmp(args, node):
            n = args[2][1]
            x, y = prog.chaine(args[0][1])[:n], prog.chaine(args[1][1])[:n]
            return (x > y) - (x < y)

        def strcpy(args, node):
            d = args[0][1]
            s = prog.chaine(args[1][1]) + b"\0"
            prog.verifier_zone(d, len(s), node)
            prog.mem[d:d + len(s)] = s
            return d

        def strncpy(args, node):
            d, n = args[0][1], args[2][1]
            s = prog.chaine(args[1][1])[:n].ljust(n, b"\0")
            prog.verifier_zone(d, n, node)
            prog.mem[d:d + n] = s
            return d

        def strcat(args, node):
            d = args[0][1]
            fin = d + len(prog.chaine(d))
            s = prog.chaine(args[1][1]) + b"\0"
            prog.mem[fin:fin + len(s)] = s
            return d

        def malloc(args, node):
            n = args[0][1]
            a = (prog.tas + 15) // 16 * 16
            if a + n + 16 > TAILLE_MEMOIRE:
                return 0
            prog.tas = a + max(n, 1)
            prog.mem[a:a + n] = bytes(n)
            return a

        def calloc(args, node):
            return malloc([(ULONG, args[0][1] * args[1][1])], node)

        def free(args, node):
            return None

        def abs_(args, node):
            v = abs(args[0][1])
            return v

        def exit_(args, node):
            raise SortieProgramme(args[0][1])

        def abort(args, node):
            raise _err(node, "abort() appelé")

        def assert_(args, node):
            if not args[0][1]:
                raise _err(node, "assertion échouée")
            return None

        def maths(fn):
            return lambda args, node: fn(*[float(a[1]) for a in args])

        def isdigit(args, node):
            return 1 if 48 <= args[0][1] <= 57 else 0

        def toupper(args, node):
            c = args[0][1]
            return c - 32 if 97 <= c <= 122 else c

        def tolower(args, node):
            c = args[0][1]
            return c + 32 if 65 <= c <= 90 else c

        def isalpha(args, node):
            c = args[0][1]
            return 1 if 65 <= c <= 90 or 97 <= c <= 122 else 0

        def isspace(args, node):
            return 1 if args[0][1] in (32, 9, 10, 11, 12, 13) else 0

        def atoi(args, node):
            m = re.match(rb"\s*([+-]?\d+)", prog.chaine(args[0][1]))
            return int(m.group(1)) if m else 0

        vp, cp, sz = ptr(VOID), ptr(CHAR), ULONG
        self.natives = {
            "printf": (INT, [cp], True, printf), "sprintf": (INT, [cp, cp], True, sprintf),
            "snprintf": (INT, [cp, sz, cp], True, snprintf), "puts": (INT, [cp], False, puts),
            "putchar": (INT, [INT], False, putchar), "memset": (vp, [vp, INT, sz], False, memset),
            "memcpy": (vp, [vp, vp, sz], False, memcpy), "memcmp": (INT, [vp, vp, sz], False, memcmp),
            "strlen": (sz, [cp], False, strlen), "strcmp": (INT, [cp, cp], False, strcmp),
            "strncmp": (INT, [cp, cp, sz], False, strncmp), "strcpy": (cp, [cp, cp], False, strcpy),
            "strncpy": (cp, [cp, cp, sz], False, strncpy), "strcat": (cp, [cp, cp], False, strcat),
            "malloc": (vp, [sz], False, malloc), "calloc": (vp, [sz, sz], False, calloc),
            "free": (VOID, [vp], False, free), "abs": (INT, [INT], False, abs_), "labs": (LONG, [LONG], False, abs_),
            "exit": (VOID, [INT], False, exit_), "abort": (VOID, [], False, abort),
            "__boucle_assert": (VOID, [INT], False, assert_),
            "sqrt": (DOUBLE, [DOUBLE], False, maths(math.sqrt)), "pow": (DOUBLE, [DOUBLE, DOUBLE], False, maths(math.pow)),
            "fabs": (DOUBLE, [DOUBLE], False, maths(abs)), "floor": (DOUBLE, [DOUBLE], False, maths(math.floor)),
            "ceil": (DOUBLE, [DOUBLE], False, maths(math.ceil)), "sin": (DOUBLE, [DOUBLE], False, maths(math.sin)),
            "cos": (DOUBLE, [DOUBLE], False, maths(math.cos)), "exp": (DOUBLE, [DOUBLE], False, maths(math.exp)),
            "log": (DOUBLE, [DOUBLE], False, maths(math.log)), "log10": (DOUBLE, [DOUBLE], False, maths(math.log10)),
            "round": (DOUBLE, [DOUBLE], False, maths(lambda x: float(math.floor(x + 0.5)) if x >= 0 else -float(math.floor(-x + 0.5)))),
            "isdigit": (INT, [INT], False, isdigit), "isalpha": (INT, [INT], False, isalpha),
            "isspace": (INT, [INT], False, isspace), "toupper": (INT, [INT], False, toupper),
            "tolower": (INT, [INT], False, tolower), "atoi": (INT, [cp], False, atoi),
        }
        for nom, (ret, params, var, py) in list(self.natives.items()):
            t = T("func", 1, 1)
            t.ret, t.params, t.variadique = ret, params, var
            f = Fonction(nom, t, BASE_FONCTIONS + len(self.fonctions))
            f.native = py
            self.fonctions.append(f)
            self.portees[0][nom] = ("func", f)
        self.natives = {k: v[3] for k, v in self.natives.items()}

    def verifier_zone(self, a, n, node):
        if a < DEBUT_GLOBALES or a + n > TAILLE_MEMOIRE:
            raise self._adresse(a, node)

    FORMAT = re.compile(rb"%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d*))?(hh|h|ll|l|z|j|t|L)?([diuoxXcsfFeEgGp%])")

    def formater(self, args, node):
        if not args or args[0][0].k != "ptr":
            raise _err(node, "le premier argument de printf doit être une chaîne de format")
        fmt = self.chaine(args[0][1])
        reste = list(args[1:])
        out, i = bytearray(), 0

        def suivant():
            if not reste:
                raise _err(node, "printf : il manque des arguments pour le format")
            return reste.pop(0)

        for m in self.FORMAT.finditer(fmt):
            out += fmt[i:m.start()]
            i = m.end()
            drapeaux, largeur, prec, taille, c = m.groups()
            c = c.decode()
            if c == "%":
                out += b"%"
                continue
            if largeur == b"*":
                largeur = str(suivant()[1]).encode()
            if prec == b"*":
                prec = str(suivant()[1]).encode()
            t, v = suivant()
            spec = "%" + drapeaux.decode() + (largeur or b"").decode() + ("." + (prec or b"").decode() if prec is not None else "")
            if c in "di":
                if t.k != "int":
                    raise _err(node, "printf : %%%s attend un entier" % c)
                n = {b"hh": 8, b"h": 16, b"l": 64, b"ll": 64, b"z": 64, b"j": 64, b"t": 64}.get(taille, 32)
                v &= (1 << n) - 1
                if v >> (n - 1):
                    v -= 1 << n
                out += (spec + "d").__mod__(v).encode()
            elif c in "uoxX":
                if t.k not in ("int", "ptr"):
                    raise _err(node, "printf : %%%s attend un entier" % c)
                n = {b"hh": 8, b"h": 16, b"l": 64, b"ll": 64, b"z": 64, b"j": 64, b"t": 64}.get(taille, 32)
                v &= (1 << n) - 1
                if c == "o":
                    s = (spec.replace("#", "") + "o") % v
                    out += (("0" + s.lstrip()) if "#" in spec and v else s).encode()
                else:
                    out += (spec + ("d" if c == "u" else c)).__mod__(v).encode()
            elif c in "fFeEgG":
                if t.k not in ("float", "int"):
                    raise _err(node, "printf : %%%s attend un nombre à virgule" % c)
                out += (spec + c).__mod__(float(v)).encode()
            elif c == "c":
                out += bytes([v & 0xFF])
            elif c == "s":
                if t.k != "ptr":
                    raise _err(node, "printf : %s attend une chaîne")
                s = self.chaine(v)
                if prec is not None and prec != b"":
                    s = s[:int(prec)]
                w = int(largeur) if largeur else 0
                s = s.ljust(w) if "-" in drapeaux.decode() else s.rjust(w)
                out += s
            elif c == "p":
                out += ("0x%x" % v if v else "(nil)").encode()
        out += fmt[i:]
        return bytes(out)


class SortieProgramme(Exception):
    pass


# ---------------------------------------------------------------- point d'entrée

def _lire(nom):
    with open(os.path.join(ICI, nom), encoding="utf-8") as fh:
        return fh.read()


def preparer(source, fichiers=None):
    """Préprocesse et analyse le source ; renvoie l'AST pycparser."""
    fichiers = dict(fichiers or {})
    if "mcu.h" not in fichiers and os.path.exists(os.path.join(ICI, "mcu.h")):
        fichiers["mcu.h"] = _lire("mcu.h")
    pp = Preprocesseur(fichiers)
    texte = PRELUDE + pp.traiter(source.replace("assert(", "__boucle_assert("))
    try:
        return c_parser.CParser().parse(texte, filename="<code>")
    except c_parser.ParseError as e:
        m = re.match(r"(?:[^:]*):(\d+):(\d+): (.*)", str(e))
        if m:
            msg = m.group(3).replace("before:", "avant").strip()
            raise ErreurC("ligne %s : erreur de syntaxe (%s) ; un point-virgule ou une accolade manquant ?" % (m.group(1), msg))
        raise ErreurC("erreur de syntaxe : %s" % e)


def executer(source, fichiers=None, sortie=None):
    """Compile et exécute un programme C complet ; écrit sa sortie sur `sortie`. Renvoie le code de retour de main."""
    ast = preparer(source, fichiers)
    prog = Programme()
    code = 0
    try:
        prog.compiler(ast)
        code = prog.executer()
    except SortieProgramme as e:
        code = e.args[0]
    except RecursionError:
        raise ErreurC("expression ou récursion trop profonde")
    finally:
        sortie = sortie or sys.stdout
        sortie.write(prog.sortie.decode("utf-8", errors="replace"))
        sortie.flush()
    return code
