const GRID_SIZE = 4;

let grid = [];
let score = 0;
let best = parseInt(localStorage.getItem('2048-best') || '0');
let won = false;
let keepGoing = false;
let debugMode = false;
let undoSnapshot = null;

const tilesEl = document.getElementById('tiles');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlay-title');
const boardEl = document.getElementById('board');
const debugPopup = document.getElementById('debug-popup');
const debugSelect = document.getElementById('debug-select');

// Populate debug value options
[0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192].forEach(v => {
  const opt = document.createElement('option');
  opt.value = v;
  opt.textContent = v === 0 ? 'Empty' : v;
  debugSelect.appendChild(opt);
});

function initGrid() {
  grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function emptyCell() {
  const empties = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === 0) empties.push([r, c]);
  return empties.length ? empties[Math.floor(Math.random() * empties.length)] : null;
}

function addTile() {
  const cell = emptyCell();
  if (!cell) return;
  const [r, c] = cell;
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  renderTile(r, c, grid[r][c], true);
}

function tilePos(idx) {
  return `calc(${idx * 25}% + ${idx * 3}px)`;
}

function tileFontSize(value) {
  const len = String(value).length;
  if (len <= 1) return '36px';
  if (len === 2) return '30px';
  if (len === 3) return '26px';
  if (len === 4) return '22px';
  if (len === 5) return '18px';
  if (len === 6) return '15px';
  return '12px';
}

function renderTile(r, c, value, isNew = false, isMerged = false) {
  const tile = document.createElement('div');
  tile.className = 'tile' + (isNew ? ' new' : '') + (isMerged ? ' merged' : '');
  tile.dataset.value = value;
  tile.style.top = tilePos(r);
  tile.style.left = tilePos(c);
  tile.style.fontSize = tileFontSize(value);
  tile.textContent = value;
  tilesEl.appendChild(tile);
}

function render(mergedCells = []) {
  tilesEl.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] !== 0) {
        const isMerged = mergedCells.some(([mr, mc]) => mr === r && mc === c);
        renderTile(r, c, grid[r][c], false, isMerged);
      }
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('2048-best', best);
  }
  bestEl.textContent = best;
  saveState();
}

function saveState() {
  localStorage.setItem('2048-state', JSON.stringify({ grid, score, won, keepGoing }));
}

function loadState() {
  const saved = localStorage.getItem('2048-state');
  if (!saved) return false;
  const s = JSON.parse(saved);
  grid = s.grid;
  score = s.score;
  won = s.won;
  keepGoing = s.keepGoing;
  return true;
}

// Slide a single row left, return { row, mergedAt, gained }
function slideLeft(row) {
  const nums = row.filter(x => x !== 0);
  const merged = [];
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      merged.push(i);
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < GRID_SIZE) nums.push(0);
  return { row: nums, mergedAt: merged, gained };
}

function move(direction) {
  let moved = false;
  const mergedCells = [];
  const snapshot = { grid: grid.map(r => [...r]), score, won, keepGoing };

  // Normalize: rotate grid so we always slide "left", then rotate back
  let g = rotateFor(direction);

  for (let r = 0; r < GRID_SIZE; r++) {
    const { row, mergedAt, gained } = slideLeft(g[r]);
    if (row.join() !== g[r].join()) moved = true;
    score += gained;
    mergedAt.forEach(c => mergedCells.push([r, c]));
    g[r] = row;
  }

  grid = rotateBack(direction, g);

  // Map mergedCells back through rotation
  const finalMerged = mergedCells.map(([r, c]) => rotateBackCell(direction, r, c));

  if (moved) {
    undoSnapshot = snapshot;
    document.getElementById('undo').disabled = false;
    render(finalMerged);
    addTile();
    saveState();
    checkEnd();
  }
}

// Rotate grid so that the desired direction becomes "left slide"
function rotateFor(dir) {
  const g = grid.map(r => [...r]);
  if (dir === 'left') return g;
  if (dir === 'right') return g.map(row => [...row].reverse());
  if (dir === 'up') return transpose(g);
  if (dir === 'down') return transpose(g).map(row => [...row].reverse());
}

function rotateBack(dir, g) {
  if (dir === 'left') return g;
  if (dir === 'right') return g.map(row => [...row].reverse());
  if (dir === 'up') return transpose(g);
  if (dir === 'down') return transpose(g.map(row => [...row].reverse()));
}

