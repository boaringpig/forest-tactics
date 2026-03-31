import { Board } from './board.js';
import { Unit } from './unit.js';
import { Renderer } from './renderer.js';
import { AI } from './ai.js';
import { UI } from './ui.js';

export class Game {
  constructor(canvas, data) {
    this.canvas = canvas;
    this.data = data;
    this.renderer = new Renderer(canvas);
    this.ui = new UI();

    this.board = null;
    this.playerUnits = [];
    this.enemyUnits = [];
    this.currentStageIndex = 0;
    this.turnNumber = 1;

    // Interaction state
    this.selectedUnit = null;
    this.actionMode = null;   // null | 'move' | 'attack' | 'skill'
    this.selectedSkill = null;
    this.highlights = [];
    this.hoveredTile = null;
    this.gamePhase = 'main_menu'; // main_menu | player_turn | enemy_turn | game_over

    this.floatingNums = [];

    this._bindButtons();
    this._bindCanvas();

    this.ui.showMainMenu(
      () => this.startCampaign(),
      () => {}
    );

    requestAnimationFrame(() => this._loop());
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  startCampaign() {
    this.currentStageIndex = 0;
    this.loadStage(0);
  }

  loadStage(index) {
    const campaign = this.data.campaigns[0];
    if (index >= campaign.stages.length) {
      this._showCampaignComplete();
      return;
    }

    const stageId = campaign.stages[index];
    const stageData = this.data.stages.find(s => s.id === stageId);
    if (!stageData) { console.error('Stage not found:', stageId); return; }

    this.board = new Board(stageData);
    this.renderer.setupForStage(stageData.width, stageData.height);

    // Spawn player units
    this.playerUnits = [];
    campaign.startingUnits.forEach((unitId, i) => {
      const spawn = stageData.playerSpawns[i];
      if (!spawn) return;
      const charData = this.data.characters.find(c => c.id === unitId);
      if (!charData) return;
      const unit = new Unit(charData, false);
      this.board.addUnit(unit, spawn.col, spawn.row);
      this.playerUnits.push(unit);
    });

    // Spawn enemy units
    this.enemyUnits = [];
    stageData.enemySpawns.forEach(spawn => {
      const enemyData = this.data.enemies.find(e => e.id === spawn.type);
      if (!enemyData) return;
      const unit = new Unit(enemyData, true);
      this.board.addUnit(unit, spawn.col, spawn.row);
      this.enemyUnits.push(unit);
    });

    this.turnNumber = 1;
    this.selectedUnit = null;
    this.actionMode = null;
    this.highlights = [];
    this.gamePhase = 'player_turn';

    this.ui.hideGameOver();
    this.ui.updateTurnInfo(true, this.turnNumber);
    this.ui.setActionButtons('idle', null);
    this.ui.updateUnitPanel(null);
    this.ui.log(`── Stage ${index + 1}: ${stageData.name} ──`, 'system');
    this.ui.log('Select a unit to begin.', 'system');
  }

  // ── Input ────────────────────────────────────────────────────────────────

  _bindCanvas() {
    this.canvas.addEventListener('click', e => this._onCanvasClick(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredTile = null;
      this.ui.hideTooltip();
    });
  }

  _bindButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('btn-move',     () => this._onMoveButton());
    on('btn-attack',   () => this._onAttackButton());
    on('btn-skill',    () => this._onSkillButton());
    on('btn-wait',     () => this._onWaitButton());
    on('btn-end-turn', () => this._endPlayerTurn());
  }

  _onCanvasClick(e) {
    if (this.gamePhase !== 'player_turn') return;
    const rect = this.canvas.getBoundingClientRect();
    const { col, row } = this.renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
    if (!this.board.isInBounds(col, row)) return;

    if (this.actionMode === 'move')    this._onMoveTile(col, row);
    else if (this.actionMode === 'attack') this._onAttackTile(col, row);
    else if (this.actionMode === 'skill')  this._onSkillTile(col, row);
    else                                   this._onSelectTile(col, row);
  }

  _onMouseMove(e) {
    if (!this.board) return;
    const rect = this.canvas.getBoundingClientRect();
    const { col, row } = this.renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);

    if (!this.board.isInBounds(col, row)) {
      this.hoveredTile = null;
      this.ui.hideTooltip();
      return;
    }

