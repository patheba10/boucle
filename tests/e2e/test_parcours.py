"""Tests de bout en bout : les parcours essentiels d'un élève, dans un vrai navigateur."""
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
    for route in ["python", "data", "git", "cicd", "cpp", "roadmaps", "devops", "installer", "atelier", "py-01", "np-01", "git-01", "git-12", "ci-01", "cpp-10"]:
        page.goto(page.base + "#" + route)
        expect(page.locator("#app")).not_to_be_empty()
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
            solution: (l.lang || c.lang) === "git" ? l.challenge.solution : null }))))""")
    if OFFLINE:
        lessons = [l for l in lessons if l["course"] != "data"]
    assert lessons, "aucun défi trouvé"
    echecs = []
    for lesson in lessons:
        page.goto(page.base + "#" + lesson["id"])
        if lesson["lang"] == "git":
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
