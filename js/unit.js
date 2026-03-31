export class Unit {
  constructor(data, isEnemy = false) {
    this.id = data.id;
    this.name = data.name;
    this.isEnemy = isEnemy;

    this.maxHp = data.maxHp || data.hp;
    this.hp = this.maxHp;
    this.atk = data.attack;
    this.def = data.defense;
    this.mov = data.movement;
    this.movementType = data.movementType;
    this.skills = data.skills || [];
    this.color = data.color;
    this.symbol = data.symbol;
    this.aiType = data.aiType || null;

    this.col = 0;
    this.row = 0;
    this.hasMoved = false;
    this.hasActed = false;
    this.hasWaited = false;
    this.statusEffects = [];
  }

  get isDead() { return this.hp <= 0; }
  get canMove() { return !this.hasMoved && !this.hasWaited && !this.isDead; }
  get canAct() { return !this.hasActed && !this.hasWaited && !this.isDead; }

  getEffectiveAtk() {
    return this.atk + this.statusEffects
      .filter(e => e.type === 'atk_up')
      .reduce((sum, e) => sum + e.value, 0);
  }

  getEffectiveDef(terrainBonus = 0) {
    return this.def + terrainBonus + this.statusEffects
      .filter(e => e.type === 'def_up')
      .reduce((sum, e) => sum + e.value, 0);
  }

  takeDamage(rawAmount, terrainBonus = 0) {
    const damage = Math.max(1, rawAmount - this.getEffectiveDef(terrainBonus));
    this.hp = Math.max(0, this.hp - damage);
    return damage;
  }

  takeDamageIgnoreDef(amount) {
    const damage = Math.max(1, amount);
    this.hp = Math.max(0, this.hp - damage);
    return damage;
  }

  heal(amount) {
    const healed = Math.min(amount, this.maxHp - this.hp);
    this.hp += healed;
    return healed;
  }

  addStatusEffect(effect) {
    this.statusEffects = this.statusEffects.filter(e => e.type !== effect.type);
    this.statusEffects.push({ ...effect });
  }

  hasStatusEffect(type) {
    return this.statusEffects.some(e => e.type === type);
  }

  tickStatusEffects() {
    this.statusEffects = this.statusEffects.filter(e => --e.duration > 0);
  }

  resetTurn() {
    this.hasMoved = false;
    this.hasActed = false;
    this.hasWaited = false;
  }
}
