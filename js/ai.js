export class AI {
  constructor(board) {
    this.board = board;
  }

  getAction(unit) {
    const targets = this.board.units.filter(u => !u.isEnemy && !u.isDead);
    if (!targets.length) return { type: 'wait' };

    switch (unit.aiType) {
      case 'ranged':  return this._rangedAction(unit, targets);
      case 'trapper': return this._trapperAction(unit, targets);
      default:        return this._aggressiveAction(unit, targets);
    }
  }

  _aggressiveAction(unit, targets) {
    const target = this._closest(unit, targets);
    if (this._dist(unit, target) <= 1) return { type: 'attack', target };

    const moveTo = this._moveToward(unit, target);
    if (this._dist(moveTo, target) <= 1) return { type: 'move_attack', moveTo, target };
    return { type: 'move', moveTo };
  }

  _rangedAction(unit, targets) {
    const target = this._closest(unit, targets);
    const shoot = unit.skills.find(s => s.name === 'Shoot' || s.ranged);
    const range = shoot ? shoot.range : 4;
    const dist = this._dist(unit, target);

    if (dist <= range) {
      // Back away if adjacent
      if (dist <= 1) {
        const back = this._moveAway(unit, target);
        if (back) return { type: 'move_skill', moveTo: back, skill: shoot, target };
      }
      return { type: 'skill', skill: shoot, target };
    }

    const moveTo = this._moveToward(unit, target);
    if (this._dist(moveTo, target) <= range) return { type: 'move_skill', moveTo, skill: shoot, target };
    return { type: 'move', moveTo };
  }

  _trapperAction(unit, targets) {
    const target = this._closest(unit, targets);
    const net = unit.skills.find(s => s.effect === 'immobilize');
    const range = net ? net.range : 3;

    if (this._dist(unit, target) <= range) return { type: 'skill', skill: net, target };

    const moveTo = this._moveToward(unit, target);
    if (this._dist(moveTo, target) <= range) return { type: 'move_skill', moveTo, skill: net, target };
    return { type: 'move', moveTo };
  }

  _closest(unit, targets) {
    return targets.reduce((best, t) =>
      this._dist(unit, t) < this._dist(unit, best) ? t : best
    );
  }

  _dist(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  _moveToward(unit, target) {
    const reachable = this.board.getReachableTiles(unit);
    if (!reachable.length) return { col: unit.col, row: unit.row };
    return reachable.reduce((best, t) =>
      this._dist(t, target) < this._dist(best, target) ? t : best,
      { col: unit.col, row: unit.row }
    );
  }

  _moveAway(unit, threat) {
    const reachable = this.board.getReachableTiles(unit);
    if (!reachable.length) return null;
    const cur = this._dist(unit, threat);
    const best = reachable.reduce((b, t) =>
      this._dist(t, threat) > this._dist(b, threat) ? t : b, reachable[0]
    );
    return this._dist(best, threat) > cur ? best : null;
  }
}
