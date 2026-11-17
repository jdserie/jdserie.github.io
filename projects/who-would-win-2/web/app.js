'use strict';
const { DIMENSIONS, STAGES, evaluate, evaluateClassic } = globalThis.FightEngine;
const roster = [...globalThis.FightRoster].sort((a, b) => a.name.localeCompare(b.name));
const fighterIndex = new Map(roster.map(fighter => [fighter.id, fighter]));
const storageKey = 'who-would-win-2-match-history';
const ratingsKey = 'who-would-win-2-custom-ratings';
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
const formatScore = value => (value / 100).toFixed(2);
let comparison;
let limit = 24;
let matches = [];
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) matches = stored.filter(match => match &&
    fighterIndex.has(match.left) && fighterIndex.has(match.right) &&
    ['draw', 'left', 'right'].includes(match.result) && STAGES.some(stage => stage[0] === match.stage)
  ).slice(0, 300);
} catch { /* The app remains usable when storage is unavailable. */ }

const customRatings = new Map();
const validRating = value => Number.isInteger(value) && value >= 1 && value <= 100;
try {
  const stored = JSON.parse(localStorage.getItem(ratingsKey) || '{}');
  for (const fighter of roster) {
    const ratings = stored?.[fighter.id];
    if (DIMENSIONS.every(([key]) => validRating(ratings?.[key]))) {
      customRatings.set(fighter.id, ratings);
    }
  }
} catch { /* Default ratings remain available. */ }

function typedOptions(values) {
  return [...new Set(values)].sort().map(value => option(value, value)).join('');
}

function updateStage() {
  const classic = byId('scoring').value === 'classic';
  byId('stage').disabled = classic;
  byId('modifiers').disabled = classic;
  const stage = STAGES.find(([key]) => key === byId('stage').value);
  byId('stage-description').textContent = classic ? 'Classic matchups use base ratings.' : stage?.[2] || '';
}

function valueCell(base, result, reasons) {
  const delta = result - base;
  const adjustment = delta ? ` <span class="delta ${delta > 0 ? 'plus' : 'minus'}">(${delta > 0 ? '+' : ''}${delta})</span>` : '';
  const note = reasons.length ? `<small>${escapeHtml(reasons.join(' '))}</small>` : '';
  return `<td>${result}${adjustment}${note}</td>`;
}

function showResult(left, right, stage) {
  const withRatings = fighter => ({
    ...fighter,
    stats: customRatings.get(fighter.id) || fighter.stats,
  });
  const classic = byId('scoring').value === 'classic';
  const arenaEffects = !classic && byId('modifiers').checked;
  const result = classic ? evaluateClassic(withRatings(left), withRatings(right)) :
    evaluate(withRatings(left), withRatings(right), stage, arenaEffects);
  const custom = [left, right].filter(fighter => customRatings.has(fighter.id));
  const winner = result.result === 'draw' ? 'Toss-up' : `${result.result === 'left' ? left.name : right.name} has the edge`;
  const summary = classic
    ? `Classic · ${result.leftPoints} to ${result.rightPoints} category points · ${result.leftTotal} to ${result.rightTotal} rating totals`
    : `${STAGES.find(([key]) => key === stage)[1]} · ${formatScore(result.leftTotal)} to ${formatScore(result.rightTotal)} weighted points`;
  comparison = { left: left.id, right: right.id, stage, result: result.result, arenaEffects, mode: classic ? 'classic' : 'arena' };
  const panel = byId('result');
  panel.innerHTML = `<h3>${escapeHtml(winner)}</h3>
    <p>${escapeHtml(summary)}</p>
    ${custom.length ? `<p class="muted">Custom ratings for ${custom.map(fighter => escapeHtml(fighter.name)).join(' and ')}.</p>` : ''}
    <div class="result-table" tabindex="0"><table><thead><tr><th scope="col">Category</th>
      <th scope="col">${escapeHtml(left.name)}</th><th scope="col">${escapeHtml(right.name)}</th></tr></thead><tbody>
      ${result.rows.map(row => `<tr><th scope="row">${escapeHtml(row.label)}${classic ? '' : ` <small>${row.weight}% weight</small>`}</th>
        ${classic ? `<td>${row.left}</td><td>${row.right}</td>`
          : valueCell(row.leftBase, row.left, row.leftReasons) + valueCell(row.rightBase, row.right, row.rightReasons)}</tr>`).join('')}
      </tbody></table></div>
    <p><strong>${escapeHtml(left.name)}</strong> · ${escapeHtml(left.note)}</p>
    <p><strong>${escapeHtml(right.name)}</strong> · ${escapeHtml(right.note)}</p>
    <button id="save-match" type="button">Save to win–loss record</button>
    <span id="save-feedback" role="status" class="muted"></span>`;
  panel.hidden = false;
  byId('save-match').addEventListener('click', saveMatch);
}