function rotateBackCell(dir, r, c) {
  if (dir === 'left') return [r, c];
  if (dir === 'right') return [r, GRID_SIZE - 1 - c];
  if (dir === 'up') return [c, r];
  if (dir === 'down') return [GRID_SIZE - 1 - c, r];
}

function transpose(g) {
  return g[0].map((_, c) => g.map(row => row[c]));
}

function checkEnd() {
  // Win
  if (!won && !keepGoing && grid.flat().includes(2048)) {
    won = true;
    showOverlay('You Win!', true);
    return;
  }
  // Lose
  if (!emptyCell() && !canMerge()) {
    showOverlay('Game Over!', false);
  }
}

function canMerge() {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c + 1 < GRID_SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < GRID_SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

function showOverlay(title, isWin) {
  overlayTitleEl.textContent = title;
  overlayEl.classList.remove('hidden');
  document.getElementById('keep-going').classList.toggle('hidden', !isWin);
}

function newGame() {
  score = 0;
  won = false;
  keepGoing = false;
  undoSnapshot = null;
  document.getElementById('undo').disabled = true;
  overlayEl.classList.add('hidden');
  localStorage.removeItem('2048-state');
  initGrid();
  tilesEl.innerHTML = '';
  scoreEl.textContent = 0;
  bestEl.textContent = best;
  addTile();
  addTile();
}

// Keyboard input
document.addEventListener('keydown', e => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (map[e.key]) {
    e.preventDefault();
    move(map[e.key]);
  }
});

// Touch input
let touchStartX, touchStartY;
document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
}, { passive: true });

// Debug mode
let debugTargetCell = null;

document.getElementById('debug-toggle').addEventListener('click', () => {
  debugMode = !debugMode;
  document.body.classList.toggle('debug-mode', debugMode);
  document.getElementById('debug-toggle').textContent = debugMode ? 'Debug ON' : 'Debug';
  hideDebugPopup();
});

boardEl.addEventListener('click', e => {
  if (!debugMode || overlayEl.contains(e.target) || debugPopup.contains(e.target)) return;

  const boardRect = boardEl.getBoundingClientRect();
  const x = e.clientX - boardRect.left - 12;
  const y = e.clientY - boardRect.top - 12;
  const cellW = (boardRect.width - 24) / GRID_SIZE;
  const cellH = (boardRect.height - 24) / GRID_SIZE;
  const col = Math.floor(x / cellW);
  const row = Math.floor(y / cellH);

  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;

  debugTargetCell = [row, col];
  debugSelect.value = grid[row][col];

  // Position popup near the cell, keeping it within the board
  const popupX = Math.min((col + 0.5) * cellW + 12, boardRect.width - 110);
  const popupY = Math.min((row + 1) * cellH + 12, boardRect.height - 50);
  debugPopup.style.left = popupX + 'px';
  debugPopup.style.top = popupY + 'px';
  debugPopup.classList.remove('hidden');
});

debugSelect.addEventListener('change', () => {
  if (!debugTargetCell) return;
  const [r, c] = debugTargetCell;
  grid[r][c] = parseInt(debugSelect.value);
  render();
  hideDebugPopup();
});

document.addEventListener('click', e => {
  if (!debugPopup.classList.contains('hidden') && !boardEl.contains(e.target)) {
    hideDebugPopup();
  }
});

function hideDebugPopup() {
  debugPopup.classList.add('hidden');
  debugTargetCell = null;
}

document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('try-again').addEventListener('click', newGame);
document.getElementById('keep-going').addEventListener('click', () => {
  keepGoing = true;
  overlayEl.classList.add('hidden');
});
document.getElementById('undo').addEventListener('click', () => {
  if (!undoSnapshot) return;
  ({ grid, score, won, keepGoing } = undoSnapshot);
  undoSnapshot = null;
  document.getElementById('undo').disabled = true;
  overlayEl.classList.add('hidden');
  render();
});

const darkToggle = document.getElementById('dark-toggle');
if (localStorage.getItem('2048-dark') === 'true') {
  document.body.classList.add('dark');
  darkToggle.textContent = '☀️';
}
darkToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  darkToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('2048-dark', isDark);
});

// Start — resume saved game or begin fresh
document.getElementById('undo').disabled = true;
if (loadState()) {
  render();
} else {
  newGame();
}
