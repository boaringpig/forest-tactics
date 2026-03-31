export class Board {
  constructor(stageData) {
    this.cols = stageData.width;
    this.rows = stageData.height;
    // Convert flat tile array to 2D: terrain[row][col]
    this.terrain = [];
    for (let r = 0; r < this.rows; r++) {
      this.terrain[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.terrain[r][c] = stageData.tiles[r * this.cols + c];
      }
    }
    this.units = [];
  }

  isInBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  getTerrain(col, row) {
    if (!this.isInBounds(col, row)) return null;
    return this.terrain[row][col];
  }

  isPassable(col, row) {
    const t = this.getTerrain(col, row);
    return t !== null && t !== 'w' && t !== 'm';
  }

  getTerrainDefBonus(col, row) {
    return this.getTerrain(col, row) === 'f' ? 1 : 0;
  }

  getUnitAt(col, row) {
    return this.units.find(u => !u.isDead && u.col === col && u.row === row) || null;
  }

  addUnit(unit, col, row) {
    unit.col = col;
    unit.row = row;
    if (!this.units.includes(unit)) this.units.push(unit);
  }

  getReachableTiles(unit) {
    if (unit.movementType === 'wolf') return this._wolfMoves(unit);
    if (unit.movementType === 'crow') return this._crowMoves(unit);
    return this._floodFill(unit);
  }

  _floodFill(unit) {
    const visited = new Map();
    const queue = [{ col: unit.col, row: unit.row, cost: 0 }];
    visited.set(`${unit.col},${unit.row}`, 0);
    const reachable = [];

    while (queue.length) {
      const { col, row, cost } = queue.shift();
      if (cost > 0 && !this.getUnitAt(col, row)) reachable.push({ col, row });
      if (cost >= unit.mov) continue;

      for (const [dc, dr] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nc = col + dc, nr = row + dr;
        const key = `${nc},${nr}`;
        if (this.isPassable(nc, nr) && (!visited.has(key) || visited.get(key) > cost + 1)) {
          visited.set(key, cost + 1);
          queue.push({ col: nc, row: nr, cost: cost + 1 });
        }
      }
    }
    return reachable.filter(t => !this.getUnitAt(t.col, t.row));
  }

  _wolfMoves(unit) {
    // Knight-jump BFS: each L-shaped hop costs 1 move point
    const visited = new Map();
    const queue = [{ col: unit.col, row: unit.row, cost: 0 }];
    visited.set(`${unit.col},${unit.row}`, 0);
    const reachable = [];
    const hops = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

    while (queue.length) {
      const { col, row, cost } = queue.shift();
      if (cost > 0 && !this.getUnitAt(col, row)) reachable.push({ col, row });
      if (cost >= unit.mov) continue;

      for (const [dc, dr] of hops) {
        const nc = col + dc, nr = row + dr;
        const key = `${nc},${nr}`;
        if (this.isInBounds(nc, nr) && this.isPassable(nc, nr) &&
            (!visited.has(key) || visited.get(key) > cost + 1)) {
          visited.set(key, cost + 1);
          queue.push({ col: nc, row: nr, cost: cost + 1 });
        }
      }
    }
    return reachable.filter(t => !this.getUnitAt(t.col, t.row));
  }

  _crowMoves(unit) {
    // Flying: Chebyshev distance up to MOV, ignores terrain passability
    const reachable = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dist = Math.max(Math.abs(c - unit.col), Math.abs(r - unit.row));
        if (dist > 0 && dist <= unit.mov && !this.getUnitAt(c, r)) {
          reachable.push({ col: c, row: r });
        }
      }
    }
    return reachable;
  }

  getTilesInRange(col, row, range) {
    const tiles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dist = Math.abs(c - col) + Math.abs(r - row);
        if (dist > 0 && dist <= range) tiles.push({ col: c, row: r });
      }
    }
    return tiles;
  }

  getEnemiesInRange(unit, range) {
    return this.getTilesInRange(unit.col, unit.row, range)
      .map(t => this.getUnitAt(t.col, t.row))
      .filter(u => u && u.isEnemy !== unit.isEnemy);
  }

  getAlliesInRange(unit, range) {
    return this.getTilesInRange(unit.col, unit.row, range)
      .map(t => this.getUnitAt(t.col, t.row))
      .filter(u => u && u.isEnemy === unit.isEnemy && u !== unit);
  }
}
