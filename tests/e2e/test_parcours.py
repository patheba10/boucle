"""Tests de bout en bout : les parcours essentiels d'un élève, dans un vrai navigateur."""
import re

import pytest
from playwright.sync_api import expect

from conftest import OFFLINE

PY_TIMEOUT = 120_000  # premier démarrage de Pyodide + paquets


def run_atelier(page, code, lang="py", stdin=None):
    page.goto(page.base + "#atelier")
    if lang == "cpp":
        page.click('.seg button[data-lang="cpp"]')
    page.fill("#ed-atelier", code)
    if stdin is not None:
        page.fill("#atelier-stdin", stdin)
    page.click('[data-act="run"]')
    # Attendre un état final : tant qu'un message de progression est affiché (démarrage, chargement
    # ou installation de paquets, exécution), le programme n'a pas fini. Le bouton se réactive à la fin.
    page.wait_for_function(
        """() => {
            const btn = document.querySelector('[data-act="run"]');
            const txt = document.querySelector('.console').innerText;
            return btn && !btn.disabled && !/Démarrage|Chargement|Installation|Exécution|Paquets chargés/.test(txt);
        }""",
        timeout=PY_TIMEOUT,
    )
    return page.locator(".console")


def check_with_solution(page, lesson_id):
    page.goto(page.base + "#" + lesson_id)
    page.click('[data-act="sol"]')
    page.click('[data-act="sol"]')  # confirmation (½ XP)
    page.click('[data-act="check"]')
    expect(page.locator(".verdict.ok")).to_be_visible(timeout=PY_TIMEOUT)


def test_accueil(page):
    page.goto(page.base)
    expect(page.locator(".hero-main h1")).to_be_visible()
    assert page.locator(".course-card").count() >= 2
    assert page.errors == []


def test_pages_principales_sans_erreur(page):
    for route in ["python", "data", "git", "cicd", "cpp", "roadmaps", "devops", "installer", "atelier", "py-01", "np-01", "git-01", "git-12", "ci-01", "ci-20", "ci-22", "linux", "lx-01", "lx-10", "lx-14", "lx-19", "lx-21", "docker", "dk-01", "dk-06", "dk-09", "dk-11", "dk-12", "kubernetes", "k8s-01", "k8s-05", "k8s-07", "k8s-12", "exploitation", "ex-02", "ex-06", "ex-10", "ex-11", "terraform", "tf-02", "tf-05", "tf-08", "tf-11", "aws", "aws-02", "aws-04", "aws-08", "aws-12", "sql", "sql-01", "sql-10", "sql-16", "api", "api-04", "api-09", "api-11", "dl", "dl-05", "dl-09", "dl-10", "dl-13", "dl-15", "dl-16", "dl-20", "electronique", "el-01", "el-07", "el-12", "logique", "ln-01", "ln-08", "ln-10", "embarque", "em-01", "em-07", "em-13", "em-15", "em-17", "iot", "algo", "al-01", "al-08", "al-09", "certifs", "cert-clf", "cert-saa", "cpp-10"]:
        page.goto(page.base + "#" + route)
        expect(page.locator("#app")).not_to_be_empty()
    assert page.errors == []


def test_examen_blanc_court(page):
    """Entraînement par domaine, puis examen blanc court : réponses, marque, fin, résultat par domaine."""
    page.goto(page.base + "#cert-clf")
    page.click("[data-practice=facturation]")
    page.locator(".opt").first.click()
    if page.locator("[data-valid]").is_visible():  # question à plusieurs réponses (tirage aléatoire) : il faut valider
        page.click("[data-valid]")
    expect(page.locator(".explain")).to_be_visible()
    page.goto(page.base + "#home")
    page.goto(page.base + "#cert-clf")
    page.click("[data-exam='20']")
    expect(page.locator("[data-timer]")).to_have_text(re.compile(r"^\d\d:\d\d$"))
    for i in range(20):
        page.locator(".opt").first.click()
        if i < 19:
            page.click("[data-next]")
    page.click("[data-flag]")
    expect(page.locator(".exam-grid .cell.flag")).to_have_count(1)
    page.click("[data-finish]")
    page.click("[data-yes]")
    expect(page.locator(".exam-res h2")).to_contain_text("/ 1000")
    assert page.locator(".exam-res .cert-dom").count() == 4
    page.goto(page.base + "#home")
    page.goto(page.base + "#cert-clf")
    expect(page.locator(".cert-hist li")).to_have_count(1)
    assert page.errors == []


