export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 64;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  setupForStage(cols, rows) {
    const maxW = Math.floor((this.canvas.width - 60) / cols);
    const maxH = Math.floor((this.canvas.height - 40) / rows);
    this.tileSize = Math.min(maxW, maxH, 72);
    this.offsetX = Math.floor((this.canvas.width - cols * this.tileSize) / 2);
    this.offsetY = Math.floor((this.canvas.height - rows * this.tileSize) / 2);
  }

  tileToScreen(col, row) {
    return {
      x: this.offsetX + col * this.tileSize,
      y: this.offsetY + row * this.tileSize,
    };
  }

  screenToTile(x, y) {
    return {
      col: Math.floor((x - this.offsetX) / this.tileSize),
      row: Math.floor((y - this.offsetY) / this.tileSize),
    };
  }

  clear() {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTerrain(board) {
    const fill = { g: '#3a5c3a', f: '#2d4e2d', w: '#1a304e', m: '#484848' };
    const stroke = { g: '#4a7a4a', f: '#3a6a3a', w: '#2a5a8c', m: '#686868' };
    const ts = this.tileSize;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const t = board.getTerrain(c, r);
        const { x, y } = this.tileToScreen(c, r);

        this.ctx.fillStyle = fill[t] || fill.g;
        this.ctx.fillRect(x, y, ts, ts);
        this.ctx.strokeStyle = stroke[t] || stroke.g;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);

        if (ts >= 28) {
          this.ctx.save();
          this.ctx.font = `${Math.floor(ts * 0.3)}px serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'bottom';
          this.ctx.globalAlpha = 0.22;
          if (t === 'f') this.ctx.fillText('🌲', x + ts / 2, y + ts);
          else if (t === 'w') this.ctx.fillText('〰', x + ts / 2, y + ts);
          else if (t === 'm') this.ctx.fillText('▲', x + ts / 2, y + ts);
          this.ctx.restore();
        }
      }
    }
  }

  drawHighlights(highlights) {
    const fillColors = {
      selected: 'rgba(255,255,100,0.32)',
      move:     'rgba(80,130,255,0.28)',
      attack:   'rgba(255,70,70,0.32)',
      skill:    'rgba(255,140,40,0.32)',
      hover:    'rgba(255,255,255,0.09)',
    };
    const strokeColors = {
      selected: 'rgba(255,255,100,0.9)',
      move:     'rgba(100,150,255,0.8)',
      attack:   'rgba(255,80,80,0.8)',
      skill:    'rgba(255,150,50,0.8)',
      hover:    'rgba(255,255,255,0.28)',
    };
    const ts = this.tileSize;

    for (const { col, row, type } of highlights) {
      const { x, y } = this.tileToScreen(col, row);
      this.ctx.fillStyle = fillColors[type] || fillColors.hover;
      this.ctx.fillRect(x, y, ts, ts);
      this.ctx.strokeStyle = strokeColors[type] || strokeColors.hover;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
    }
  }

  drawUnits(units) {
    for (const unit of units) {
      if (!unit.isDead) this._drawUnit(unit);
    }
  }

  _drawUnit(unit) {
    const { x, y } = this.tileToScreen(unit.col, unit.row);
    const ts = this.tileSize;
    const pad = Math.floor(ts * 0.11);
    const ux = x + pad, uy = y + pad;
    const uw = ts - pad * 2, uh = ts - pad * 2;
    const spent = unit.hasMoved && (unit.hasActed || unit.hasWaited);

    this.ctx.save();
    this.ctx.globalAlpha = spent ? 0.5 : 1;

    // Body
    this.ctx.fillStyle = unit.color;
    this.ctx.beginPath();
    if (this.ctx.roundRect) this.ctx.roundRect(ux, uy, uw, uh, 5);
    else this.ctx.rect(ux, uy, uw, uh);
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = unit.isEnemy ? '#e07070' : '#a0d0a0';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Symbol
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `bold ${Math.floor(ts * 0.38)}px 'Courier New', monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(unit.symbol, x + ts / 2, y + ts / 2 - Math.floor(ts * 0.04));

    this.ctx.restore();

    // HP bar
    const barH = Math.max(3, Math.floor(ts * 0.09));
    const barY = y + ts - pad - barH;
    const ratio = unit.hp / unit.maxHp;
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.ctx.fillRect(ux, barY, uw, barH);
    this.ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336';
    this.ctx.fillRect(ux, barY, Math.max(1, Math.floor(uw * ratio)), barH);

    // Status effect dot
    if (unit.statusEffects.length > 0) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.beginPath();
      this.ctx.arc(x + ts - pad - 4, y + pad + 4, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  spawnFloatingNumber(col, row, amount, isHeal = false) {
    const { x, y } = this.tileToScreen(col, row);
    const ts = this.tileSize;
    return {
      x: x + ts / 2,
      y: y + ts / 2,
      text: isHeal ? `+${amount}` : `-${amount}`,
      color: isHeal ? '#7ec87e' : '#ff6060',
      vy: -1.5,
      opacity: 1,
      life: 55,
    };
  }

  renderFloatingNumbers(nums) {
    for (const fn of nums) {
      this.ctx.save();
      this.ctx.globalAlpha = fn.opacity;
      this.ctx.font = `bold ${Math.floor(this.tileSize * 0.32)}px 'Courier New', monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(fn.text, fn.x, fn.y);
      this.ctx.fillStyle = fn.color;
      this.ctx.fillText(fn.text, fn.x, fn.y);
      this.ctx.restore();
    }
  }
}
