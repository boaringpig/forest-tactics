import { Game } from './game.js';

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

async function main() {
  const canvas = document.getElementById('gameCanvas');

  const [campaigns, characters, enemies, stages, items] = await Promise.all([
    loadJSON('data/campaigns.json'),
    loadJSON('data/characters.json'),
    loadJSON('data/enemies.json'),
    loadJSON('data/stages.json'),
    loadJSON('data/items.json'),
  ]);

  const data = {
    campaigns:  campaigns.campaigns,
    characters: characters.units,
    enemies:    enemies.enemies,
    stages:     stages.stages,
    items:      items.items,
  };

  new Game(canvas, data);
}

main().catch(err => {
  console.error('Failed to start Forest Tactics:', err);
});