def test_defi_python_reussi(page):
    check_with_solution(page, "py-04")
    expect(page.locator("#xp")).not_to_have_text("0 XP")


def test_defi_python_echoue_avec_code_de_depart(page):
    page.goto(page.base + "#py-09")
    page.click('[data-act="check"]')
    expect(page.locator(".verdict.no")).to_be_visible(timeout=PY_TIMEOUT)


def test_defi_cpp_reussi(page):
    check_with_solution(page, "cpp-06")


def test_jeu_de_donnees_lisible(page):
    console = run_atelier(page, 'import csv\nwith open("data/exemple-notes.csv") as f:\n    print(len(list(csv.DictReader(f))), "lignes")\n')
    expect(console).to_contain_text("6 lignes")


def test_boucle_infinie_interrompue(page):
    console = run_atelier(page, "while True:\n    pass\n")
    expect(console).to_contain_text("Arrêt après", timeout=45_000)


@pytest.mark.skipif(OFFLINE, reason="les paquets Pyodide viennent du CDN")
def test_numpy_et_figure(page):
    console = run_atelier(page, "import numpy as np\nimport matplotlib.pyplot as plt\nprint(np.arange(4) ** 2)\nplt.plot([1, 2, 3])\n")
    expect(console).to_contain_text("[0 1 4 9]")
    expect(console.locator("img.fig")).to_have_count(1)


def test_mobile_sans_debordement_horizontal(browser, base_url):
    context = browser.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
    context.route("**/fonts.g*/**", lambda r: r.abort())
    pg = context.new_page()
    for route in ["home", "py-09", "cpp-07", "ml", "installer", "atelier"]:
        pg.goto(base_url + "#" + route)
        pg.wait_for_selector("#app > *")
        width = pg.evaluate("document.documentElement.scrollWidth")
        assert width <= 390, f"#{route} déborde : {width}px"
    context.close()


def test_installer_libelles_des_blocs(page):
    page.goto(page.base + "#installer")
    labels = page.locator(".snippet-bar .lbl").all_inner_texts()
    assert "powershell" in labels and "terminal" in labels
    assert "c++" not in labels
    expect(page.locator(".snippet .run")).to_have_count(0)  # rien d'exécutable sur cette page


def test_parite_navigateur_toutes_les_solutions(page):
    """Chaque solution validée en CI (CPython 64 bits, g++) doit aussi passer dans le navigateur
    (Pyodide 32 bits, JSCPP). Hors ligne, on saute les cours qui ont besoin de paquets du CDN."""
    page.goto(page.base)
    lessons = page.evaluate("""import('./content/index.js').then(m => m.COURSES.flatMap(c =>
        c.lessons.filter(l => l.challenge).map(l => ({ id: l.id, course: c.id, lang: l.lang || c.lang,
            term: (l.lang || c.lang) === "git" || ((l.lang || c.lang) === "sh" && l.challenge.kind !== "script"),
            solution: Array.isArray(l.challenge.solution) ? l.challenge.solution : null }))))""")
    if OFFLINE:
        lessons = [l for l in lessons if l["course"] not in ("data", "sql", "api", "dl", "embarque")]  # paquets numpy, sqlite3, fastapi, pycparser… du CDN
    assert lessons, "aucun défi trouvé"
    echecs = []
    for lesson in lessons:
        page.goto(page.base + "#" + lesson["id"])
        if lesson["term"]:
            for cmd in lesson["solution"]:
                page.fill(".gterm-in", cmd)
                page.press(".gterm-in", "Enter")
        else:
            page.click('[data-act="sol"]')
            page.click('[data-act="sol"]')
        page.click('[data-act="check"]')
        verdict = page.locator('[data-slot="verdict"] .verdict')
        try:
            verdict.wait_for(timeout=PY_TIMEOUT)
        except Exception:
            echecs.append(lesson["id"] + " : aucun verdict affiché")
            continue
        if "ok" not in (verdict.get_attribute("class") or ""):
            echecs.append(lesson["id"] + " : " + page.locator(".console").inner_text()[:200])
    assert not echecs, "Solutions refusées dans le navigateur :\n" + "\n".join(echecs)


