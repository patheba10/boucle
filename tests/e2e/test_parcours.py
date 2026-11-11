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
    console = page.locator(".console")
    expect(console).not_to_contain_text("Chargement", timeout=PY_TIMEOUT)
    expect(console).not_to_contain_text("Démarrage", timeout=PY_TIMEOUT)
    expect(console).not_to_contain_text("Exécution", timeout=PY_TIMEOUT)
    return console


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
    for route in ["python", "data", "cpp", "roadmaps", "devops", "installer", "atelier", "py-01", "np-01", "cpp-10"]:
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
    expect(console).to_contain_text("Arrêt après", timeout=30_000)


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
        c.lessons.filter(l => l.challenge).map(l => ({ id: l.id, course: c.id }))))""")
    if OFFLINE:
        lessons = [l for l in lessons if l["course"] != "data"]
    assert lessons, "aucun défi trouvé"
    echecs = []
    for lesson in lessons:
        page.goto(page.base + "#" + lesson["id"])
        page.click('[data-act="sol"]')
        page.click('[data-act="sol"]')
        page.click('[data-act="check"]')
        verdict = page.locator('[data-slot="verdict"] .verdict')
        verdict.wait_for(timeout=PY_TIMEOUT)
        if "ok" not in (verdict.get_attribute("class") or ""):
            echecs.append(lesson["id"] + " : " + page.locator(".console").inner_text()[:200])
    assert not echecs, "Solutions refusées dans le navigateur :\n" + "\n".join(echecs)
