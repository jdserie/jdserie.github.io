'use strict';
(function (root) {
  const DIMENSIONS = [
    ['strength', 'Strength', 12, 'Direct physical force and impact.'],
    ['speed', 'Speed', 12, 'Movement, reactions, and attack execution.'],
    ['durability', 'Durability', 11, 'Damage the fighter can withstand without recovery.'],
    ['stamina', 'Stamina', 8, 'How long the fighter can sustain their effort.'],
    ['skill', 'Combat skill', 10, 'Technical fighting ability and execution.'],
    ['tactics', 'Tactics', 8, 'Battlefield judgment and adaptation.'],
    ['abilities', 'Special abilities', 12, 'Unusual effects, counters, and defenses.'],
    ['equipment', 'Equipment', 6, 'Tools and weapons available in this profile.'],
    ['range', 'Range', 8, 'Ability to threaten and control distance.'],
    ['recovery', 'Recovery', 6, 'Healing, repair, or regeneration during combat.'],
    ['resolve', 'Resolve', 7, 'Composure and willingness to continue under pressure.'],
  ];
  const STAGES = [
    ['open', 'Open arena', 'Daylight, flat terrain, and unobstructed lines of sight.'],
    ['urban', 'Dense city', 'Buildings break sight lines and provide cover and vertical routes.'],
    ['forest', 'Dense forest', 'Canopy, obstacles, and short engagement distances.'],
    ['coast', 'Coast and shallows', 'A shoreline with dry ground, shallow water, and surf.'],
    ['inland', 'Enclosed ruins', 'An indoor ruin with limited flight space and tight corners.'],
    ['sky', 'High platforms', 'Elevated platforms with gaps and open air.'],
  ];
  const TERRAIN = {
    aerial: {
      open: ['range', 3, 'Open sight lines support attacks from the air.'], urban: ['speed', 2, 'Tall structures offer vertical routes.'],
      forest: ['speed', -4, 'Canopy limits low-altitude movement.'], coast: ['range', 2, 'Flight can bypass the shore break.'],
      inland: ['speed', -8, 'Ceilings and walls obstruct aerial movement.'], sky: ['speed', 9, 'Flight reduces the cost of crossing open gaps.'],
    },
    marksman: {
      open: ['range', 8, 'Unbroken sight lines support ranged attacks.'], urban: ['tactics', 4, 'Buildings provide cover and elevated positions.'],
      forest: ['range', -5, 'Trees break sight lines.'], coast: ['range', 2, 'The shoreline leaves longer sight lines.'],
      inland: ['range', -8, 'Tight corners shorten engagement distance.'], sky: ['range', 6, 'Open gaps create wide firing lanes.'],
    },
    brawler: {
      open: ['range', -4, 'Little cover on the approach to close range.'], urban: ['tactics', 3, 'Cover helps close the distance.'],
      forest: ['skill', 4, 'Obstacles favor close engagements.'], coast: ['speed', -4, 'Surf and wet footing slow ground movement.'],
      inland: ['skill', 7, 'Tight corridors favor close-range fighting.'], sky: ['speed', -6, 'Ground approaches are interrupted by gaps.'],
    },
    mobile: {
      open: ['speed', 3, 'Few obstacles interrupt movement.'], urban: ['speed', 7, 'Structures create routes and flanking options.'],
      forest: ['tactics', 4, 'Cover enables repositioning.'], coast: ['speed', -3, 'Wet footing slows movement.'],
      inland: ['speed', -4, 'Enclosed routes limit repositioning.'], sky: ['speed', 4, 'Agility helps cross elevated routes.'],
    },
    aquatic: {
      open: ['abilities', -3, 'Water-dependent options are limited.'], urban: ['abilities', -4, 'Water access is limited.'],
      forest: ['abilities', -3, 'Water access is uncertain.'], coast: ['abilities', 10, 'Adjacent water is immediately available.'],
      inland: ['range', -4, 'There is little usable water inside.'], sky: ['abilities', -6, 'The arena offers little water access.'],
    },
    tactical: {
      open: ['tactics', -2, 'The flat arena provides few positional tools.'], urban: ['tactics', 7, 'Cover and routes reward planning.'],
      forest: ['tactics', 6, 'Obstructed sight lines reward ambushes.'], coast: ['tactics', 2, 'The shore creates alternate approaches.'],
      inland: ['tactics', 5, 'Corners and chokepoints create positional advantages.'], sky: ['tactics', -3, 'Limited routes reduce flanking options.'],
    },
    controller: {
      open: ['range', 4, 'Open space extends area control.'], urban: ['range', -3, 'Structures can obstruct broad attacks.'],
      forest: ['range', -4, 'Terrain interrupts broad attacks.'], coast: ['range', 2, 'Open shoreline helps cover multiple approaches.'],
      inland: ['range', -6, 'Walls limit area coverage.'], sky: ['range', 4, 'Open air supports area control.'],
    },
    stealth: {
      open: ['skill', -6, 'Exposed positions reduce concealment.'], urban: ['tactics', 6, 'Corners and cover create ambush opportunities.'],
      forest: ['tactics', 8, 'Dense cover supports concealment.'], coast: ['skill', -3, 'The open shore exposes movement.'],
      inland: ['skill', 4, 'Dark corners and short sight lines help concealment.'], sky: ['tactics', -5, 'Gaps and exposed platforms reduce approach routes.'],
    },
  };
  const bound = (v, low, high) => Math.max(low, Math.min(high, v));
  const CLASSIC_DIMENSIONS = [
    ['tactics', 'Intelligence'], ['strength', 'Strength'], ['speed', 'Speed'],
    ['durability', 'Durability'], ['abilities', 'Power'], ['skill', 'Combat ability'],
  ];

  function evaluateClassic(left, right) {
    const rows = CLASSIC_DIMENSIONS.map(([key, label]) => ({
      key, label, left: left.stats[key], right: right.stats[key],
    }));
    const leftPoints = rows.filter(row => row.left >= row.right).length;
    const rightPoints = rows.filter(row => row.right >= row.left).length;
    const leftTotal = rows.reduce((total, row) => total + row.left, 0);
    const rightTotal = rows.reduce((total, row) => total + row.right, 0);
    const margin = leftPoints - rightPoints || leftTotal - rightTotal;
    return { rows, leftPoints, rightPoints, leftTotal, rightTotal, result: margin === 0 ? 'draw' : margin > 0 ? 'left' : 'right' };
  }

  function stageAdjustments(fighter, stage, enabled) {
    const entries = !enabled ? [] : fighter.terrain.flatMap(trait => TERRAIN[trait]?.[stage] ? [TERRAIN[trait][stage]] : []);
    if (enabled && fighter.arena?.[stage]) entries.push(...fighter.arena[stage]);
    return Object.fromEntries(DIMENSIONS.map(([key]) => {
      const matching = entries.filter(entry => entry[0] === key);
      const evidenceLimit = matching.reduce((limit, entry) => entry[3] ? Math.max(limit, Math.abs(entry[1])) : limit, 10);
      return [key, {
        value: bound(matching.reduce((sum, entry) => sum + entry[1], 0), -evidenceLimit, evidenceLimit),
        reasons: matching.map(entry => entry[2]),
      }];
    }));
  }

  function evaluate(left, right, stage, enabled = true) {
    if (!left || !right || !STAGES.some(([key]) => key === stage)) throw new Error('Choose fighters and an arena.');
    const leftAdjustments = stageAdjustments(left, stage, enabled);
    const rightAdjustments = stageAdjustments(right, stage, enabled);
    const rows = DIMENSIONS.map(([key, label, weight]) => ({
      key, label, weight,
      leftBase: left.stats[key], rightBase: right.stats[key],
      left: bound(left.stats[key] + leftAdjustments[key].value, 1, 100),
      right: bound(right.stats[key] + rightAdjustments[key].value, 1, 100),
      leftReasons: leftAdjustments[key].reasons, rightReasons: rightAdjustments[key].reasons,
    }));
    const leftTotal = rows.reduce((sum, row) => sum + row.left * row.weight, 0);
    const rightTotal = rows.reduce((sum, row) => sum + row.right * row.weight, 0);
    const margin = leftTotal - rightTotal;
    return {
      rows, leftTotal, rightTotal, margin,
      result: Math.abs(margin) <= 200 ? 'draw' : margin > 0 ? 'left' : 'right',
    };
  }
  const exported = { DIMENSIONS, STAGES, TERRAIN, CLASSIC_DIMENSIONS, evaluate, evaluateClassic, stageAdjustments };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.FightEngine = exported;
})(globalThis);