function saveMatch() {
  if (!comparison) return;
  const next = [comparison, ...matches].slice(0, 300);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    matches = next;
    byId('save-feedback').textContent = ' Saved.';
    byId('save-match').disabled = true;
    renderHistory();
  } catch {
    byId('save-feedback').textContent = ' Storage is unavailable on this device.';
  }
}

function renderHistory() {
  const counts = new Map();
  for (const record of matches) for (const side of ['left', 'right']) {
    const id = record[side];
    if (!counts.has(id)) counts.set(id, { win: 0, loss: 0, draw: 0 });
    const outcome = record.result === 'draw' ? 'draw' : record.result === side ? 'win' : 'loss';
    counts.get(id)[outcome]++;
  }
  if (!matches.length) {
    byId('record-body').innerHTML = '<p>No saved matchups yet.</p>';
    return;
  }
  byId('record-body').innerHTML = `<div class="result-table"><table><thead><tr>
    <th scope="col">Fighter</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Toss-ups</th>
    </tr></thead><tbody>${[...counts].sort((a, b) => b[1].win - a[1].win || fighterIndex.get(a[0]).name.localeCompare(fighterIndex.get(b[0]).name))
      .map(([id, count]) => `<tr><th scope="row">${escapeHtml(fighterIndex.get(id).name)}</th><td>${count.win}</td><td>${count.loss}</td><td>${count.draw}</td></tr>`).join('')}</tbody></table></div>
    <details><summary>Recent saved matchups</summary><ul>${matches.slice(0, 20).map(match =>
      `<li>${escapeHtml(fighterIndex.get(match.left).name)} vs. ${escapeHtml(fighterIndex.get(match.right).name)}
      · ${match.mode === 'classic' ? 'Classic' : escapeHtml(STAGES.find(stage => stage[0] === match.stage)[1])}
      · ${match.result === 'draw' ? 'Toss-up' : escapeHtml(fighterIndex.get(match[match.result]).name) + ' favored'}</li>`).join('')}</ul></details>`;
}

function renderRoster() {
  const query = byId('search').value.trim().toLocaleLowerCase();
  const medium = byId('medium').value;
  const franchise = byId('franchise').value;
  const visible = roster.filter(fighter => (!medium || fighter.medium === medium) &&
    (!franchise || fighter.franchise === franchise) &&
    [fighter.name, fighter.franchise, fighter.version].some(value => value.toLocaleLowerCase().includes(query)));
  byId('roster-count').textContent = `${visible.length} of ${roster.length} fighters`;
  byId('fighter-grid').innerHTML = visible.slice(0, limit).map(fighter =>
    `<article class="fighter"><h3>${escapeHtml(fighter.name)}</h3><p>${escapeHtml(fighter.franchise)}</p>
      <p>${escapeHtml(fighter.version)}</p><button type="button" class="secondary" data-fighter="${escapeHtml(fighter.id)}">View ratings</button></article>`).join('');
  byId('more').hidden = visible.length <= limit;
}