    this.hoveredTile = { col, row };
    const unit = this.board.getUnitAt(col, row);
    if (unit) {
      const tb = this.board.getTerrainDefBonus(col, row);
      this.ui.showTooltip(
        `${unit.name}  HP:${unit.hp}/${unit.maxHp}  ATK:${unit.getEffectiveAtk()}  DEF:${unit.getEffectiveDef(tb)}  MOV:${unit.mov}`,
        e.clientX, e.clientY
      );
    } else {
      const t = this.board.getTerrain(col, row);
      const names = { g: 'Grass', f: 'Forest (+1 DEF)', w: 'Water (impassable)', m: 'Mountain (impassable)' };
      this.ui.showTooltip(names[t] || t, e.clientX, e.clientY);
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────

  _onSelectTile(col, row) {
    const unit = this.board.getUnitAt(col, row);

    if (!unit || unit === this.selectedUnit) {
      this._deselect();
      return;
    }

    this.selectedUnit = unit;
    this.actionMode = null;
    this.highlights = [{ col, row, type: 'selected' }];
    const tb = this.board.getTerrainDefBonus(col, row);
    this.ui.updateUnitPanel(unit, tb);
    this.ui.setActionButtons(unit.isEnemy ? 'idle' : 'selected', unit.isEnemy ? null : unit);
  }

  _deselect() {
    this.selectedUnit = null;
    this.actionMode = null;
    this.highlights = [];
    this.ui.updateUnitPanel(null);
    this.ui.setActionButtons('idle', null);
    this.ui.hideSkillMenu();
  }

  // ── Move ─────────────────────────────────────────────────────────────────

  _onMoveButton() {
    const u = this.selectedUnit;
    if (!u || u.isEnemy || u.hasMoved || u.hasWaited) return;

    this.actionMode = 'move';
    const reachable = this.board.getReachableTiles(u);
    this.highlights = [
      { col: u.col, row: u.row, type: 'selected' },
      ...reachable.map(t => ({ ...t, type: 'move' })),
    ];
    this.ui.setActionButtons('moving', u);
    this.ui.log('Select a tile to move to.', 'system');
  }

  _onMoveTile(col, row) {
    const hit = this.highlights.find(h => h.col === col && h.row === row && h.type === 'move');
    if (!hit) {
      // Cancel move mode on click outside
      this.actionMode = null;
      const u = this.selectedUnit;
      this.highlights = u ? [{ col: u.col, row: u.row, type: 'selected' }] : [];
      this.ui.setActionButtons('selected', u);
      return;
    }

    const u = this.selectedUnit;
    u.col = col;
    u.row = row;
    u.hasMoved = true;

    this.actionMode = null;
    this.highlights = [{ col, row, type: 'selected' }];
    this.ui.updateUnitPanel(u, this.board.getTerrainDefBonus(col, row));
    this.ui.setActionButtons('selected', u);
    this.ui.log(`${u.name} moved.`, 'info');
    this._checkVictory();
  }

  // ── Attack ───────────────────────────────────────────────────────────────

  _onAttackButton() {
    const u = this.selectedUnit;
    if (!u || u.isEnemy || u.hasActed || u.hasWaited) return;

    const targets = this.board.getEnemiesInRange(u, 1);
    if (!targets.length) {
      this.ui.log('No enemies in range!', 'system');
      return;
    }

    this.actionMode = 'attack';
    this.highlights = [
      { col: u.col, row: u.row, type: 'selected' },
      ...targets.map(t => ({ col: t.col, row: t.row, type: 'attack' })),
    ];
    this.ui.setActionButtons('attacking', u);
    this.ui.log('Select an enemy to attack.', 'system');
  }

  _onAttackTile(col, row) {
    const hit = this.highlights.find(h => h.col === col && h.row === row && h.type === 'attack');
    const u = this.selectedUnit;

    if (!hit) {
      this.actionMode = null;
      this.highlights = u ? [{ col: u.col, row: u.row, type: 'selected' }] : [];
      this.ui.setActionButtons('selected', u);
      return;
    }

    const target = this.board.getUnitAt(col, row);
    if (!target) return;

    const tb = this.board.getTerrainDefBonus(target.col, target.row);
    const damage = target.takeDamage(u.getEffectiveAtk(), tb);
    this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
    u.hasActed = true;
    u.hasMoved = true;

    this.ui.log(`${u.name} attacks ${target.name} for ${damage} damage!`, 'damage');
    if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');

    this.actionMode = null;
    this.highlights = [{ col: u.col, row: u.row, type: 'selected' }];
    this.ui.updateUnitPanel(u, this.board.getTerrainDefBonus(u.col, u.row));
    this.ui.setActionButtons('selected', u);
    this._checkVictory();
  }

  // ── Skill ────────────────────────────────────────────────────────────────

  _onSkillButton() {
    const u = this.selectedUnit;
    if (!u || u.isEnemy || u.hasActed || u.hasWaited) return;

    this.ui.showSkillMenu(u, skill => {
      if (!skill) {
        this.ui.setActionButtons('selected', u);
        return;
      }

      // Self / buff skills (range 0 or type buff) apply immediately
      if (skill.type === 'buff' || skill.range === 0) {
        this._applySkill(u, u, skill);
        return;
      }

      this.selectedSkill = skill;
      this.actionMode = 'skill';

      const range = skill.range || 1;
      const targets = skill.type === 'attack' || (skill.effect && skill.effect !== 'trap')
        ? this.board.getEnemiesInRange(u, range)
        : this.board.getAlliesInRange(u, range);

      if (!targets.length) {
        this.ui.log(`No targets in range for ${skill.name}!`, 'system');
        this.actionMode = null;
        this.selectedSkill = null;
        this.ui.setActionButtons('selected', u);
        return;
      }

      this.highlights = [
        { col: u.col, row: u.row, type: 'selected' },
        ...targets.map(t => ({ col: t.col, row: t.row, type: 'skill' })),
      ];
      this.ui.setActionButtons('skill_targeting', u);
      this.ui.log(`Select target for ${skill.name}.`, 'system');
    });
  }

  _onSkillTile(col, row) {
    const hit = this.highlights.find(h => h.col === col && h.row === row && h.type === 'skill');
    const u = this.selectedUnit;

    if (!hit) {
      this.actionMode = null;
      this.selectedSkill = null;
      this.highlights = u ? [{ col: u.col, row: u.row, type: 'selected' }] : [];
      this.ui.setActionButtons('selected', u);
      return;
    }

    const target = this.board.getUnitAt(col, row);
    if (!target) return;

    this._applySkill(u, target, this.selectedSkill);
    this.selectedSkill = null;
  }

  _applySkill(caster, target, skill) {
    caster.hasActed = true;
    caster.hasMoved = true;

    const effect = skill.effect;

    if (skill.type === 'buff' || effect === 'attackUp' || effect === 'aimUp') {
      caster.addStatusEffect({ type: 'atk_up', name: skill.name, value: 1, duration: skill.duration || 2 });
      this.ui.log(`${caster.name} uses ${skill.name}! ATK +1 for ${skill.duration || 2} turns.`, 'heal');

    } else if (effect === 'knockback') {
      const tb = this.board.getTerrainDefBonus(target.col, target.row);
      const damage = target.takeDamage(skill.damage || caster.getEffectiveAtk(), tb);
      this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));

      // Push target away from caster
      const kb = skill.knockbackDistance || 2;
      const dc = Math.sign(target.col - caster.col);
      const dr = Math.sign(target.row - caster.row);
      for (let i = kb; i >= 1; i--) {
        const nc = target.col + dc * i;
        const nr = target.row + dr * i;
        if (this.board.isPassable(nc, nr) && !this.board.getUnitAt(nc, nr)) {
          target.col = nc; target.row = nr; break;
        }
      }
      this.ui.log(`${caster.name} uses ${skill.name} on ${target.name} for ${damage} damage! Knocked back!`, 'damage');
      if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');

    } else if (effect === 'immobilize') {
      const dmg = skill.damage || 0;
      if (dmg > 0) {
        const damage = target.takeDamageIgnoreDef(dmg);
        this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
      }
      target.addStatusEffect({ type: 'immobilize', name: 'Immobilized', value: 0, duration: skill.duration || 1 });
      this.ui.log(`${caster.name} uses ${skill.name}! ${target.name} is immobilized!`, 'damage');
      if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');

    } else if (effect === 'removeForest') {
      const tb = this.board.getTerrainDefBonus(target.col, target.row);
      const damage = target.takeDamage(skill.damage || caster.getEffectiveAtk(), tb);
      this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
      if (this.board.getTerrain(target.col, target.row) === 'f') {
        this.board.terrain[target.row][target.col] = 'g';
        this.ui.log(`${caster.name} uses ${skill.name}! Forest tile cleared!`, 'damage');
      } else {
        this.ui.log(`${caster.name} uses ${skill.name} on ${target.name} for ${damage} damage!`, 'damage');
      }
      if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');

    } else {
      // Generic attack skill (includes ranged)
      const tb = this.board.getTerrainDefBonus(target.col, target.row);
      const damage = skill.ranged
        ? target.takeDamageIgnoreDef(skill.damage || caster.getEffectiveAtk())
        : target.takeDamage(skill.damage || caster.getEffectiveAtk(), tb);
      this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
      this.ui.log(`${caster.name} uses ${skill.name} on ${target.name} for ${damage} damage!`, 'damage');
      if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');
    }

