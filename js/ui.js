export class UI {
  constructor() {
    this.els = {
      unitPanel:        document.getElementById('unit-panel'),
      unitPanelName:    document.getElementById('unit-panel-name'),
      unitPanelBody:    document.getElementById('unit-panel-body'),
      actionMenu:       document.getElementById('action-menu'),
      skillMenu:        document.getElementById('skill-menu'),
      actionLog:        document.getElementById('action-log'),
      turnIndicator:    document.getElementById('turn-indicator'),
      turnCounter:      document.getElementById('turn-counter'),
      tooltip:          document.getElementById('tooltip'),
      gameOverOverlay:  document.getElementById('game-over-overlay'),
      gameOverTitle:    document.getElementById('game-over-title'),
      gameOverSubtitle: document.getElementById('game-over-subtitle'),
      mainMenuOverlay:  document.getElementById('main-menu-overlay'),
      howtoOverlay:     document.getElementById('howto-overlay'),
      btnMove:          document.getElementById('btn-move'),
      btnAttack:        document.getElementById('btn-attack'),
      btnSkill:         document.getElementById('btn-skill'),
      btnWait:          document.getElementById('btn-wait'),
      btnEndTurn:       document.getElementById('btn-end-turn'),
      btnNextStage:     document.getElementById('btn-next-stage'),
      btnRestart:       document.getElementById('btn-restart'),
      btnMainMenu:      document.getElementById('btn-main-menu'),
      btnStartCampaign: document.getElementById('btn-start-campaign'),
      btnHowToPlay:     document.getElementById('btn-how-to-play'),
      btnCloseHowTo:    document.getElementById('btn-close-howto'),
    };
  }

  updateUnitPanel(unit, terrainBonus = 0) {
    const { unitPanelName, unitPanelBody } = this.els;
    if (!unit) {
      if (unitPanelName) unitPanelName.textContent = 'Select a unit';
      if (unitPanelBody) unitPanelBody.innerHTML = '';
      return;
    }

    const hpRatio = unit.hp / unit.maxHp;
    const hpColor = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#f44336';
    const defBonus = terrainBonus > 0 ? ` <small style="color:#7ec87e">(+${terrainBonus} forest)</small>` : '';

    if (unitPanelName) {
      unitPanelName.textContent = unit.name;
      unitPanelName.style.color = unit.isEnemy ? '#e07070' : '#a0d0a0';
    }

    const statusHTML = unit.statusEffects.length
      ? `<div style="margin-top:6px">${unit.statusEffects.map(e =>
          `<span class="status-tag">${e.name} (${e.duration})</span>`).join(' ')}</div>`
      : '';

    const skillsHTML = unit.skills.map(s =>
      `<div class="skill-item">${s.name} <small style="color:#7ec8e3">r:${s.range}</small></div>`
    ).join('');

    if (unitPanelBody) {
      unitPanelBody.innerHTML = `
        <div class="stat-row"><span>HP</span><span>${unit.hp}/${unit.maxHp}</span></div>
        <div class="hp-bar">
          <div class="hp-bar-fill" style="width:${Math.round(hpRatio * 100)}%;background:${hpColor}"></div>
        </div>
        <div class="stat-row"><span>ATK</span><span>${unit.getEffectiveAtk()}</span></div>
        <div class="stat-row"><span>DEF</span><span>${unit.getEffectiveDef(terrainBonus)}${defBonus}</span></div>
        <div class="stat-row"><span>MOV</span><span>${unit.mov}</span></div>
        ${statusHTML}
        <div style="margin-top:8px;font-size:11px;color:#7ec8e3;text-transform:uppercase;letter-spacing:1px">Skills</div>
        <div class="skills-list">${skillsHTML}</div>
      `;
    }
  }

  setActionButtons(state, unit = null) {
    const { btnMove, btnAttack, btnSkill, btnWait, btnEndTurn, actionMenu } = this.els;
    if (!actionMenu) return;

    actionMenu.style.display = 'flex';

    if (state === 'enemy_turn') {
      [btnMove, btnAttack, btnSkill, btnWait, btnEndTurn].forEach(b => b && (b.disabled = true));
      return;
    }

    if (!unit || unit.isEnemy) {
      [btnMove, btnAttack, btnSkill, btnWait].forEach(b => b && (b.disabled = true));
      if (btnEndTurn) btnEndTurn.disabled = false;
      return;
    }

    if (btnMove)    btnMove.disabled    = unit.hasMoved   || unit.hasWaited;
    if (btnAttack)  btnAttack.disabled  = unit.hasActed   || unit.hasWaited;
    if (btnSkill)   btnSkill.disabled   = unit.hasActed   || unit.hasWaited;
    if (btnWait)    btnWait.disabled    = unit.hasWaited;
    if (btnEndTurn) btnEndTurn.disabled = false;

    if (state === 'moving') {
      [btnAttack, btnSkill, btnWait].forEach(b => b && (b.disabled = true));
    }
    if (state === 'attacking' || state === 'skill_targeting') {
      [btnMove, btnAttack, btnSkill, btnWait].forEach(b => b && (b.disabled = true));
    }
  }

  showSkillMenu(unit, onSelect) {
    const { skillMenu } = this.els;
    if (!skillMenu) return;
    skillMenu.innerHTML = '';
    skillMenu.style.display = 'flex';

    for (const skill of unit.skills) {
      const btn = document.createElement('button');
      btn.className = 'skill-btn';
      btn.textContent = skill.name;
      btn.onclick = () => { this.hideSkillMenu(); onSelect(skill); };
      skillMenu.appendChild(btn);
    }

    const cancel = document.createElement('button');
    cancel.className = 'skill-btn';
    cancel.style.opacity = '0.7';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => { this.hideSkillMenu(); onSelect(null); };
    skillMenu.appendChild(cancel);
  }

  hideSkillMenu() {
    const { skillMenu } = this.els;
    if (skillMenu) {
      skillMenu.style.display = 'none';
      skillMenu.innerHTML = '';
    }
  }

  log(msg, type = 'info') {
    const { actionLog } = this.els;
    if (!actionLog) return;
    const p = document.createElement('p');
    p.className = type === 'info' ? 'log-entry' : `log-entry ${type}`;
    p.style.cssText = 'margin:2px 0;padding:1px 0';
    p.textContent = msg;
    actionLog.appendChild(p);
    actionLog.scrollTop = actionLog.scrollHeight;
    const entries = actionLog.children;
    if (entries.length > 30) entries[0].remove();
  }

  updateTurnInfo(isPlayer, turnNum) {
    const { turnIndicator, turnCounter } = this.els;
    if (turnIndicator) {
      turnIndicator.textContent = isPlayer ? 'Player Turn' : 'Enemy Turn';
      turnIndicator.className = isPlayer ? 'player-turn' : 'enemy-turn';
    }
    if (turnCounter) turnCounter.textContent = `Turn ${turnNum}`;
  }

  showGameOver(victory, onNext, onRestart, onMenu) {
    const { gameOverOverlay, gameOverTitle, gameOverSubtitle, btnNextStage, btnRestart, btnMainMenu } = this.els;
    if (!gameOverOverlay) return;
    gameOverOverlay.style.display = 'flex';

    if (gameOverTitle) {
      gameOverTitle.textContent = victory ? 'Victory!' : 'Defeat';
      gameOverTitle.style.color = victory ? '#7ec87e' : '#e07070';
    }
    if (gameOverSubtitle) {
      gameOverSubtitle.textContent = victory
        ? 'The forest is safe... for now.'
        : 'The forest falls to the humans...';
    }

    if (btnNextStage) {
      btnNextStage.style.display = victory && onNext ? 'inline-block' : 'none';
      btnNextStage.onclick = onNext || null;
    }
    if (btnRestart) btnRestart.onclick = onRestart;
    if (btnMainMenu) btnMainMenu.onclick = onMenu;
  }

  hideGameOver() {
    if (this.els.gameOverOverlay) this.els.gameOverOverlay.style.display = 'none';
  }

  showMainMenu(onStart, onHowTo) {
    const { mainMenuOverlay, btnStartCampaign, btnHowToPlay, howtoOverlay, btnCloseHowTo } = this.els;
    if (mainMenuOverlay) mainMenuOverlay.style.display = 'flex';
    if (btnStartCampaign) btnStartCampaign.onclick = () => { this.hideMainMenu(); onStart(); };
    if (btnHowToPlay) btnHowToPlay.onclick = () => { if (howtoOverlay) howtoOverlay.style.display = 'flex'; };
    if (btnCloseHowTo) btnCloseHowTo.onclick = () => { if (howtoOverlay) howtoOverlay.style.display = 'none'; };
  }

  hideMainMenu() {
    if (this.els.mainMenuOverlay) this.els.mainMenuOverlay.style.display = 'none';
  }

  showTooltip(text, clientX, clientY) {
    const { tooltip } = this.els;
    if (!tooltip) return;
    tooltip.style.display = 'block';
    tooltip.style.left = `${clientX + 14}px`;
    tooltip.style.top  = `${clientY + 14}px`;
    tooltip.textContent = text;
  }

  hideTooltip() {
    if (this.els.tooltip) this.els.tooltip.style.display = 'none';
  }
}
