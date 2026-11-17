"""Serve the matchup application and its Python REST endpoints with Flask."""
import json
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
RULES = json.loads((ROOT / 'research/rules.json').read_text(encoding='utf-8'))
FIGHTERS = {fighter['id']: fighter for fighter in RULES['roster']}
STAGES = {stage[0] for stage in RULES['stages']}
app = Flask(__name__, static_folder=None)


def bound(value, low, high):
    return max(low, min(value, high))


def stage_adjustments(fighter, stage, enabled):
    entries = []
    if enabled:
        entries = [RULES['terrain'][trait][stage] for trait in fighter['terrain']]
        entries.extend(fighter.get('arena', {}).get(stage, []))
    values = {}
    for key, *_ in RULES['dimensions']:
        matching = [entry for entry in entries if entry[0] == key]
        limit = max([10] + [abs(entry[1]) for entry in matching if len(entry) == 4])
        values[key] = {
            'value': bound(sum(entry[1] for entry in matching), -limit, limit),
            'reasons': [entry[2] for entry in matching],
        }
    return values


def evaluate(left, right, stage, enabled=True):
    left_adjustments = stage_adjustments(left, stage, enabled)
    right_adjustments = stage_adjustments(right, stage, enabled)
    rows = []
    for key, label, weight, *_ in RULES['dimensions']:
        a, b = left['stats'][key], right['stats'][key]
        l_adj, r_adj = left_adjustments[key], right_adjustments[key]
        rows.append({
            'key': key, 'label': label, 'weight': weight, 'leftBase': a, 'rightBase': b,
            'left': bound(a + l_adj['value'], 1, 100), 'right': bound(b + r_adj['value'], 1, 100),
            'leftReasons': l_adj['reasons'], 'rightReasons': r_adj['reasons'],
        })
    left_total = sum(row['left'] * row['weight'] for row in rows)
    right_total = sum(row['right'] * row['weight'] for row in rows)
    margin = left_total - right_total
    result = 'draw' if abs(margin) <= 200 else 'left' if margin > 0 else 'right'
    return {'rows': rows, 'leftTotal': left_total, 'rightTotal': right_total, 'margin': margin, 'result': result}


def evaluate_classic(left, right):
    rows = [
        {'key': key, 'label': label, 'left': left['stats'][key], 'right': right['stats'][key]}
        for key, label in RULES['classicDimensions']
    ]
    left_points = sum(row['left'] >= row['right'] for row in rows)
    right_points = sum(row['right'] >= row['left'] for row in rows)
    left_total = sum(row['left'] for row in rows)
    right_total = sum(row['right'] for row in rows)
    margin = left_points - right_points or left_total - right_total
    return {
        'rows': rows, 'leftPoints': left_points, 'rightPoints': right_points,
        'leftTotal': left_total, 'rightTotal': right_total,
        'result': 'draw' if margin == 0 else 'left' if margin > 0 else 'right',
    }


@app.get('/api/fighters')
def list_fighters():
    medium = request.args.get('medium', '').strip().casefold()
    franchise = request.args.get('franchise', '').strip().casefold()
    term = request.args.get('q', '').strip().casefold()
    return jsonify([
        fighter for fighter in FIGHTERS.values()
        if (not medium or fighter['medium'].casefold() == medium)
        and (not franchise or fighter['franchise'].casefold() == franchise)
        and (not term or any(term in fighter[key].casefold() for key in ('name', 'franchise', 'version')))
    ])


@app.get('/api/matchups')
def matchup():
    left, right = request.args.get('left'), request.args.get('right')
    stage = request.args.get('stage', 'open')
    effects = request.args.get('arena_effects', 'true').strip().casefold()
    mode = request.args.get('mode', 'arena')
    if left == right or left not in FIGHTERS or right not in FIGHTERS or stage not in STAGES or effects not in {'true', 'false'} or mode not in {'arena', 'classic'}:
        return {'error': 'Choose distinct fighter IDs, a valid stage, true or false for arena_effects, and arena or classic mode.'}, 400
    if mode == 'classic':
        return jsonify(evaluate_classic(FIGHTERS[left], FIGHTERS[right]))
    return jsonify(evaluate(FIGHTERS[left], FIGHTERS[right], stage, effects == 'true'))


@app.get('/')
@app.get('/<path:filename>')
def web(filename='index.html'):
    return send_from_directory(ROOT / 'web', filename)