@pytest.mark.skipif(OFFLINE, reason="sqlite3 est un paquet Pyodide servi par le CDN")
def test_sql_reel(page):
    """Un extrait SQL s'exécute dans SQLite (Pyodide), une erreur SQLite est expliquée, un défi est vérifié."""
    page.goto(page.base + "#sql-07")
    page.locator(".snippet .run").first.click()
    expect(page.locator(".snippet .res").first).to_contain_text("(1 ligne)", timeout=PY_TIMEOUT)
    page.fill("#ed-sql-07", "SELECT categorie, COUNT(*) FROM produit;")
    page.click('[data-act="run"]')
    expect(page.locator(".console")).to_contain_text("no such table: produit", timeout=PY_TIMEOUT)
    expect(page.locator(".console")).to_contain_text("Table inconnue")
    page.click('[data-act="check"]')
    expect(page.locator(".verdict.no")).to_be_visible(timeout=PY_TIMEOUT)
    assert page.errors == []


@pytest.mark.skipif(OFFLINE, reason="fastapi et pytest sont des paquets Pyodide servis par le CDN")
def test_api_et_pytest_reels(page):
    """Un extrait FastAPI s'exécute (client de test sans threads), et « Exécuter » lance le vrai pytest sur les tests de l'élève."""
    page.goto(page.base + "#api-03")
    page.locator(".snippet .run").first.click()
    expect(page.locator(".snippet .res").first).to_contain_text("Ville introuvable", timeout=PY_TIMEOUT)
    page.goto(page.base + "#api-07")
    page.click('[data-act="run"]')
    expect(page.locator(".console")).to_contain_text("2 passed", timeout=PY_TIMEOUT)
    page.click('[data-act="check"]')
    expect(page.locator(".verdict.no")).to_contain_text("NON détectée", timeout=PY_TIMEOUT)
    assert page.errors == []


@pytest.mark.skipif(OFFLINE, reason="numpy est un paquet Pyodide servi par le CDN")
def test_keras_dans_le_navigateur(page):
    """Le code Keras de la théorie tourne dans le navigateur avec minikeras (TensorFlow n'existe pas dans Pyodide)."""
    page.goto(page.base + "#dl-10")
    page.locator(".snippet .run").first.click()
    expect(page.locator(".snippet .res").first).to_contain_text("Total params: 65", timeout=PY_TIMEOUT)
    expect(page.locator(".snippet .res").first).to_contain_text("exactitude finale")
    assert page.errors == []


@pytest.mark.skipif(OFFLINE, reason="seaborn s'installe depuis PyPI avec micropip")
def test_seaborn_installe_a_la_demande(page):
    console = run_atelier(page, "import seaborn as sns\nimport pandas as pd\nprint(sns.__version__)\nsns.histplot(pd.read_csv('data/penguins.csv'), x='body_mass_g')\n")
    expect(console).to_contain_text("0.13.2")
    expect(console.locator("img.fig")).to_have_count(1)


