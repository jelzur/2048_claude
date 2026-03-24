const GRID_SIZE = 4;

let grid = [];
let score = 0;
let best = parseInt(localStorage.getItem('2048-best') || '0');
let won = false;

const tilesEl = document.getElementById('tiles');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlay-title');

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
  return idx * (100 / GRID_SIZE) + '%';
}

function renderTile(r, c, value, isNew = false, isMerged = false) {
  const tile = document.createElement('div');
  tile.className = 'tile' + (isNew ? ' new' : '') + (isMerged ? ' merged' : '');
  tile.dataset.value = value;
  tile.style.top = tilePos(r);
  tile.style.left = tilePos(c);
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
    render(finalMerged);
    addTile();
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
  if (!won && grid.flat().includes(2048)) {
    won = true;
    showOverlay('You Win!');
    return;
  }
  // Lose
  if (!emptyCell() && !canMerge()) {
    showOverlay('Game Over!');
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

function showOverlay(title) {
  overlayTitleEl.textContent = title;
  overlayEl.classList.remove('hidden');
}

function newGame() {
  score = 0;
  won = false;
  overlayEl.classList.add('hidden');
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

document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('try-again').addEventListener('click', newGame);

// Start
newGame();
