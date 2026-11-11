/* Cours Data — chapitre pandas (jeux de données : public/datasets/) */
const R = String.raw;

const SETUP_PANDAS = R`<p>Sur ta machine, dans ton environnement virtuel :</p>
~~~ps
pip install pandas
~~~
<p>Les jeux de données de ce chapitre sont dans le dépôt de Boucle, dossier <code>public/datasets/</code>. Copie-les dans un dossier <code>data/</code> à côté de ton script ou de ton notebook : le code des leçons fonctionnera tel quel.</p>
<p>Pour explorer, préfère un notebook Jupyter (<code>jupyter lab</code>) : un DataFrame placé en dernière ligne d'une cellule s'affiche sous forme de tableau.</p>`;

export default [
  {
    id: "pd-01", section: "pandas", title: "Series et DataFrame", xp: 40, setup: SETUP_PANDAS,
    theory: R`<p>pandas apporte deux structures, construites sur NumPy :</p><ul><li>la <strong>Series</strong> : une colonne de valeurs avec un index (des étiquettes) ;</li><li>le <strong>DataFrame</strong> : un tableau de colonnes nommées partageant le même index. C'est une feuille Excel programmable.</li></ul>
~~~py
import pandas as pd

df = pd.DataFrame({
    "produit": ["Clavier", "Souris", "Écran"],
    "prix": [89.99, 24.50, 249.00],
    "stock": [10, 40, 4],
})
print(df)
print(df.shape, list(df.columns))
print(df.dtypes)

df["valeur"] = df["prix"] * df["stock"]   # nouvelle colonne, calcul vectorisé
print(df.sort_values("valeur", ascending=False))
print(df["prix"].mean(), df["stock"].sum())
~~~
<p>Chaque colonne est une Series : @@df["prix"]@@. Les opérations sont vectorisées comme avec NumPy, sans boucle.</p>`,
    quiz: [
      { q: R`Que renvoie @@df["prix"]@@ ?`, options: ["Un DataFrame d'une colonne", "Une Series", "Une liste Python", "Un tableau NumPy"], answer: 1, explain: "Des crochets simples avec un nom renvoient une Series. Avec df[[\"prix\"]] (doubles crochets), on obtient un DataFrame d'une colonne." }
    ],
    challenge: {
      prompt: R`<p>Écris @@catalogue()@@ qui renvoie un DataFrame avec les colonnes @@produit@@, @@prix@@, @@stock@@ (données ci-dessous) et une colonne @@valeur@@ = prix × stock, <strong>trié par valeur décroissante</strong>.</p><pre class="out">Clavier  89.99  10
Souris   24.50  40
Écran   249.00   4</pre>`,
      starter: "import pandas as pd\n\ndef catalogue():\n    return pd.DataFrame({\n        \"produit\": [\"Clavier\", \"Souris\", \"Écran\"],\n        \"prix\": [89.99, 24.50, 249.00],\n        \"stock\": [10, 40, 4],\n    })\n",
      solution: R`import pandas as pd

def catalogue():
    df = pd.DataFrame({
        "produit": ["Clavier", "Souris", "Écran"],
        "prix": [89.99, 24.50, 249.00],
        "stock": [10, 40, 4],
    })
    df["valeur"] = df["prix"] * df["stock"]
    return df.sort_values("valeur", ascending=False)`,
      tests: R`df = catalogue()
print(type(df).__name__, list(df.columns))
print(df["produit"].tolist())
print(df["valeur"].round(2).tolist())`,
      expected: "DataFrame ['produit', 'prix', 'stock', 'valeur']\n['Écran', 'Souris', 'Clavier']\n[996.0, 980.0, 899.9]",
      hint: R`df["valeur"] = df["prix"] * df["stock"], puis df.sort_values("valeur", ascending=False).`
    }
  },
  {
    id: "pd-02", section: "pandas", title: "Lire et explorer un CSV", xp: 45,
    theory: R`<p>En pratique, les données arrivent dans des fichiers. Voici les manchots de l'archipel Palmer (Antarctique), un jeu de données réel très utilisé pour apprendre.</p>
~~~py
import pandas as pd

df = pd.read_csv("data/penguins.csv")
print(df.shape)              # (lignes, colonnes)
print(df.head(3))            # premières lignes
df.info()                    # types et valeurs non nulles par colonne
print(df["species"].value_counts())
print(df.isna().sum())       # valeurs manquantes par colonne
print(df.describe().round(1))
~~~
<p>Ces commandes sont toujours les premières à lancer sur un nouveau jeu de données. On appelle ça l'<strong>EDA</strong> (exploratory data analysis). Avant toute analyse, on veut savoir combien de lignes il y a, de quels types, ce qui manque et comment les valeurs se répartissent.</p>`,
    quiz: [
      { q: R`Que donne @@df.isna().sum()@@ ?`, options: ["Le nombre total de lignes", "Le nombre de valeurs manquantes par colonne", "La somme de chaque colonne", "Les lignes sans valeur manquante"], answer: 1, explain: "isna() donne un DataFrame de booléens ; sum() compte les True de chaque colonne." }
    ],
    challenge: {
      prompt: R`<p>Écris @@profil(df)@@ qui renvoie un dictionnaire décrivant un DataFrame :</p><ul><li>@@"lignes"@@ et @@"colonnes"@@ : ses dimensions ;</li><li>@@"manquants"@@ : le nombre <strong>total</strong> de valeurs manquantes ;</li><li>@@"majoritaire"@@ : la valeur la plus fréquente de la colonne @@species@@.</li></ul><p>Le test l'appelle sur @@data/penguins.csv@@.</p>`,
      starter: "import pandas as pd\n\ndef profil(df):\n    return {\"lignes\": len(df), \"colonnes\": 0, \"manquants\": 0, \"majoritaire\": \"\"}\n",
      solution: R`import pandas as pd

def profil(df):
    lignes, colonnes = df.shape
    return {
        "lignes": lignes,
        "colonnes": colonnes,
        "manquants": int(df.isna().sum().sum()),
        "majoritaire": df["species"].value_counts().idxmax(),
    }`,
      tests: R`r = profil(pd.read_csv("data/penguins.csv"))
print(r["lignes"], r["colonnes"], r["manquants"], r["majoritaire"])
petit = pd.DataFrame({"species": ["A", "B", "B"], "x": [1.0, None, None]})
print(profil(petit)["manquants"], profil(petit)["majoritaire"])`,
      expected: "344 8 19 Adelie\n2 B",
      hint: "df.isna().sum() compte par colonne : un second .sum() fait le total. value_counts().idxmax() donne la valeur la plus fréquente."
    }
  },
  {
    id: "pd-03", section: "pandas", title: "Sélectionner et filtrer", xp: 45,
    theory: R`<p>Trois façons de sélectionner, à bien distinguer :</p>
~~~py
import pandas as pd
df = pd.read_csv("data/penguins.csv")

print(df[["species", "island"]].head(2))   # des colonnes par nom
print(df.loc[0, "species"])                # loc : par étiquette (index, colonne)
print(df.iloc[0, 0])                       # iloc : par position

lourds = df[df["body_mass_g"] > 6000]      # filtre booléen
print(len(lourds))
biscoe_f = df[(df["island"] == "Biscoe") & (df["sex"] == "female")]
print(len(biscoe_f))
print(df[df["species"].isin(["Adelie", "Chinstrap"])].shape)
print(df.query("flipper_length_mm > 225")[["species", "flipper_length_mm"]])
~~~
<p>Combine les conditions avec @@&@@ (et), @@|@@ (ou) et @@~@@ (non), <strong>chacune entre parenthèses</strong>. @@and@@ et @@or@@ ne marchent pas sur des Series.</p>`,
    quiz: [
      { q: R`Pourquoi @@df[df.x > 1 and df.y < 2]@@ lève-t-il une erreur ?`, options: ["x et y n'existent pas", "and ne sait pas comparer deux Series élément par élément : il faut & et des parenthèses", "Il faut écrire df.loc", "Les filtres ne gèrent qu'une condition"], answer: 1, explain: "and demande une seule valeur vraie ou fausse. Pour combiner élément par élément : (df.x > 1) & (df.y < 2)." },
      { q: R`Quelle est la différence entre @@loc@@ et @@iloc@@ ?`, options: ["Aucune", "loc utilise les étiquettes, iloc les positions entières", "iloc est plus rapide", "loc ne marche que sur les colonnes"], answer: 1, explain: "Après un filtre ou un tri, l'étiquette 0 n'est plus forcément en position 0 : c'est là que la distinction compte." }
    ],
    challenge: {
      prompt: R`<p>Écris @@grands_gentoo(df)@@ qui renvoie les manchots <strong>Gentoo</strong> de plus de <strong>5 500 g</strong> :</p><ul><li>colonnes @@island@@, @@body_mass_g@@ et @@sex@@ uniquement ;</li><li>triés par masse décroissante ;</li><li>avec un index remis à 0, 1, 2…</li></ul>`,
      starter: "import pandas as pd\n\ndef grands_gentoo(df):\n    return df[df[\"species\"] == \"Gentoo\"]\n",
      solution: R`import pandas as pd

def grands_gentoo(df):
    filtre = (df["species"] == "Gentoo") & (df["body_mass_g"] > 5500)
    r = df.loc[filtre, ["island", "body_mass_g", "sex"]]
    return r.sort_values("body_mass_g", ascending=False).reset_index(drop=True)`,
      tests: R`r = grands_gentoo(pd.read_csv("data/penguins.csv"))
print(len(r), list(r.columns), r.index[:3].tolist())
print(r["body_mass_g"].tolist()[:6], r["body_mass_g"].min())
print(r.loc[0, "body_mass_g"], r.loc[0, "sex"])`,
      expected: "28 ['island', 'body_mass_g', 'sex'] [0, 1, 2]\n[6300.0, 6050.0, 6000.0, 6000.0, 5950.0, 5950.0] 5550.0\n6300.0 male",
      hint: R`Construis le masque avec deux conditions et &, sélectionne avec df.loc[masque, [colonnes]], puis sort_values(..., ascending=False).reset_index(drop=True).`
    }
  },
  {
    id: "pd-04", section: "pandas", title: "Nettoyer les données", xp: 50,
    theory: R`<p>Les données réelles sont sales : valeurs manquantes, mauvais types, noms incohérents. On estime souvent que le nettoyage représente plus de la moitié du travail d'un data scientist.</p>
~~~py
import pandas as pd
df = pd.read_csv("data/penguins.csv")

print(df.isna().sum()["sex"])                     # 11 sexes manquants
propre = df.dropna(subset=["body_mass_g"])        # supprimer les lignes sans masse
propre = propre.assign(sex=propre["sex"].fillna("inconnu"))  # remplacer
propre = propre.rename(columns={"species": "espece"})
propre["annee"] = propre["year"].astype(str)      # changer de type
print(propre.shape, df.shape)                     # l'original n'a pas changé
print(propre["sex"].value_counts())
~~~
<ul><li>@@dropna@@ ou @@fillna@@ : supprimer ou remplacer, c'est un choix d'analyse. Il faut savoir le justifier, notamment en entretien.</li><li>La plupart des méthodes renvoient un <strong>nouveau</strong> DataFrame. Travaille sur une copie (@@df.copy()@@) plutôt que de modifier les données sources.</li><li>Évite @@inplace=True@@ et les affectations en chaîne du type @@df[df.x > 0]["y"] = 1@@ : c'est l'origine du célèbre @@SettingWithCopyWarning@@.</li></ul>`,
    quiz: [
      { q: R`Pour une colonne de prix avec 2 % de valeurs manquantes, quel choix est généralement défendable ?`, options: ["Remplacer par 0", "Remplacer par la médiane, ou supprimer ces lignes, en le documentant", "Ignorer, pandas s'en occupe", "Supprimer la colonne"], answer: 1, explain: "0 fausserait les statistiques. La médiane résiste aux valeurs extrêmes. L'important est de justifier et de documenter le choix." }
    ],
    challenge: {
      prompt: R`<p>Écris @@nettoyer(df)@@ qui renvoie une <strong>copie</strong> nettoyée des manchots :</p><ol><li>supprime les lignes où @@bill_length_mm@@ manque ;</li><li>remplace les @@sex@@ manquants par @@"inconnu"@@ ;</li><li>ajoute @@masse_kg@@ = @@body_mass_g@@ / 1000 ;</li><li>renomme @@species@@ en @@espece@@.</li></ol><p>Le DataFrame d'origine ne doit pas être modifié.</p>`,
      starter: "import pandas as pd\n\ndef nettoyer(df):\n    df.dropna(inplace=True)\n    return df\n",
      solution: R`import pandas as pd

def nettoyer(df):
    propre = df.dropna(subset=["bill_length_mm"]).copy()
    propre["sex"] = propre["sex"].fillna("inconnu")
    propre["masse_kg"] = propre["body_mass_g"] / 1000
    return propre.rename(columns={"species": "espece"})`,
      tests: R`brut = pd.read_csv("data/penguins.csv")
r = nettoyer(brut)
print(len(r), r["sex"].value_counts()["inconnu"], "espece" in r.columns, "species" in r.columns)
print(round(r["masse_kg"].mean(), 3), brut.shape, int(brut["sex"].isna().sum()))`,
      expected: "342 9 True False\n4.202 (344, 8) 11",
      hint: R`df.dropna(subset=[...]).copy() te donne une copie indépendante ; ensuite fillna, la nouvelle colonne, et rename(columns={...}).`
    }
  },
  {
    id: "pd-05", section: "pandas", title: "groupby et agrégations", xp: 50,
    theory: R`<p>@@groupby@@ applique le schéma <strong>split-apply-combine</strong> : découper les lignes en groupes, calculer sur chaque groupe, rassembler les résultats. C'est l'équivalent du @@GROUP BY@@ de SQL.</p>
~~~py
import pandas as pd
df = pd.read_csv("data/penguins.csv")

print(df.groupby("species")["body_mass_g"].mean().round(1))
print(df.groupby(["species", "sex"]).size())

# Agrégations nommées : une colonne de résultat par calcul
resume = df.groupby("island").agg(
    effectif=("species", "size"),
    masse_moyenne=("body_mass_g", "mean"),
    bec_max=("bill_length_mm", "max"),
)
print(resume.round(1))
~~~
<p>Les fonctions d'agrégation ignorent les valeurs manquantes (@@mean@@, @@max@@…). @@size@@ compte toutes les lignes, @@count@@ seulement les valeurs non manquantes.</p>`,
    quiz: [
      { q: R`Dans un groupe de 10 lignes dont 2 ont une masse manquante, que valent @@size@@ et @@count@@ sur la masse ?`, options: ["10 et 10", "10 et 8", "8 et 8", "8 et 10"], answer: 1, explain: "size compte les lignes ; count ne compte que les valeurs présentes." }
    ],
    challenge: {
      prompt: R`<p>Écris @@stats_especes(df)@@ qui renvoie un DataFrame indexé par espèce avec deux colonnes :</p><ul><li>@@masse_moyenne@@ : masse moyenne, arrondie à 1 décimale ;</li><li>@@effectif@@ : nombre de manchots (lignes) ;</li></ul><p>trié par masse moyenne décroissante.</p>`,
      starter: "import pandas as pd\n\ndef stats_especes(df):\n    return df.groupby(\"species\").mean(numeric_only=True)\n",
      solution: R`import pandas as pd

def stats_especes(df):
    r = df.groupby("species").agg(
        masse_moyenne=("body_mass_g", "mean"),
        effectif=("species", "size"),
    )
    r["masse_moyenne"] = r["masse_moyenne"].round(1)
    return r.sort_values("masse_moyenne", ascending=False)`,
      tests: R`r = stats_especes(pd.read_csv("data/penguins.csv"))
print(r.index.tolist(), list(r.columns))
print(r["masse_moyenne"].tolist(), r["effectif"].tolist())`,
      expected: "['Gentoo', 'Chinstrap', 'Adelie'] ['masse_moyenne', 'effectif']\n[5076.0, 3733.1, 3700.7] [124, 68, 152]",
      hint: R`agg(masse_moyenne=("body_mass_g", "mean"), effectif=("species", "size")), puis round et sort_values.`
    }
  },
  {
    id: "pd-06", section: "pandas", title: "Jointures", xp: 55,
    theory: R`<p>Les données d'une entreprise sont réparties en tables : clients, commandes, produits. @@merge@@ les réunit sur une clé commune, comme un @@JOIN@@ SQL.</p>
~~~py
import pandas as pd
clients = pd.read_csv("data/clients.csv")
commandes = pd.read_csv("data/commandes.csv")

inner = commandes.merge(clients, on="client_id")               # seulement les correspondances
left = clients.merge(commandes, on="client_id", how="left")    # tous les clients
print(len(commandes), len(inner), len(left))

# Qui n'a jamais commandé ? (anti-jointure)
print(clients[~clients["client_id"].isin(commandes["client_id"])]["nom"].tolist())

# indicator=True montre d'où vient chaque ligne
complet = commandes.merge(clients, on="client_id", how="outer", indicator=True)
print(complet["_merge"].value_counts())
~~~
<p><strong>Toujours vérifier le nombre de lignes après une jointure.</strong> Une clé en double multiplie les lignes, une clé absente les fait disparaître. C'est l'une des sources de bogue les plus fréquentes en analyse de données.</p>`,
    quiz: [
      { q: R`Une commande référence un @@client_id@@ absent de la table clients. Avec @@how="inner"@@, que devient-elle ?`, options: ["Elle est gardée avec des NaN", "Elle disparaît du résultat", "pandas lève une erreur", "Elle est dupliquée"], answer: 1, explain: "inner ne garde que les clés présentes des deux côtés. Avec how=\"left\" depuis les commandes, elle serait gardée avec des NaN côté client." }
    ],
    challenge: {
      prompt: R`<p>Écris @@analyse_ventes(clients, commandes)@@ qui renvoie un tuple :</p><ol><li>une Series : le chiffre d'affaires (quantité × prix unitaire) <strong>par ville</strong>, arrondi à 2 décimales, trié par ordre décroissant ;</li><li>la liste des @@commande_id@@ dont le client est <strong>inconnu</strong> (commandes orphelines).</li></ol>`,
      starter: "import pandas as pd\n\ndef analyse_ventes(clients, commandes):\n    fusion = commandes.merge(clients, on=\"client_id\")\n    return fusion.groupby(\"ville\")[\"quantite\"].sum(), []\n",
      solution: R`import pandas as pd

def analyse_ventes(clients, commandes):
    c = commandes.assign(montant=commandes["quantite"] * commandes["prix_unitaire"])
    fusion = c.merge(clients, on="client_id", how="inner")
    par_ville = fusion.groupby("ville")["montant"].sum().round(2).sort_values(ascending=False)
    orphelines = c.loc[~c["client_id"].isin(clients["client_id"]), "commande_id"].tolist()
    return par_ville, orphelines`,
      tests: R`ca, orph = analyse_ventes(pd.read_csv("data/clients.csv"), pd.read_csv("data/commandes.csv"))
print([(ville, float(v)) for ville, v in ca.items()])
print(orph)`,
      expected: "[('Montréal', 1125.7), ('Gatineau', 722.88), ('Québec', 518.99), ('Ottawa', 408.0)]\n[1013]",
      hint: "Ajoute la colonne montant avant la jointure. Pour les orphelines : ~commandes[\"client_id\"].isin(clients[\"client_id\"])."
    }
  },
  {
    id: "pd-07", section: "pandas", title: "Dates et séries temporelles", xp: 55,
    theory: R`<p>Ventes par jour, mesures de capteurs, logs de serveur : les séries temporelles sont partout. pandas sait parser les dates, en extraire des composantes et rééchantillonner.</p>
~~~py
import pandas as pd
meteo = pd.read_csv("data/meteo-seattle.csv", parse_dates=["date"])
print(meteo.dtypes["date"], meteo["date"].min(), meteo["date"].max())

meteo["annee"] = meteo["date"].dt.year
meteo["jour"] = meteo["date"].dt.day_name()
print(meteo[["date", "annee", "jour"]].head(3))

serie = meteo.set_index("date")["precipitation"]
par_mois = serie.resample("ME").sum()        # total par fin de mois
print(par_mois.idxmax(), par_mois.max())     # le mois le plus pluvieux
lissee = meteo.set_index("date")["temp_max"].rolling(30).mean()  # moyenne mobile 30 jours
print(lissee.dropna().round(1).head(3))
~~~`,
    quiz: [
      { q: R`Que fait @@serie.resample("ME").sum()@@ sur une série journalière ?`, options: ["Elle trie par mois", "Elle regroupe par mois et fait la somme de chaque mois", "Elle garde le dernier jour de chaque mois", "Elle calcule une moyenne mobile"], answer: 1, explain: "resample est un groupby sur le temps : \"ME\" = fin de mois (month end), \"W\" = semaine, \"YE\" = année." }
    ],
    challenge: {
      prompt: R`<p>Écris @@bilan_annuel(meteo)@@ qui renvoie un DataFrame indexé par année avec :</p><ul><li>@@precipitation_totale@@ : somme des précipitations, arrondie à 1 décimale ;</li><li>@@temp_max_moyenne@@ : moyenne de @@temp_max@@, arrondie à 1 décimale ;</li><li>@@jours_neige@@ : nombre de jours où @@weather@@ vaut @@"snow"@@.</li></ul><p>@@meteo@@ est lu avec @@parse_dates=["date"]@@.</p>`,
      starter: "import pandas as pd\n\ndef bilan_annuel(meteo):\n    return meteo.groupby(\"weather\").size()\n",
      solution: R`import pandas as pd

def bilan_annuel(meteo):
    annee = meteo["date"].dt.year
    r = meteo.groupby(annee).agg(
        precipitation_totale=("precipitation", "sum"),
        temp_max_moyenne=("temp_max", "mean"),
        jours_neige=("weather", lambda w: int((w == "snow").sum())),
    )
    r[["precipitation_totale", "temp_max_moyenne"]] = r[["precipitation_totale", "temp_max_moyenne"]].round(1)
    return r`,
      tests: R`r = bilan_annuel(pd.read_csv("data/meteo-seattle.csv", parse_dates=["date"]))
print(r.index.tolist())
print(r["precipitation_totale"].tolist(), r["temp_max_moyenne"].tolist())
print(r["jours_neige"].tolist())`,
      expected: "[2012, 2013, 2014, 2015]\n[1226.0, 828.0, 1232.8, 1139.2] [15.3, 16.1, 17.0, 17.4]\n[21, 2, 0, 0]",
      hint: R`groupby(meteo["date"].dt.year), puis agg avec trois agrégations nommées ; pour la neige, une lambda qui compte (w == "snow").`
    }
  },
  {
    id: "pd-08", section: "pandas", title: "Défi entretien : le maximum par groupe", xp: 70,
    theory: R`<p>Question d'entretien data classique : « pour chaque catégorie, renvoie la ligne complète du meilleur élément ». Pour la plus grosse vente par région ou l'employé le mieux payé par service, @@groupby(...).max()@@ ne suffit pas : il donne la valeur maximale, pas la ligne entière.</p>
~~~py
import pandas as pd
df = pd.read_csv("data/penguins.csv")

# Valeur max seulement :
print(df.groupby("island")["body_mass_g"].max())

# Ligne complète : idxmax renvoie l'étiquette de la ligne du max
idx = df.groupby("island")["body_mass_g"].idxmax()
print(df.loc[idx, ["island", "species", "body_mass_g"]])

# Tableau croisé : masse moyenne par île et par espèce
print(df.pivot_table(index="island", columns="species", values="body_mass_g", aggfunc="mean").round(0))
~~~
<p>Alternatives à connaître : @@sort_values@@ puis @@drop_duplicates("island")@@, ou @@nlargest@@ par groupe. En SQL, on utiliserait @@ROW_NUMBER() OVER (PARTITION BY …)@@.</p>`,
    quiz: [
      { q: R`Que renvoie @@df.groupby("g")["x"].idxmax()@@ ?`, options: ["La valeur maximale de x par groupe", "L'étiquette d'index de la ligne où x est maximal, pour chaque groupe", "Le numéro du groupe le plus grand", "Un booléen par ligne"], answer: 1, explain: "On passe ensuite ces étiquettes à df.loc pour récupérer les lignes complètes." }
    ],
    challenge: {
      prompt: R`<p>Écris @@plus_lourd_par_ile(df)@@ qui renvoie, pour chaque île, la ligne du manchot <strong>le plus lourd</strong> : un DataFrame indexé par île (ordre alphabétique) avec les colonnes @@species@@, @@sex@@, @@bill_length_mm@@ et @@body_mass_g@@.</p>`,
      starter: "import pandas as pd\n\ndef plus_lourd_par_ile(df):\n    return df.groupby(\"island\")[[\"species\", \"sex\", \"bill_length_mm\", \"body_mass_g\"]].max()\n",
      solution: R`import pandas as pd

def plus_lourd_par_ile(df):
    idx = df.groupby("island")["body_mass_g"].idxmax()
    return df.loc[idx, ["island", "species", "sex", "bill_length_mm", "body_mass_g"]].set_index("island").sort_index()`,
      tests: R`r = plus_lourd_par_ile(pd.read_csv("data/penguins.csv"))
print(r.index.tolist(), list(r.columns))
for ile, ligne in r.iterrows():
    print(ile, ligne["species"], ligne["sex"], ligne["bill_length_mm"], ligne["body_mass_g"])`,
      expected: "['Biscoe', 'Dream', 'Torgersen'] ['species', 'sex', 'bill_length_mm', 'body_mass_g']\nBiscoe Gentoo male 49.2 6300.0\nDream Chinstrap male 52.0 4800.0\nTorgersen Adelie male 42.9 4700.0",
      hint: R`groupby("island")["body_mass_g"].idxmax() donne les étiquettes des lignes ; df.loc[idx, colonnes].set_index("island").`
    }
  }
];