def test_terminal_git(page):
    page.goto(page.base + "#git-01")
    term = page.locator(".gterm-in")
    for cmd in ["git status", "git init", "git add README.md", 'git commit -m "docs: ajouter le README"']:
        term.fill(cmd)
        term.press("Enter")
    out = page.locator(".gterm-out")
    expect(out).to_contain_text("fatal: not a git repository")
    expect(out).to_contain_text("Initialized empty Git repository")
    expect(out).to_contain_text("(root-commit)")
    expect(page.locator(".g-node")).to_have_count(1)
    expect(page.locator(".gterm-files")).to_contain_text("non suivi")  # app.py n'est pas encore ajouté
    term.press("ArrowUp")
    assert term.input_value().startswith("git commit")
    page.click('[data-act="check"]')
    expect(page.locator(".verdict.no")).to_be_visible()  # il manque le second commit
    term.fill("git add app.py")
    term.press("Enter")
    term.fill('git commit -m "feat: premier script"')
    term.press("Enter")
    page.click('[data-act="check"]')
    expect(page.locator(".verdict.ok")).to_be_visible()
    page.reload()  # l'historique tapé est rejoué au rechargement
    expect(page.locator(".g-node")).to_have_count(2)
    assert page.errors == []


def test_workflow_yaml(page):
    """Défi GitHub Actions : erreurs en direct avec leur ligne, simulation d'événements, verdict."""
    page.goto(page.base + "#ci-05")
    live = page.locator(".wf-live")
    expect(live).to_contain_text("ligne 7")
    expect(live).to_contain_text("runs-on")
    page.click('[data-act="sol"]')
    page.click('[data-act="sol"]')
    expect(live).to_contain_text("Aucune erreur de structure")
    expect(live.locator(".wf-job")).to_have_count(2)
    page.click('[data-act="check"]')
    expect(page.locator('[data-slot="verdict"] .verdict.ok')).to_be_visible()
    # Simulation d'un échec : deploy est sauté
    page.goto(page.base + "#ci-04")
    page.click('[data-act="sol"]')
    page.click('[data-act="sol"]')
    page.locator(".wf-tabs button", has_text="en échec").click()
    expect(live.locator(".wf-job.skipped")).to_contain_text("build")
    expect(live.locator(".wf-job.failure")).to_contain_text("tests")


def test_extrait_yaml_analyse(page):
    page.goto(page.base + "#ci-03")
    page.locator(".snippet .run").first.click()
    res = page.locator(".snippet .wf-res").first
    expect(res).to_contain_text("Aucune erreur de structure")
    res.locator(".wf-tabs button", has_text="un push sur feature").click()
    expect(res).to_contain_text("ne démarre pas")


def test_terminal_linux(page):
    """Terminal Linux : messages GNU, droits, commandes sur plusieurs lignes, verdict."""
    page.goto(page.base + "#lx-05")
    term = page.locator(".gterm-in")
    for cmd in ["cd ~/deploiement", "./deploy.sh", "chmod 700 deploy.sh", "./deploy.sh"]:
        term.fill(cmd)
        term.press("Enter")
    out = page.locator(".gterm-out")
    expect(out).to_contain_text("bash: ./deploy.sh: Permission denied")
    expect(out).to_contain_text("deploiement")
    expect(page.locator(".sh-cwd")).to_have_text("/home/eleve/deploiement")
    expect(page.locator(".sh-ls")).to_contain_text("-rwx------")
    # Une boucle tapée sur plusieurs lignes, comme dans bash (invite « > »)
    for line in ["for f in a b; do", "echo fichier-$f", "done"]:
        term.fill(line)
        term.press("Enter")
    expect(out).to_contain_text("fichier-b")
    page.click('[data-act="check"]')
    expect(page.locator('[data-slot="verdict"] .verdict.no')).to_be_visible()
    expect(page.locator('[data-slot="verdict"] .crit li.ok', has_text="deploy.sh a les droits 700")).to_have_count(1)
    expect(page.locator('[data-slot="verdict"] .crit li.no')).to_have_count(3)
