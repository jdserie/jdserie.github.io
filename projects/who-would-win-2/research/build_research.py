"""Build the app's research ledger from original episode-captions notes."""
import csv
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with (ROOT / 'research/roster.tsv').open(encoding='utf-8') as file:
    roster = {row['id']: row for row in csv.DictReader(file, delimiter='\t')}
with (ROOT / 'research/episodes.tsv').open(encoding='utf-8') as file:
    episodes = list(csv.DictReader(file, delimiter='\t'))
escape = html.escape
cards = []
for episode in episodes:
    left, right = [roster[episode[side]] for side in ('left', 'right')]
    winner = roster[episode['episode_winner']]['name']
    title = escape(f"{left['name']} vs. {right['name']}")
    video = f"https://www.youtube.com/watch?v={episode['video_id']}"
    cards.append(f'''<article class="panel"><h3>{title}</h3>
    <p><strong>Episode verdict</strong> · {escape(winner)}</p><p>{escape(episode['finding'])}</p>
    <p><strong>Application in 2.0</strong> · {escape(episode['application'])}</p>
    <p><a href="{video}">Generation 1 · original YouTube episode and captions</a></p>
    <p>Generation 2–3 leads · <a href="{escape(left['source'])}">{escape(left['franchise'])}</a> and
    <a href="{escape(right['source'])}">{escape(right['franchise'])}</a>. Episode links reused as character sources remain secondary evidence.</p></article>''')

(ROOT / 'web/research.html').write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Research notes · Who Would Win? 2.0</title><link rel="stylesheet" href="styles.css"></head>
<body><main class="wrap"><p><a href="./">← Back to matchups</a></p><h1>Research notes</h1>
<section class="panel"><h2>Scope and access</h2>
<p>Fifteen DEATH BATTLE episodes were selected with 30 distinct fighters. Written analysis is based on the YouTube captions, with official franchise links and character leads where available. Full video playback could not be verified in the research environment.</p>
<p>Generation 1 identifies the episode and reads the available transcript. Generation 2 follows the feat, version, equipment, and counter claims. Generation 3 traces those claims toward publisher records, manga chapters, game materials, or the closest source located. Unchecked chapters, paywalled evidence, fan interpretations, and untraced franchise leads remain open.</p>
<p>Episode verdicts are the show's interpretations. The 2.0 rating uses the stated profile and arena rules. Favoring the same fighter is neither a validation requirement nor an independent accuracy test.</p></section>
<section><h2>Episode comparison ledger</h2><div class="review-list">''' + ''.join(cards) +
'</div></section></main></body></html>\n', encoding='utf-8')