function showFighter(fighter) {
  const dlg = byId('fighter-details');
  const ratings = customRatings.get(fighter.id) || fighter.stats;
  dlg.innerHTML = `<form method="dialog"><button class="close secondary" aria-label="Close details">Close</button></form>
    <h2 id="fighter-name">${escapeHtml(fighter.name)}</h2><p class="muted">${escapeHtml(fighter.version)}</p>
    <p>${escapeHtml(fighter.note)}</p><p><a href="${escapeHtml(fighter.source)}" target="_blank" rel="noopener">Character source</a></p>
    <form id="rating-form">
      <p class="muted">Custom ratings apply to new matchups on this device.</p>
      <div class="result-table"><table><thead><tr><th scope="col">Category</th><th scope="col">Default</th><th scope="col">Rating</th></tr></thead>
      <tbody>${DIMENSIONS.map(([key, label]) => `<tr><th scope="row"><label for="rating-${key}">${escapeHtml(label)}</label></th>
        <td>${fighter.stats[key]}</td><td><input id="rating-${key}" name="${key}" type="number" min="1" max="100" step="1" value="${ratings[key]}" required></td></tr>`).join('')}</tbody></table></div>
      <div class="rating-actions"><button type="submit">Save ratings</button><button id="reset-ratings" class="secondary" type="button">Restore defaults</button></div>
      <p id="rating-feedback" role="status" class="muted"></p>
    </form>`;
  const form = byId('rating-form');
  const saveRatings = values => {
    const next = new Map(customRatings);
    if (values) next.set(fighter.id, values);
    else next.delete(fighter.id);
    try {
      localStorage.setItem(ratingsKey, JSON.stringify(Object.fromEntries(next)));
    } catch {
      byId('rating-feedback').textContent = 'Storage is unavailable on this device.';
      return false;
    }
    if (values) customRatings.set(fighter.id, values);
    else customRatings.delete(fighter.id);
    if (comparison && [comparison.left, comparison.right].includes(fighter.id)) {
      comparison = undefined;
      byId('result').hidden = true;
    }
    byId('rating-feedback').textContent = values ? 'Custom ratings saved.' : 'Default ratings restored.';
    return true;
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(DIMENSIONS.map(([key]) => [key, form.elements[key].valueAsNumber]));
    if (!Object.values(values).every(validRating)) return;
    const differs = DIMENSIONS.some(([key]) => values[key] !== fighter.stats[key]);
    saveRatings(differs ? values : null);
  });
  byId('reset-ratings').addEventListener('click', () => {
    if (!saveRatings(null)) return;
    for (const [key] of DIMENSIONS) form.elements[key].value = fighter.stats[key];
  });
  dlg.showModal();
}

for (const id of ['left', 'right']) {
  byId(id).innerHTML = roster.map(fighter => option(fighter.id, `${fighter.name} · ${fighter.franchise}`)).join('');
}
byId('left').value = 'goku';
byId('right').value = 'superman';
byId('stage').innerHTML = STAGES.map(([id, label]) => option(id, label)).join('');
byId('medium').insertAdjacentHTML('beforeend', typedOptions(roster.map(fighter => fighter.medium)));
byId('franchise').insertAdjacentHTML('beforeend', typedOptions(roster.map(fighter => fighter.franchise)));
byId('category-method').innerHTML = '<dl>' + DIMENSIONS.map(([, label, weight, detail]) =>
  `<dt><strong>${escapeHtml(label)} · ${weight}%</strong></dt><dd>${escapeHtml(detail)}</dd>`).join('') + '</dl>';

byId('stage').addEventListener('change', updateStage);
byId('scoring').addEventListener('change', updateStage);
byId('match-form').addEventListener('submit', event => {
  event.preventDefault();
  const left = byId('left').value;
  const right = byId('right').value;
  if (left === right) {
    byId('input-error').textContent = 'Choose two different fighters.';
    byId('result').hidden = true;
    return;
  }
  byId('input-error').textContent = '';
  showResult(fighterIndex.get(left), fighterIndex.get(right), byId('stage').value);
});
for (const id of ['search', 'medium', 'franchise']) byId(id).addEventListener('input', () => { limit = 24; renderRoster(); });
byId('more').addEventListener('click', () => { limit += 24; renderRoster(); });
byId('fighter-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-fighter]');
  if (button) showFighter(fighterIndex.get(button.dataset.fighter));
});
updateStage();
renderRoster();
renderHistory();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (location.protocol === 'file:') {
  for (const link of document.querySelectorAll('#downloads a[download]')) {
    link.href = new URL(link.getAttribute('href'), 'https://jdserie.github.io/projects/who-would-win-2/web/');
    link.removeAttribute('download');
  }
}
