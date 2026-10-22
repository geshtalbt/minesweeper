const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 }
};

const CELL_SIZE = 32; // px — фиксированный размер клетки
const GAP = 4;        // px — отступ между клетками
const PADDING = 4;    // px — внутренний отступ грида

let currentDifficulty = 'easy';
let ROWS = DIFFICULTIES.easy.rows;
let COLS = DIFFICULTIES.easy.cols;
let MINE_COUNT = DIFFICULTIES.easy.mines;

let grid = [];
let gameOver = false;
let firstClick = true;
let timer = 0;
let timerInterval = null;
let revealedCount = 0;

const gridEl = document.getElementById('grid');
const minesLeftEl = document.querySelector('.mines-left');
const timerEl = document.querySelector('.timer');
const newGameBtn = document.querySelector('.new-game-btn');
const diffBtns = document.querySelectorAll('.diff-btn');
const themeToggle = document.querySelector('.theme-toggle');
const paletteToggle = document.querySelector('.palette-toggle');
const paletteMenu = document.querySelector('.palette-menu');
const paletteMenuItems = document.querySelectorAll('.palette-menu-item');
const paletteDropdown = document.querySelector('.palette-dropdown');
const winModal = document.getElementById('win-modal');
const lossModal = document.getElementById('loss-modal');
const playAgainBtn = document.getElementById('play-again-btn');
const newGameModalBtn = document.getElementById('new-game-modal-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const newGameLossBtn = document.getElementById('new-game-loss-btn');
const lossCloseBtn = document.getElementById('loss-close-btn');
const safeFirstClickEl = document.getElementById('safe-first-click');
const showCatEastereggEl = document.getElementById('show-cat-easteregg');
const customCreateBtn = document.getElementById('custom-create-btn');
const customCancelBtn = document.getElementById('custom-cancel-btn');
const customRowsEl = document.getElementById('custom-rows');
const customColsEl = document.getElementById('custom-cols');
const customMinesEl = document.getElementById('custom-mines');

let safeFirstClick = true;
let showCatEasteregg = true;

function createGrid() {
  const cellWithGap = CELL_SIZE + GAP;
  const width = COLS * cellWithGap + PADDING;
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, ${CELL_SIZE}px)`;
  gridEl.style.width = `${width}px`;
  gridEl.style.maxWidth = '100%';
  gridEl.innerHTML = '';
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = {
        row: r,
        col: c,
        isMine: false,
        neighborMines: 0,
        revealed: false,
        flagged: false,
        element: null
      };
      row.push(cell);
    }
    grid.push(row);
  }
  renderGrid();
}

function renderGrid() {
  gridEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const btn = document.createElement('button');
      btn.className = 'cell';
      btn.dataset.row = r;
      btn.dataset.col = c;
      btn.setAttribute('aria-label', `Клетка ${r + 1}, ${c + 1}`);

      btn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          handleRightClick(r, c);
        } else {
          handleClick(r, c);
        }
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleRightClick(r, c);
      });
      // Mouse hold/drag to flag
      btn.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !e.shiftKey) {
          startFlagDrag(r, c, e);
        }
      });
      
      // Touch events for mobile
      btn.addEventListener('touchstart', (e) => {
        cancelTouchLongPress();
        startTouchLongPress(r, c, e);
      }, { passive: true });
      
      btn.addEventListener('touchmove', (e) => {
        handleTouchMove(e, r, c);
      }, { passive: false });
      
      btn.addEventListener('touchend', (e) => {
        handleTouchEnd(e, r, c);
      });
      
      btn.addEventListener('touchcancel', (e) => {
        cancelTouchLongPress();
      });

      cell.element = btn;
      gridEl.appendChild(btn);
    }
  }
}

function placeMines(excludeRow, excludeCol) {
  // Сначала ставим мины случайно
  let placed = 0;
  while (placed < MINE_COUNT) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    // Исключаем 3×3 область только если включен безопасный старт
    if (safeFirstClick && Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1) continue;
    if (!grid[r][c].isMine) {
      grid[r][c].isMine = true;
      placed++;
    }
  }
  calculateNeighbors();

  // Если включен безопасный старт и первый клик попал на число > 0, перемещаем мины
  if (safeFirstClick && grid[excludeRow][excludeCol].neighborMines > 0) {
    ensureZeroStart(excludeRow, excludeCol);
  }
}

function ensureZeroStart(excludeRow, excludeCol) {
  // Собираем все мины
  const mines = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) {
        mines.push({ r, c });
        grid[r][c].isMine = false;
      }
    }
  }

  // Находим безопасные позиции для мин (не в 3×3 зоне вокруг старта)
  const safePositions = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1) continue;
      safePositions.push({ r, c });
    }
  }

  // Перемешиваем и ставими мины
  for (let i = safePositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [safePositions[i], safePositions[j]] = [safePositions[j], safePositions[i]];
  }

  for (let i = 0; i < mines.length; i++) {
    const pos = safePositions[i];
    grid[pos.r][pos.c].isMine = true;
  }

  calculateNeighbors();
}

function calculateNeighbors() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].isMine) {
            count++;
          }
        }
      }
      grid[r][c].neighborMines = count;
    }
  }
}

// Mouse hold/drag flagging
let isFlagDragging = false;
let flagDragTarget = null; // 'flag' or 'unflag'
let flagDragStartCell = null;
let flagDragMoved = false;
let flagDragCompleted = false;
const DRAG_THRESHOLD = 5; // px - minimum movement to start dragging
let flagDragStartX = 0;
let flagDragStartY = 0;

// Touch long-press and drag flagging
let touchTimer = null;
let touchCell = null;
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
let isTouchFlagDragging = false;
let touchFlagDragTarget = null;
const LONG_PRESS_DELAY = 500; // ms
const TOUCH_MOVE_THRESHOLD = 10; // px - movement to cancel long press

function startFlagDrag(r, c, e) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.revealed) return;
  
  // Determine action based on current state
  flagDragTarget = cell.flagged ? 'unflag' : 'flag';
  isFlagDragging = true;
  flagDragStartCell = { r, c };
  flagDragMoved = false;
  flagDragCompleted = false;
  
  // Store initial mouse position for drag threshold
  flagDragStartX = e.clientX;
  flagDragStartY = e.clientY;
  
  // Prevent text selection during drag
  e.preventDefault();
  
  // Add global listeners for drag
  document.addEventListener('mousemove', handleFlagDragMove);
  document.addEventListener('mouseup', handleFlagDragEnd);
}


function startTouchLongPress(r, c, e) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.revealed) return;
  
  const touch = e.touches[0];
  touchCell = { r, c };
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchMoved = false;
  
  touchTimer = setTimeout(() => {
    if (touchCell && touchCell.r === r && touchCell.c === c && !touchMoved) {
      // Long press detected - start touch drag flagging
      isTouchFlagDragging = true;
      touchFlagDragTarget = cell.flagged ? 'unflag' : 'flag';
      touchCell = null;
      
      // Visual feedback for long press
      cell.element.classList.add('touch-press');
      
      // Apply immediately to the starting cell
      if (touchFlagDragTarget === 'flag') {
        cell.flagged = true;
      } else {
        cell.flagged = false;
      }
      updateCellDisplay(cell);
      updateMinesLeft();
      
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
    touchTimer = null;
  }, LONG_PRESS_DELAY);
}

function handleTouchMove(e, startR, startC) {
  if (isTouchFlagDragging) {
    // Drag mode - apply flags to cells under finger
    e.preventDefault();
    
    const touch = e.touches[0];
    const cellEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!cellEl || !cellEl.classList.contains('cell')) return;
    
    const r = parseInt(cellEl.dataset.row);
    const c = parseInt(cellEl.dataset.col);
    const cell = grid[r][c];
    
    if (cell.revealed) return;
    
    // Apply flag/unflag based on initial action
    if (touchFlagDragTarget === 'flag' && !cell.flagged) {
      cell.flagged = true;
      updateCellDisplay(cell);
      updateMinesLeft();
    } else if (touchFlagDragTarget === 'unflag' && cell.flagged) {
      cell.flagged = false;
      updateCellDisplay(cell);
      updateMinesLeft();
    }
    return;
  }
  
  // Check if finger moved too much - cancel long press
  if (touchCell && touchTimer) {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);
    
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
      touchMoved = true;
      cancelTouchLongPress();
    }
  }
}

function handleTouchEnd(e, r, c) {
  // If we were in drag mode, just end it
  if (isTouchFlagDragging) {
    isTouchFlagDragging = false;
    touchFlagDragTarget = null;
    // Remove touch-press class from all cells
    document.querySelectorAll('.cell.touch-press').forEach(el => {
      el.classList.remove('touch-press');
    });
    cancelTouchLongPress();
    return;
  }
  
  // If long press didn't trigger and finger didn't move much - treat as click
  if (touchCell && touchCell.r === r && touchCell.c === c && !touchMoved) {
    const cell = grid[r][c];
    // Manually trigger click behavior
    handleClick(r, c);
  }
  
  cancelTouchLongPress();
}

function cancelTouchLongPress() {
  if (touchTimer) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
  touchCell = null;
  touchMoved = false;
  // Remove touch-press class from all cells
  document.querySelectorAll('.cell.touch-press').forEach(el => {
    el.classList.remove('touch-press');
  });
}

function handleFlagDragMove(e) {
  if (!isFlagDragging) return;
  
  // Check if mouse has moved enough to start dragging
  const dx = Math.abs(e.clientX - flagDragStartX);
  const dy = Math.abs(e.clientY - flagDragStartY);
  
  if (!flagDragMoved && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
    flagDragMoved = true;
    // Apply flag to starting cell only when drag actually starts
    const startCell = grid[flagDragStartCell.r][flagDragStartCell.c];
    if (!startCell.revealed) {
      if (flagDragTarget === 'flag') {
        startCell.flagged = true;
      } else {
        startCell.flagged = false;
      }
      updateCellDisplay(startCell);
      updateMinesLeft();
    }
  }
  
  if (!flagDragMoved) return;
  
  // Find cell under mouse
  const cellEl = document.elementFromPoint(e.clientX, e.clientY);
  if (!cellEl || !cellEl.classList.contains('cell')) return;
  
  const r = parseInt(cellEl.dataset.row);
  const c = parseInt(cellEl.dataset.col);
  const cell = grid[r][c];
  
  if (cell.revealed) return;
  
  // Apply flag/unflag based on initial action
  if (flagDragTarget === 'flag' && !cell.flagged) {
    cell.flagged = true;
    updateCellDisplay(cell);
    updateMinesLeft();
  } else if (flagDragTarget === 'unflag' && cell.flagged) {
    cell.flagged = false;
    updateCellDisplay(cell);
    updateMinesLeft();
  }
}

function handleFlagDragEnd() {
  flagDragCompleted = flagDragMoved;
  isFlagDragging = false;
  flagDragTarget = null;
  flagDragStartCell = null;
  flagDragMoved = false;
  document.removeEventListener('mousemove', handleFlagDragMove);
  document.removeEventListener('mouseup', handleFlagDragEnd);
  // Also clean up touch drag
  isTouchFlagDragging = false;
  touchFlagDragTarget = null;
}

document.addEventListener('mousemove', handleFlagDragMove);
document.addEventListener('mouseup', handleFlagDragEnd);

function handleClick(r, c) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.flagged) return;

  // Prevent click from registering after a drag (but allow click after just mousedown without move)
  if (flagDragCompleted) {
    // Drag happened, don't process click - the drag already handled flags
    flagDragCompleted = false; // Reset for next time
    return;
  }

  // Prevent click from registering after a long press/touch drag
  if (cell._touchHandled) {
    cell._touchHandled = false;
    return;
  }

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    startTimer();
  }

  // Если клетка уже открыта и имеет число — chord click (открыть соседей при правильных флагах)
  if (cell.revealed && cell.neighborMines > 0) {
    chordClick(r, c);
  } else {
    reveal(r, c);
  }
  checkWin();
}

function handleRightClick(r, c) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  updateCellDisplay(cell);
  updateMinesLeft();
}

function reveal(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  revealedCount++;
  updateCellDisplay(cell);

  if (cell.isMine) {
    gameOver = true;
    stopTimer();
    revealAllMines();
    setTimeout(() => showLossModal(), 100);
    return;
  }

  if (cell.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        reveal(r + dr, c + dc);
      }
    }
  }
}

function chordClick(r, c) {
  const cell = grid[r][c];
  if (!cell.revealed || cell.neighborMines === 0) return;

  // Считаем флажки вокруг
  let flaggedCount = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].flagged) {
        flaggedCount++;
      }
    }
  }

  // Если флажков ровно столько, сколько мин вокруг — открываем неоткрытые соседи
  if (flaggedCount === cell.neighborMines) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const neighbor = grid[nr][nc];
          if (!neighbor.revealed && !neighbor.flagged) {
            reveal(nr, nc);
          }
        }
      }
    }
  }
}

function updateCellDisplay(cell) {
  const btn = cell.element;
  const isCorrectFlag = btn.classList.contains('correct-flag');
  btn.classList.remove('revealed', 'flagged', 'mine', 'number-1', 'number-2', 'number-3', 'number-4', 'number-5', 'number-6', 'number-7', 'number-8');
  btn.textContent = '';

  if (cell.flagged) {
    btn.classList.add('flagged');
    if (isCorrectFlag) {
      btn.classList.add('correct-flag');
    }
    return;
  }

  if (cell.revealed) {
    btn.classList.add('revealed');
    if (cell.isMine) {
      btn.classList.add('mine');
    } else if (cell.neighborMines > 0) {
      btn.textContent = cell.neighborMines;
      btn.classList.add(`number-${cell.neighborMines}`);
    }
  }
}

function revealAllMines() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.isMine && !cell.revealed) {
        cell.revealed = true;
        updateCellDisplay(cell);
      }
    }
  }
  // Highlight correctly flagged mines
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.isMine && cell.flagged) {
        cell.element.classList.add('correct-flag');
      }
    }
  }
}

function checkWin() {
  if (revealedCount === ROWS * COLS - MINE_COUNT) {
    gameOver = true;
    stopTimer();
    flagAllMines();
    setTimeout(() => {
      showWinModal();
    }, 100);
  }
}

function showWinModal() {
  const modal = document.getElementById('win-modal');
  const timeEl = document.getElementById('win-time');
  const diffEl = document.getElementById('win-difficulty');

  // Format timer
  const mins = String(Math.floor(timer / 60)).padStart(2, '0');
  const secs = String(timer % 60).padStart(2, '0');
  timeEl.textContent = `${mins}:${secs}`;

  diffEl.textContent = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);

  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('visible');
}

function showLossModal() {
  const modal = document.getElementById('loss-modal');
  const timeEl = document.getElementById('loss-time');
  const diffEl = document.getElementById('loss-difficulty');
  const catEl = document.getElementById('easter-egg-cat');

  const mins = String(Math.floor(timer / 60)).padStart(2, '0');
  const secs = String(timer % 60).padStart(2, '0');
  timeEl.textContent = `${mins}:${secs}`;

  diffEl.textContent = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);

  // Easter egg: show cat if player clicked on a mine on first click
  if (showCatEasteregg && revealedCount <= 1) {
    catEl.style.display = 'block';
    catEl.innerHTML = `
      <div class="cat-container">
        <div class="cat-face">
          <div class="cat-ear left"></div>
          <div class="cat-ear right"></div>
          <div class="cat-eyes">
            <div class="cat-eye left"></div>
            <div class="cat-eye right"></div>
          </div>
          <div class="cat-nose"></div>
          <div class="cat-mouth"></div>
          <div class="cat-whiskers left"></div>
          <div class="cat-whiskers right"></div>
        </div>
        <div class="cat-message">Мяу! 🐱</div>
        <div class="cat-hint">Ты нажал на мину с первого клика... Котик тебя утешает!</div>
      </div>
    `;
  } else {
    catEl.style.display = 'none';
  }

  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('visible');
}

function flagAllMines() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.isMine && !cell.flagged) {
        cell.flagged = true;
        updateCellDisplay(cell);
      }
    }
  }
  updateMinesLeft();
}

function updateMinesLeft() {
  const flagged = grid.flat().filter(c => c.flagged).length;
  minesLeftEl.textContent = `Мины: ${MINE_COUNT - flagged}`;
}

function startTimer() {
  timer = 0;
  timerInterval = setInterval(() => {
    timer++;
    const mins = String(Math.floor(timer / 60)).padStart(2, '0');
    const secs = String(timer % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function setDifficulty(diff) {
  currentDifficulty = diff;
  ROWS = DIFFICULTIES[diff].rows;
  COLS = DIFFICULTIES[diff].cols;
  MINE_COUNT = DIFFICULTIES[diff].mines;

  diffBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.difficulty === diff);
  });

  newGame();
}

function newGame() {
  gameOver = false;
  firstClick = true;
  revealedCount = 0;
  stopTimer();
  timer = 0;
  timerEl.textContent = '00:00';

  // Hide win modal if open
  const modal = document.getElementById('win-modal');
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');

  createGrid();
  updateMinesLeft();
}

function initTheme() {
  const saved = localStorage.getItem('ms-theme');
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.className = dark ? 'theme-dark' : 'theme-light';
  themeToggle.setAttribute('aria-checked', String(dark));
  themeToggle.textContent = dark ? '☀️' : '🌓';

  const savedPalette = localStorage.getItem('ms-palette') || 'orange';
  document.body.dataset.palette = savedPalette;
  updatePaletteUI(savedPalette);

  // Load settings
  const savedSafeClick = localStorage.getItem('ms-safe-first-click');
  if (savedSafeClick !== null) {
    safeFirstClick = savedSafeClick === 'true';
    safeFirstClickEl.checked = safeFirstClick;
  }

  const savedCatEasteregg = localStorage.getItem('ms-show-cat-easteregg');
  if (savedCatEasteregg !== null) {
    showCatEasteregg = savedCatEasteregg === 'true';
    showCatEastereggEl.checked = showCatEasteregg;
  }

  // Load custom difficulty settings
  const savedCustomRows = localStorage.getItem('ms-custom-rows');
  const savedCustomCols = localStorage.getItem('ms-custom-cols');
  const savedCustomMines = localStorage.getItem('ms-custom-mines');
  if (savedCustomRows !== null) customRowsEl.value = savedCustomRows;
  if (savedCustomCols !== null) customColsEl.value = savedCustomCols;
  if (savedCustomMines !== null) customMinesEl.value = savedCustomMines;
}

function updatePaletteUI(palette) {
  const preview = paletteToggle.querySelector('.palette-toggle-preview');
  if (preview) {
    preview.style.setProperty('--palette-color', getComputedStyle(document.documentElement).getPropertyValue(`--palette-${palette}`).trim());
  }
  paletteMenuItems.forEach(item => {
    item.classList.toggle('active', item.dataset.palette === palette);
  });
  paletteDropdown.classList.remove('open');
  paletteToggle.setAttribute('aria-expanded', 'false');
}

function setPalette(palette) {
  document.body.dataset.palette = palette;
  localStorage.setItem('ms-palette', palette);
  updatePaletteUI(palette);
}

themeToggle.addEventListener('click', () => {
  const dark = document.body.classList.toggle('theme-dark');
  document.body.classList.toggle('theme-light', !dark);
  themeToggle.setAttribute('aria-checked', String(dark));
  themeToggle.textContent = dark ? '☀️' : '🌓';
  localStorage.setItem('ms-theme', dark ? 'dark' : 'light');
});

paletteToggle.addEventListener('click', () => {
  const isOpen = paletteDropdown.classList.toggle('open');
  paletteToggle.setAttribute('aria-expanded', String(isOpen));
});

paletteMenuItems.forEach(item => {
  item.addEventListener('click', () => setPalette(item.dataset.palette));
});

document.addEventListener('click', (e) => {
  if (!paletteDropdown.contains(e.target)) {
    paletteDropdown.classList.remove('open');
    paletteToggle.setAttribute('aria-expanded', 'false');
  }
});

newGameBtn.addEventListener('click', newGame);

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
});

const customDiffBtn = document.querySelector('[data-difficulty="custom"]');
if (customDiffBtn) {
  customDiffBtn.addEventListener('click', () => {
    const modal = document.getElementById('custom-modal');
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('visible');
  });
}

customCreateBtn.addEventListener('click', () => {
  const rows = parseInt(customRowsEl.value) || 9;
  const cols = parseInt(customColsEl.value) || 9;
  const mines = parseInt(customMinesEl.value) || 10;
  
  if (rows < 1 || rows > 50 || cols < 1 || cols > 50) {
    alert('Строки и столбцы: от 1 до 50');
    return;
  }
  
  if (mines < 1 || mines > rows * cols) {
    alert(`Мины: от 1 до ${rows * cols}`);
    return;
  }
  
  currentDifficulty = 'custom';
  ROWS = rows;
  COLS = cols;
  MINE_COUNT = mines;
  
  diffBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.difficulty === 'custom');
  });
  
  newGame();
  
  const modal = document.getElementById('custom-modal');
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('visible');
});

customCancelBtn.addEventListener('click', () => {
  const modal = document.getElementById('custom-modal');
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('visible');
});

playAgainBtn.addEventListener('click', () => {
  winModal.classList.remove('visible');
  winModal.setAttribute('aria-hidden', 'true');
  newGame();
});

tryAgainBtn.addEventListener('click', () => {
  lossModal.classList.remove('visible');
  lossModal.setAttribute('aria-hidden', 'true');
  newGame();
});

newGameModalBtn.addEventListener('click', () => {
  winModal.classList.remove('visible');
  winModal.setAttribute('aria-hidden', 'true');
  newGame();
});

newGameLossBtn.addEventListener('click', () => {
  lossModal.classList.remove('visible');
  lossModal.setAttribute('aria-hidden', 'true');
  newGame();
});

lossCloseBtn.addEventListener('click', () => {
  lossModal.classList.remove('visible');
  lossModal.setAttribute('aria-hidden', 'true');
});

safeFirstClickEl.addEventListener('change', () => {
  safeFirstClick = safeFirstClickEl.checked;
  localStorage.setItem('ms-safe-first-click', String(safeFirstClick));
});

showCatEastereggEl.addEventListener('change', () => {
  showCatEasteregg = showCatEastereggEl.checked;
  localStorage.setItem('ms-show-cat-easteregg', String(showCatEasteregg));
});

// Save custom settings
customRowsEl.addEventListener('change', () => {
  localStorage.setItem('ms-custom-rows', customRowsEl.value);
});

customColsEl.addEventListener('change', () => {
  localStorage.setItem('ms-custom-cols', customColsEl.value);
});

customMinesEl.addEventListener('change', () => {
  localStorage.setItem('ms-custom-mines', customMinesEl.value);
});

createGrid();
updateMinesLeft();
initTheme();