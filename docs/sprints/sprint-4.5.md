# Sprint 4.5

**Objectif** : terminer l'étape DevOps avec l'exploitation : observabilité, Prometheus et PromQL, alertes, SLO, incidents, Ansible.

| Story | Points | Statut |
|-------|--------|--------|
| #48 US-4.4 Simulateurs Prometheus et Ansible (enabler) | 8 | En cours |
| #35 US-4d Cours Exploitation : observabilité, SRE, Ansible | 8 | À faire |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception

- `lib/prom/` : séries temporelles générées de façon déterministe (compteurs de requêtes par code et route, histogrammes de latence, gauges mémoire et CPU), et un évaluateur PromQL : sélecteurs avec `=`, `!=`, `=~`, `!~`, plages `[5m]`, `rate`, `irate`, `increase`, `sum`/`avg`/`max`/`min`/`count` avec `by` et `without`, opérateurs arithmétiques et de comparaison entre vecteurs et scalaires, `histogram_quantile`, `topk`, `absent`. Erreurs au format de Prometheus. Un défi PromQL s'écrit dans l'éditeur ; le résultat (vecteur, valeurs) est comparé à l'attendu.
- Règles d'alerte (YAML de Prometheus) : `expr`, `for`, `labels`, `annotations`, évaluées sur la période simulée (pending puis firing).
- `lib/ansible/` : `ansible-playbook -i inventaire playbook.yml` appliqué au terminal Linux simulé (l'hôte cible est la machine du terminal) ; modules `apt`, `copy`, `template` (Jinja2 simple), `file`, `lineinfile`, `user`, `group`, `service`/`systemd`, `command`/`shell`, `debug` ; `become`, `vars`, `loop`, `when`, `notify`/handlers, `--check` et `--diff` ; sortie PLAY/TASK/PLAY RECAP au format d'ansible-core 2.17, avec `ok`/`changed` : un second passage doit être entièrement `ok` (idempotence).
- SLI, SLO et budget d'erreur : défis Python (déjà exécutés dans le navigateur).

## Journal

- 12 nov. : issue #48 et branche `us-4.4/simulateurs-exploitation` créées, conception ci-dessus. Prochaine étape : `lib/prom/promql.js` et ses tests.
