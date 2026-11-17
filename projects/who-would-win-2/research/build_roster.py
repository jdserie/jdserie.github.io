"""Compile the reviewed editorial roster into the offline web dataset."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATS = ('strength', 'speed', 'durability', 'stamina', 'skill', 'tactics', 'abilities',
         'equipment', 'range', 'recovery', 'resolve')
OVERRIDES = {
    'luffy': {'coast': [['stamina', -8, 'Shallow water is an immersion risk for a Devil Fruit user. Dry ground remains available.']]},
    'aquaman': {'coast': [['strength', 3, 'Water access makes it easier to use his own aquatic maneuvering to deliver force.']]},
    'pikachu': {'coast': [['range', 3, 'Nearby water can conduct electricity, with no guarantee of a clean hit.']]},
    'charizard': {'coast': [['stamina', -5, 'Surf and wet footing restrict sustained ground movement.']]},
    'edward': {'inland': [['abilities', 4, 'Stone and metal surfaces provide material for transmutation.']]},
    'samus': {'inland': [['equipment', 4, 'Enclosed tunnels suit the Morph Ball and close-range equipment.']]},
    'batman': {'urban': [['equipment', 4, 'Buildings provide anchor points for the grappling gear.']]},
    'aang': {'coast': [['recovery', 2, 'Open shoreline provides potential cover for regrouping behind water barriers.']]},
    'dio': {'open': [['stamina', -16, 'Direct sunlight severely limits DIO’s ability to stay exposed.', 'https://www.viz.com/jojo-s-bizarre-adventure']]},
}


def compile_roster():
    with (ROOT / 'research/roster.tsv').open(newline='', encoding='utf-8') as file:
        rows = list(csv.DictReader(file, delimiter='\t'))
    spans = {key: (min(int(row[key]) for row in rows), max(int(row[key]) for row in rows)) for key in STATS}
    compiled = []
    for row in rows:
        stats = {}
        for key, (minimum, maximum) in spans.items():
            offset = int(row[key]) - minimum
            spread = maximum - minimum
            stats[key] = 1 if not spread else 1 + (198 * offset + spread) // (2 * spread)
        compiled.append({
            **{key: row[key] for key in ('id', 'name', 'franchise', 'medium', 'version', 'note', 'source')},
            'stats': stats,
            'terrain': row['terrain'].split(','),
            **({'arena': OVERRIDES[row['id']]} if row['id'] in OVERRIDES else {}),
        })
    return compiled


if __name__ == '__main__':
    (ROOT / 'web/roster.js').write_text(
        'globalThis.FightRoster = ' + json.dumps(compile_roster(), ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
