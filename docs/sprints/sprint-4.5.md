# Sprint 4.5

**Objectif** : terminer l'étape DevOps avec l'exploitation : observabilité, Prometheus et PromQL, alertes, SLO, incidents, Ansible.

| Story | Points | Statut |
|-------|--------|--------|
| #48 US-4.4 Simulateurs Prometheus et Ansible (enabler) | 8 | Terminé |
| #35 US-4d Cours Exploitation : observabilité, SRE, Ansible | 8 | En cours |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception

- `lib/prom/` : séries temporelles générées de façon déterministe (compteurs de requêtes par code et route, histogrammes de latence, gauges mémoire et CPU), et un évaluateur PromQL : sélecteurs avec `=`, `!=`, `=~`, `!~`, plages `[5m]`, `rate`, `irate`, `increase`, `sum`/`avg`/`max`/`min`/`count` avec `by` et `without`, opérateurs arithmétiques et de comparaison entre vecteurs et scalaires, `histogram_quantile`, `topk`, `absent`. Erreurs au format de Prometheus. Un défi PromQL s'écrit dans l'éditeur ; le résultat (vecteur, valeurs) est comparé à l'attendu.
- Règles d'alerte (YAML de Prometheus) : `expr`, `for`, `labels`, `annotations`, évaluées sur la période simulée (pending puis firing).
- `lib/ansible/` : `ansible-playbook -i inventaire playbook.yml` appliqué au terminal Linux simulé (l'hôte cible est la machine du terminal) ; modules `apt`, `copy`, `template` (Jinja2 simple), `file`, `lineinfile`, `user`, `group`, `service`/`systemd`, `command`/`shell`, `debug` ; `become`, `vars`, `loop`, `when`, `notify`/handlers, `--check` et `--diff` ; sortie PLAY/TASK/PLAY RECAP au format d'ansible-core 2.17, avec `ok`/`changed` : un second passage doit être entièrement `ok` (idempotence).
- SLI, SLO et budget d'erreur : défis Python (déjà exécutés dans le navigateur).

## Journal

- 12 nov. : issue #48 et branche `us-4.4/simulateurs-exploitation` créées, conception ci-dessus. Prochaine étape : `lib/prom/promql.js` et ses tests.
- 12 nov. : `lib/prom/promql.js` (séries et évaluateur PromQL) et `lib/prom/cli.js` (Prometheus sur le port 9090 avec règles et alertes, `promtool query instant`, `promtool check rules|config`, critères `promql` et `alerts`) écrits et essayés. Prochaine étape : `lib/ansible/` puis tests unitaires.
- 12 nov. : `lib/ansible/ansible.js` (ansible-playbook et ansible, modules, Jinja2, handlers, check et diff, idempotence) ; 5 tests unitaires d'exploitation verts (68 en tout). PR #48 ensuite, puis le cours (#35).
- 12 nov. : PR #49 (simulateurs) fusionnée. Branche `us-4d/exploitation` : cours enregistré, chapitre observabilité validé (ex-01 à ex-05). Prévu : ex-06 SLO (Python), ex-07 incidents, ex-08 à ex-10 Ansible, ex-11 entretien.