    this.actionMode = null;
    const u = caster;
    this.highlights = [{ col: u.col, row: u.row, type: 'selected' }];
    this.ui.updateUnitPanel(u, this.board.getTerrainDefBonus(u.col, u.row));
    this.ui.setActionButtons('selected', u);
    this._checkVictory();
  }

  // ── Wait / End Turn ──────────────────────────────────────────────────────

  _onWaitButton() {
    const u = this.selectedUnit;
    if (!u || u.isEnemy || u.hasWaited) return;
    u.hasWaited = true;
    this.ui.log(`${u.name} waits.`, 'info');
    this.ui.setActionButtons('selected', u);
    this._checkAutoEndTurn();
  }

  _checkAutoEndTurn() {
    const allDone = this.playerUnits.filter(u => !u.isDead).every(u => u.hasActed || u.hasWaited);
    if (allDone) setTimeout(() => this._endPlayerTurn(), 250);
  }

  _endPlayerTurn() {
    if (this.gamePhase !== 'player_turn') return;
    this.gamePhase = 'enemy_turn';
    this._deselect();
    this.ui.setActionButtons('enemy_turn');
    this.ui.updateTurnInfo(false, this.turnNumber);
    this.ui.log('── Enemy Turn ──', 'system');

    for (const u of this.playerUnits) {
      if (!u.isDead) u.tickStatusEffects();
    }

    this._runEnemyTurn();
  }

  // ── Enemy Turn ───────────────────────────────────────────────────────────

  async _runEnemyTurn() {
    const ai = new AI(this.board);
    const enemies = this.enemyUnits.filter(u => !u.isDead);

    for (const enemy of enemies) {
      await this._delay(420);
      if (this.gamePhase !== 'enemy_turn') return;

      if (enemy.hasStatusEffect('immobilize')) {
        this.ui.log(`${enemy.name} is immobilized!`, 'system');
        continue;
      }

      const action = ai.getAction(enemy);
      this._executeEnemyAction(enemy, action);

      if (this._checkDefeat()) return;
    }

    await this._delay(280);
    this._startPlayerTurn();
  }

  _executeEnemyAction(enemy, action) {
    const move = () => {
      if (action.moveTo &&
          (action.moveTo.col !== enemy.col || action.moveTo.row !== enemy.row)) {
        enemy.col = action.moveTo.col;
        enemy.row = action.moveTo.row;
      }
    };

    switch (action.type) {
      case 'move':
        move();
        this.ui.log(`${enemy.name} moves.`, 'info');
        break;
      case 'attack':
        this._enemyAttack(enemy, action.target);
        break;
      case 'move_attack':
        move();
        this._enemyAttack(enemy, action.target);
        break;
      case 'skill':
        this._enemySkill(enemy, action.skill, action.target);
        break;
      case 'move_skill':
        move();
        this._enemySkill(enemy, action.skill, action.target);
        break;
      default:
        this.ui.log(`${enemy.name} waits.`, 'info');
    }
  }

  _enemyAttack(enemy, target) {
    if (!target || target.isDead) return;
    const tb = this.board.getTerrainDefBonus(target.col, target.row);
    const damage = target.takeDamage(enemy.getEffectiveAtk(), tb);
    this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
    this.ui.log(`${enemy.name} attacks ${target.name} for ${damage} damage!`, 'damage');
    if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');
  }

  _enemySkill(enemy, skill, target) {
    if (!skill || !target || target.isDead) return;

    const effect = skill.effect;

    if (effect === 'immobilize') {
      const dmg = skill.damage || 0;
      if (dmg > 0) {
        const damage = target.takeDamageIgnoreDef(dmg);
        this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
      }
      target.addStatusEffect({ type: 'immobilize', name: 'Immobilized', value: 0, duration: skill.duration || 1 });
      this.ui.log(`${enemy.name} uses ${skill.name}! ${target.name} is immobilized!`, 'damage');
      if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');
    } else {
      const tb = this.board.getTerrainDefBonus(target.col, target.row);
      const damage = skill.ranged
        ? target.takeDamageIgnoreDef(skill.damage || enemy.getEffectiveAtk())
        : target.takeDamage(skill.damage || enemy.getEffectiveAtk(), tb);
      this.floatingNums.push(this.renderer.spawnFloatingNumber(target.col, target.row, damage));
      this.ui.log(`${enemy.name} uses ${skill.name} on ${target.name} for ${damage} damage!`, 'damage');
      if (target.isDead) this.ui.log(`${target.name} was defeated!`, 'system');
    }
  }

  _startPlayerTurn() {
    this.turnNumber++;
    this.gamePhase = 'player_turn';

    for (const u of this.playerUnits) {
      if (!u.isDead) { u.resetTurn(); u.tickStatusEffects(); }
    }
    for (const u of this.enemyUnits) u.resetTurn();

    this.ui.updateTurnInfo(true, this.turnNumber);
    this.ui.setActionButtons('idle', null);
    this.ui.log(`── Turn ${this.turnNumber}: Your Turn ──`, 'system');
  }

  // ── Victory / Defeat ─────────────────────────────────────────────────────

  _checkVictory() {
    if (this.enemyUnits.some(u => !u.isDead)) return false;

    this.gamePhase = 'game_over';
    this.ui.log('Victory! All enemies defeated!', 'system');

    const nextExists = this.currentStageIndex + 1 < this.data.campaigns[0].stages.length;

    setTimeout(() => {
      this.ui.showGameOver(
        true,
        nextExists ? () => {
          this.ui.hideGameOver();
          this.currentStageIndex++;
          this.loadStage(this.currentStageIndex);
        } : null,
        () => { this.ui.hideGameOver(); this.loadStage(this.currentStageIndex); },
        () => { this.ui.hideGameOver(); this.ui.showMainMenu(() => this.startCampaign(), () => {}); }
      );
    }, 600);
    return true;
  }

  _checkDefeat() {
    if (this.playerUnits.some(u => !u.isDead)) return false;

    this.gamePhase = 'game_over';
    this.ui.log('All units defeated...', 'system');

    setTimeout(() => {
      this.ui.showGameOver(
        false,
        null,
        () => { this.ui.hideGameOver(); this.loadStage(this.currentStageIndex); },
        () => { this.ui.hideGameOver(); this.ui.showMainMenu(() => this.startCampaign(), () => {}); }
      );
    }, 600);
    return true;
  }

  _showCampaignComplete() {
    this.gamePhase = 'game_over';
    setTimeout(() => {
      this.ui.showGameOver(
        true,
        null,
        () => { this.ui.hideGameOver(); this.startCampaign(); },
        () => { this.ui.hideGameOver(); this.ui.showMainMenu(() => this.startCampaign(), () => {}); }
      );
      const title = document.getElementById('game-over-title');
      const sub   = document.getElementById('game-over-subtitle');
      if (title) { title.textContent = 'Campaign Complete!'; title.style.color = '#7ec87e'; }
      if (sub)   sub.textContent = 'The ancient forest is defended!';
    }, 400);
  }

  // ── Game Loop ────────────────────────────────────────────────────────────

  _loop() {
    this._update();
    this._render();
    requestAnimationFrame(() => this._loop());
  }

  _update() {
    this.floatingNums = this.floatingNums.filter(fn => {
      fn.y += fn.vy;
      fn.life--;
      fn.opacity = fn.life / 55;
      return fn.life > 0;
    });
  }

  _render() {
    this.renderer.clear();
    if (!this.board) return;

    this.renderer.drawTerrain(this.board);
    this.renderer.drawHighlights(this.highlights);

    if (this.hoveredTile && this.board.isInBounds(this.hoveredTile.col, this.hoveredTile.row)) {
      const already = this.highlights.some(h => h.col === this.hoveredTile.col && h.row === this.hoveredTile.row);
      if (!already) this.renderer.drawHighlights([{ ...this.hoveredTile, type: 'hover' }]);
    }

    this.renderer.drawUnits(this.board.units);
    this.renderer.renderFloatingNumbers(this.floatingNums);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
