# Who Would Win in a Fight? 2.0

Joshua Serie's independent fan matchup app compares 48 fighter profiles from anime, comics, games, and Greek mythology. Choose two versions, select one of six arenas, and inspect the 11 weighted scores. Saved simulations build a win, loss, and toss-up record on your device.

[Play or download the app](https://jdserie.github.io/projects/who-would-win-2/web/) · [Episode and source notes](web/research.html)

## Ratings and sources

The original 2019 [Argument Resolved client](https://github.com/arguementresolved/angular_red_badge) and [Flask service](https://github.com/arguementresolved/flask_red_badge) credit Logan Chaves for repository and back-end work, Xzavier Dunn for front-end and back-end leadership, and Joshua D. Serie for simulations and front-end work. The client history ends with deployment work in April 2019. The API history ends with battle calculation updates and user update/delete work in April 2019.

Classic mode follows the original documented six-category point count and total-score tiebreaker, including a point to each fighter for tied category scores. It maps the original intelligence, power, and combat ratings to the current tactics, special abilities, and combat skill ratings. The original service queried a third-party stat API. Its historical ratings and match ledger were not recovered, so both modes use new, editable estimates for the listed fighters. The numerical scores do not represent measured win probabilities or official outcomes.

Arenas affect fighters according to their abilities and tactics. Most modifiers are capped at 10 points in either direction per category, with documented exceptions in the roster. Every listed fighter receives a stage assessment.

## Run locally

The offline browser engine runs in JavaScript. A Python Flask server provides equivalent JSON endpoints and serves the same browser app locally.

```sh
python -m venv .venv
# Activate the environment, then run:
python -m pip install -r requirements.txt
python -m flask --app app run
```

Open http://127.0.0.1:5000. The API exposes `GET /api/fighters` and `GET /api/matchups?left=goku&right=superman&stage=open`. Add `mode=classic` to use the classic rules.

## Install

- Android 8 or later can install the signed APK from the Downloads section. The Android app bundles the comparison engine for offline use.
- Windows x64, ARM64, and x86 installers create per-user shortcuts and open the web app in Microsoft Edge.
- iPhone and iPad can add the web app to the Home Screen from Safari. Mac and Linux can use the browser version and install it where their browser supports web app installation.

`web/downloads/SHA256SUMS.txt` contains the release package hashes.

## Update or build

Edit `research/roster.tsv`, then run `python research/build_roster.py` and `node research/export_rules.cjs` to regenerate the browser roster and Flask data. `python research/build_research.py` regenerates the episode notes. Windows launchers build with `python windows/build.py` and Go. Android builds with `android/build.sh`, JDK, Android SDK Platform 35, Build Tools 35.0.0, and a signing key provided separately. For a public web update, increment the cache version in `web/sw.js`.

Fighter names and fictional settings belong to their respective creators and rights holders.
