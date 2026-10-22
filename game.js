(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const el = {
    score: document.getElementById('score'),
    level: document.getElementById('level'),
    lives: document.getElementById('lives'),
    buffs: document.getElementById('buffs'),
    combo: document.getElementById('combo'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    overlayBtn: document.getElementById('overlayBtn'),
    btnPause: document.getElementById('btnPause'),
    btnMute: document.getElementById('btnMute'),
    stage: document.querySelector('.stage'),
  };

  const MAX_LEVEL = 6;
  const GRID = { cols: 72, rows: 48, marginX: 16, top: 40, gap: 1, h: 9 };
  const BW = (W - 2 * GRID.marginX - (GRID.cols - 1) * GRID.gap) / GRID.cols;
  const STEPX = BW + GRID.gap;
  const STEPY = GRID.h + GRID.gap;
  const FIELD_W = GRID.cols * STEPX - GRID.gap;
  const FIELD_H = GRID.rows * STEPY - GRID.gap;
  const FIELD_CX = GRID.marginX + FIELD_W / 2;
  const FIELD_CY = GRID.top + FIELD_H / 2;
  const STEEL_COLOR = '#a8bfd0';
  const PADDLE = { baseW: 130, h: 12, y: H - 46, speed: 950 };
  const BALL_R = 4;
  const MAX_BALLS = 60;
  const MAX_PARTICLES = 900;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt;
      g += (255 - g) * amt;
      b += (255 - b) * amt;
    } else {
      r *= 1 + amt;
      g *= 1 + amt;
      b *= 1 + amt;
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  const THEMES = [
    { base: '#2946d6', accent: '#a9c4ff', glow: 'rgba(41,70,214,0.18)' },
    { base: '#25c7e8', accent: '#a8f4ff', glow: 'rgba(37,199,232,0.16)' },
    { base: '#f0459e', accent: '#ffb3df', glow: 'rgba(240,69,158,0.16)' },
    { base: '#5fd44a', accent: '#d5ffb3', glow: 'rgba(95,212,74,0.16)' },
    { base: '#ff8a2b', accent: '#ffd45e', glow: 'rgba(255,138,43,0.16)' },
    { base: '#9a6bff', accent: '#e0cfff', glow: 'rgba(154,107,255,0.16)' },
  ];

  const POWER_DEFS = {
    multi: { color: '#4be08a', label: 'M', name: 'MULTI', weight: 30 },
    crazy: { color: '#ff4fd8', label: 'X', name: 'CRAZY', weight: 14 },
    wide: { color: '#56b8ff', label: 'W', name: 'WIDE', weight: 16 },
    slow: { color: '#6ff0e0', label: 'S', name: 'SLOW', weight: 14 },
    sticky: { color: '#c78bff', label: 'C', name: 'STICKY', weight: 10 },
    life: { color: '#ff5f7a', label: '+', name: 'LIFE', weight: 8 },
  };
  const POWER_KEYS = Object.keys(POWER_DEFS);
  const POWER_TOTAL = POWER_KEYS.reduce((s, k) => s + POWER_DEFS[k].weight, 0);

  const state = {
    mode: 'menu',
    prevMode: 'playing',
    score: 0,
    lives: 5,
    level: 1,
    combo: 0,
    comboTimer: 0,
    grid: [],
    destructible: 0,
    barrierRow: 32,
    mazeCells: new Set(),
    vaultOpened: false,
    theme: THEMES[0],
    corridors: [],
    walls: [],
    balls: [],
    powerups: [],
    lasers: [],
    particles: [],
    texts: [],
    buffs: { wide: 0, slow: 0, laser: 0, sticky: 0, fire: 0, bomb: 0 },
    paddle: { cx: W / 2, w: PADDLE.baseW, h: PADDLE.h, y: PADDLE.y },
    laserCooldown: 0,
    shake: 0,
    brickDirty: true,
  };

  const brickLayer = document.createElement('canvas');
  brickLayer.width = W;
  brickLayer.height = H;
  const bctx = brickLayer.getContext('2d');

  let lastCanvasKey = '';

  function resizeCanvas() {
    const stage = el.stage;
    if (!stage || !stage.clientWidth || !stage.clientHeight) return;
    const fit = Math.min(stage.clientWidth / W, stage.clientHeight / H);
    const cssW = Math.max(320, Math.round(W * fit));
    const cssH = Math.max(213, Math.round(H * fit));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = cssW + 'x' + cssH + '@' + dpr;
    if (key === lastCanvasKey) return;
    lastCanvasKey = key;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    brickLayer.width = canvas.width;
    brickLayer.height = canvas.height;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    bctx.setTransform(brickLayer.width / W, 0, 0, brickLayer.height / H, 0, 0);
    state.brickDirty = true;
  }

  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.4 + 0.3,
    a: Math.random() * 0.4 + 0.08,
    tw: Math.random() * Math.PI * 2,
  }));

  let overlayAction = () => {};
  let muted = localStorage.getItem('bb-muted') === '1';
  let audio = null;
  let music = null;
  let musicWanted = false;
  let musicIndex = -1;
  const MUSIC_VOLUME = 0.3;
  const MUSIC_TRACKS = [
    'assets/neon-gaming.mp3',
    'assets/shades-of-city.mp3',
    'assets/synthwave.mp3',
  ];
  const keys = new Set();
  const lastSound = {};
  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  let lastCombo = '';

  function sound(name) {
    if (muted) return;
    const now = performance.now();
    if (lastSound[name] && now - lastSound[name] < 40) return;
    lastSound[name] = now;
    try {
      if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio = new AC();
      }
      if (audio.state === 'suspended') audio.resume();
      const cfg = {
        bounce: [430, 310, 'square', 0.04, 0.03],
        hit: [300, 250, 'square', 0.03, 0.025],
        break: [720, 1080, 'triangle', 0.06, 0.045],
        launch: [460, 820, 'sine', 0.08, 0.06],
        power: [520, 1120, 'sine', 0.16, 0.08],
        life: [660, 1180, 'sine', 0.2, 0.08],
        laser: [1000, 380, 'square', 0.04, 0.02],
        steel: [190, 150, 'square', 0.05, 0.04],
        boom: [170, 38, 'sawtooth', 0.32, 0.09],
        level: [520, 1320, 'triangle', 0.32, 0.08],
        over: [320, 70, 'sawtooth', 0.5, 0.08],
      }[name];
      if (!cfg) return;
      const [f0, f1, type, dur, vol] = cfg;
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (err) {
      audio = null;
    }
  }

  function ensureMusic() {
    if (!music) {
      music = new Audio();
      music.preload = 'auto';
      music.volume = MUSIC_VOLUME;
      music.addEventListener('ended', () => {
        if (!musicWanted) return;
        musicIndex = (musicIndex + 1) % MUSIC_TRACKS.length;
        music.src = MUSIC_TRACKS[musicIndex];
        if (!muted) {
          const p = music.play();
          if (p && p.catch) p.catch(() => {});
        }
      });
    }
    if (!music.src) {
      musicIndex = musicIndex < 0 ? 0 : musicIndex;
      music.src = MUSIC_TRACKS[musicIndex];
    }
    return music;
  }

  function playMusic(advance) {
    musicWanted = true;
    if (advance) {
      musicIndex = (musicIndex + 1) % MUSIC_TRACKS.length;
      if (music) music.src = MUSIC_TRACKS[musicIndex];
    }
    if (muted) return;
    const m = ensureMusic();
    if (m.paused) {
      const p = m.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function pauseMusic() {
    if (music) music.pause();
  }

  function applyMute() {
    el.btnMute.classList.toggle('off', muted);
    if (muted) {
      if (music) music.pause();
    } else if (musicWanted) {
      playMusic();
    }
  }

  function syncHud() {
    if (state.score !== lastScore) {
      lastScore = state.score;
      el.score.textContent = state.score;
    }
    if (state.lives !== lastLives) {
      lastLives = state.lives;
      el.lives.textContent = state.lives;
    }
    if (state.level !== lastLevel) {
      lastLevel = state.level;
      el.level.textContent = state.level;
    }
  }

  function comboMult() {
    return Math.min(25, 1 + Math.floor(state.combo / 4));
  }

  function syncCombo() {
    const mult = comboMult();
    const txt = state.combo >= 3 ? `COMBO x${mult}` : '';
    if (txt !== lastCombo) {
      lastCombo = txt;
      if (txt) {
        el.combo.hidden = false;
        el.combo.textContent = txt;
      } else {
        el.combo.hidden = true;
      }
    }
    el.combo.classList.toggle('hot', state.combo >= 12);
  }

  function registerCombo() {
    state.combo++;
    state.comboTimer = 1.6;
  }

  function addBrickScore(base) {
    state.score += base * comboMult();
  }

  function showOverlay(title, text, btn, action) {
    el.overlayTitle.textContent = title;
    el.overlayText.textContent = text;
    el.overlayBtn.textContent = btn;
    overlayAction = action;
    el.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    el.overlay.classList.add('hidden');
  }

  function resetBuffs() {
    for (const k in state.buffs) state.buffs[k] = 0;
    state.laserCooldown = 0;
    state.combo = 0;
    state.comboTimer = 0;
    renderBuffs();
  }

  function renderBuffs() {
    const b = state.buffs;
    const parts = [];
    if (b.wide > 0) parts.push(`<span class="buff wide">WIDE ${Math.ceil(b.wide)}s</span>`);
    if (b.slow > 0) parts.push(`<span class="buff slow">SLOW ${Math.ceil(b.slow)}s</span>`);
    if (b.laser > 0) parts.push(`<span class="buff laser">LASER ${Math.ceil(b.laser)}s</span>`);
    if (b.sticky > 0) parts.push(`<span class="buff sticky">STICKY ${Math.ceil(b.sticky)}s</span>`);
    if (b.fire > 0) parts.push(`<span class="buff fire">FIRE ${Math.ceil(b.fire)}s</span>`);
    if (b.bomb > 0) parts.push(`<span class="buff bomb">BOMB ${Math.ceil(b.bomb)}s</span>`);
    const html = parts.join('');
    if (html !== el.buffs.dataset.html) {
      el.buffs.dataset.html = html;
      el.buffs.innerHTML = html;
    }
  }

  function makeBall(x, y, vx, vy, speed) {
    return {
      x,
      y,
      vx,
      vy,
      r: BALL_R,
      speed: speed || Math.min(780, 440 + (state.level - 1) * 24),
      stuck: false,
      offset: 0,
      trail: [],
    };
  }

  const LEVEL_GAPS = [
    [35],
    [34],
    [36],
    [33],
    [35],
    [37],
  ];

  function makeBrick(r, c, type, hp, color) {
    return {
      x: GRID.marginX + c * STEPX,
      y: GRID.top + r * STEPY,
      w: BW,
      h: GRID.h,
      row: r,
      col: c,
      type,
      color: color || null,
      hp: type === 'steel' ? Infinity : hp,
      maxHp: type === 'steel' ? Infinity : hp,
      alive: true,
    };
  }

  function buildLevel() {
    const level = state.level;
    const theme = THEMES[(level - 1) % THEMES.length];
    state.theme = theme;

    const barrierRow = 31 + (level % 3);
    state.barrierRow = barrierRow;
    const gapWidth = 1;
    const gapStart = clamp(LEVEL_GAPS[(level - 1) % LEVEL_GAPS.length][0], 3, GRID.cols - gapWidth - 3);
    const gapEnd = gapStart + gapWidth - 1;

    const grid = [];
    for (let r = 0; r < GRID.rows; r++) grid.push(new Array(GRID.cols).fill(null));

    const colorFor = (r, c, type) => {
      if (type === 'gold') return '#ffd45e';
      if (type === 'bomb') return shade(theme.base, -0.42);
      if (type === 'tough') return shade(theme.base, 0.28);
      return shade(theme.base, (r + c) % 2 === 0 ? 0.075 : -0.055);
    };

    for (let r = 1; r < barrierRow; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        let type = 'normal';
        let hp = 1;
        const roll = Math.random();
        if (roll < 0.004) {
          type = 'gold';
        } else if (roll < 0.012 + level * 0.001) {
          type = 'tough';
          hp = level >= 5 ? 3 : 2;
        }
        grid[r][c] = makeBrick(r, c, type, hp, colorFor(r, c, type));
      }
    }

    const inChamber = (c, r) => c >= 0 && c < GRID.cols && r >= 1 && r < barrierRow;
    const keyOf = (c, r) => r * GRID.cols + c;
    const laneB = gapStart;
    const laneA = Math.max(6, gapStart - 18 - (level % 3) * 3);
    const laneC = Math.min(GRID.cols - 9, gapStart + 18 + (level % 3) * 3);
    const cw = 4;
    const y0 = barrierRow - 1;
    const y1 = barrierRow - 9;
    const y2 = y1 - 9;
    const y3 = y2 - 9;
    let lane1 = level % 2 ? laneA : laneC;
    let lane2 = level % 2 ? laneC : laneA;
    if (lane1 === lane2) lane1 = laneA;
    const chute = new Set();

    const carve = (c, r) => {
      if (!inChamber(c, r)) return;
      chute.add(keyOf(c, r));
      grid[r][c] = null;
    };
    const carveRect = (x0, y0, x1, y1) => {
      for (let r = y0; r <= y1; r++) {
        for (let c = x0; c <= x1; c++) carve(c, r);
      }
    };

    carveRect(laneB, y1, laneB + cw - 1, y0);
    carveRect(Math.min(lane1, laneB), y1, Math.max(lane1, laneB) + cw - 1, y1 + cw - 1);
    carveRect(lane1, y2, lane1 + cw - 1, y1 + cw - 1);
    carveRect(Math.min(lane1, lane2), y2, Math.max(lane1, lane2) + cw - 1, y2 + cw - 1);
    carveRect(lane2, y3, lane2 + cw - 1, y2 + cw - 1);
    carveRect(Math.min(laneB, lane2), y3, Math.max(laneB, lane2) + cw - 1, y3 + cw - 1);
    carveRect(laneB, 1, laneB + cw - 1, y3 + cw - 1);

    const steel = new Set();
    for (const k of chute) {
      const c = k % GRID.cols;
      const r = (k / GRID.cols) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (!inChamber(nc, nr)) continue;
        if (nr <= 2) continue;
        const nk = keyOf(nc, nr);
        if (chute.has(nk)) continue;
        steel.add(nk);
      }
    }

    for (const k of steel) {
      const c = k % GRID.cols;
      const r = (k / GRID.cols) | 0;
      grid[r][c] = makeBrick(r, c, 'steel', 1);
    }

    const openCell = (c, r) => {
      if (!inChamber(c, r)) return;
      chute.add(keyOf(c, r));
      grid[r][c] = null;
    };
    const addVerticalDoor = (lane, yA, yB, side) => {
      const wallX = side < 0 ? lane - 1 : lane + cw;
      const fieldX = side < 0 ? lane - 2 : lane + cw + 1;
      const mid = Math.floor((yA + yB) / 2);
      for (let r = mid; r <= mid + 1; r++) {
        openCell(wallX, r);
        openCell(fieldX, r);
      }
    };
    const addHorizontalDoor = (y, xA, xB, side) => {
      const wallY = side < 0 ? y - 1 : y + cw;
      const fieldY = side < 0 ? y - 2 : y + cw + 1;
      const mid = Math.floor((xA + xB) / 2);
      for (let c = mid; c <= mid + 1; c++) {
        openCell(c, wallY);
        openCell(c, fieldY);
      }
    };

    addHorizontalDoor(y1, Math.min(laneB, lane1), Math.max(laneB, lane1) + cw - 1, level % 2 ? -1 : 1);
    addVerticalDoor(lane1, y2, y1 + cw - 1, level % 2 ? 1 : -1);
    addHorizontalDoor(y2, Math.min(lane1, lane2), Math.max(lane1, lane2) + cw - 1, level % 2 ? -1 : 1);
    addVerticalDoor(lane2, y3, y2 + cw - 1, level % 2 ? 1 : -1);
    addHorizontalDoor(y3, Math.min(laneB, lane2), Math.max(laneB, lane2) + cw - 1, level % 2 ? -1 : 1);

    for (let rr = barrierRow; rr < barrierRow + 2 && rr < GRID.rows; rr++) {
      for (let c = 0; c < GRID.cols; c++) {
        if (c >= gapStart && c <= gapEnd) continue;
        grid[rr][c] = makeBrick(rr, c, 'steel', 1);
      }
    }

    for (let rr = barrierRow; rr < barrierRow + 2 && rr < GRID.rows; rr++) {
      for (let c = gapStart; c <= gapEnd; c++) chute.add(keyOf(c, rr));
    }

    const walls = [];
    const wallY = GRID.top + barrierRow * STEPY;
    const wallH = GRID.h * 2 + GRID.gap;
    walls.push({ x: 0, y: wallY, w: GRID.marginX, h: wallH, type: 'steel', alive: true });
    walls.push({ x: W - GRID.marginX, y: wallY, w: GRID.marginX, h: wallH, type: 'steel', alive: true });

    let destructible = 0;
    for (let rr = 0; rr < GRID.rows; rr++) {
      for (let c = 0; c < GRID.cols; c++) {
        const cell = grid[rr][c];
        if (cell && cell.type !== 'steel') destructible++;
      }
    }

    state.grid = grid;
    state.walls = walls;
    state.mazeCells = chute;
    state.vaultOpened = false;
    state.corridors = [{ gapStart, gapEnd, gapWidth, topRow: barrierRow, bottomRow: barrierRow + 1 }];
    state.destructible = destructible;
    state.powerups = [];
    state.lasers = [];
    state.particles = [];
    state.texts = [];
    state.brickDirty = true;

    const swNormal = document.querySelector('.swatch-normal');
    if (swNormal) swNormal.style.background = shade(theme.base, 0.075);
    const swTough = document.querySelector('.swatch-tough');
    if (swTough) swTough.style.background = shade(theme.base, 0.28);
  }

  function resetBall() {
    state.paddle.w = PADDLE.baseW;
    state.lasers = [];
    state.powerups = [];
    const b = makeBall(state.paddle.cx, PADDLE.y - BALL_R - 1, 0, -1);
    b.stuck = true;
    state.balls = [b];
    state.mode = 'ready';
  }

  function startGame() {
    state.score = 0;
    state.lives = 5;
    state.level = 1;
    state.combo = 0;
    state.comboTimer = 0;
    syncHud();
    buildLevel();
    resetBuffs();
    resetBall();
    hideOverlay();
    playMusic(true);
  }

  function nextLevel() {
    state.level++;
    if (state.level > MAX_LEVEL) {
      winGame();
      return;
    }
    syncHud();
    buildLevel();
    resetBuffs();
    resetBall();
    hideOverlay();
  }

  function winGame() {
    state.mode = 'win';
    sound('level');
    showOverlay(
      'Vitezstvi!',
      `Prosel jsi vsech ${MAX_LEVEL} mozaikovych levelu. Celkove skore: ${state.score}.`,
      'Hrat znovu',
      startGame
    );
  }

  function gameOver() {
    state.mode = 'gameover';
    sound('over');
    showOverlay('Konec hry', `Dosahl jsi skore ${state.score}. Zkus to znovu!`, 'Hrat znovu', startGame);
  }

  function loseLife() {
    state.lives--;
    syncHud();
    if (state.lives <= 0) {
      gameOver();
      return;
    }
    resetBuffs();
    resetBall();
    sound('over');
  }

  function launchBalls() {
    let launched = false;
    for (const b of state.balls) {
      if (!b.stuck) continue;
      const rel = clamp(b.offset / (state.paddle.w / 2), -0.85, 0.85);
      const angle = rel * (Math.PI / 3) + rand(-0.05, 0.05);
      b.vx = Math.sin(angle) * b.speed;
      b.vy = -Math.cos(angle) * b.speed;
      b.stuck = false;
      launched = true;
    }
    if (launched) {
      state.mode = 'playing';
      sound('launch');
    }
  }

  function togglePause() {
    if (state.mode === 'paused') {
      state.mode = state.prevMode || 'playing';
      hideOverlay();
      if (musicWanted) playMusic();
    } else if (state.mode === 'playing' || state.mode === 'ready') {
      state.prevMode = state.mode;
      state.mode = 'paused';
      pauseMusic();
      showOverlay('Pauza', 'Hra je pozastavena.', 'Pokracovat', togglePause);
    }
  }

  function handlePrimary() {
    switch (state.mode) {
      case 'menu':
      case 'gameover':
      case 'win':
        startGame();
        break;
      case 'levelclear':
        nextLevel();
        break;
      case 'paused':
        togglePause();
        break;
      case 'ready':
      case 'playing':
        launchBalls();
        break;
      default:
        break;
    }
  }

  function movePaddleTo(cx) {
    state.paddle.cx = clamp(cx, state.paddle.w / 2, W - state.paddle.w / 2);
  }

  function pointerX(e) {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  }

  function addText(x, y, text, color) {
    state.texts.push({ x, y, vy: -55, life: 0, max: 0.95, text, color });
  }

  function spawnBurst(x, y, color, count, spread) {
    if (state.particles.length > MAX_PARTICLES) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(40, spread);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: rand(0.3, 0.75),
        color,
        size: rand(1.5, 4),
      });
    }
  }

  function brickColor(b) {
    switch (b.type) {
      case 'steel':
        return STEEL_COLOR;
      case 'tough':
        return b.color || '#9fb6c8';
      case 'bomb':
        return b.color || '#3a2340';
      case 'gold':
        return '#ffd45e';
      default:
        return b.color || '#2946d6';
    }
  }

  function dropPowerup(brick) {
    if (brick.type !== 'gold' && state.powerups.length >= 8) return;
    const chance = brick.type === 'gold' ? 1 : brick.type === 'tough' ? 0.09 : 0.045;
    if (Math.random() > chance) return;

    let roll = Math.random() * POWER_TOTAL;
    let id = POWER_KEYS[0];
    for (const k of POWER_KEYS) {
      roll -= POWER_DEFS[k].weight;
      if (roll <= 0) {
        id = k;
        break;
      }
    }
    state.powerups.push({
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vy: 150,
      r: 8,
      rot: Math.random() * Math.PI,
      id,
    });
  }

  function repaintBrick(brick) {
    if (state.brickDirty) return;
    bctx.clearRect(brick.x, brick.y, brick.w, brick.h);
    if (brick.alive) drawBrick(bctx, brick);
  }

  function destroyBrick(brick, silent) {
    if (!brick.alive || brick.type === 'steel') return false;
    brick.alive = false;
    repaintBrick(brick);
    state.destructible = Math.max(0, state.destructible - 1);

    const base = brick.type === 'gold' ? 250 : brick.type === 'bomb' ? 30 : brick.type === 'tough' ? 25 : 10;
    addBrickScore(base);
    registerCombo();

    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    if (!silent) {
      const col = brick.type === 'gold' ? '#ffd45e' : brick.type === 'bomb' ? '#ff8a2b' : brickColor(brick);
      spawnBurst(cx, cy, col, brick.type === 'gold' ? 14 : 6, 230);
      sound('break');
    }
    if (brick.type === 'gold') addText(cx, cy, '+250', '#ffd45e');
    dropPowerup(brick);
    return true;
  }

  function damageBrick(brick, amount) {
    if (!brick.alive || brick.type === 'steel') return false;
    brick.hp -= amount;
    if (brick.hp <= 0) {
      destroyBrick(brick);
      return true;
    }
    repaintBrick(brick);
    spawnBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, brickColor(brick), 3, 120);
    sound('hit');
    return false;
  }

  function explodeAt(x0, y0, radius) {
    const queue = [{ x: x0, y: y0, r: radius }];
    let guard = 0;
    let first = true;
    while (queue.length && guard++ < 80) {
      const e = queue.shift();
      state.shake = Math.min(24, state.shake + 8);
      spawnBurst(e.x, e.y, state.theme.accent, first ? 26 : 12, 520);
      if (first) sound('boom');
      first = false;

      const c0 = Math.max(0, Math.floor((e.x - e.r - GRID.marginX) / STEPX));
      const c1 = Math.min(GRID.cols - 1, Math.floor((e.x + e.r - GRID.marginX) / STEPX));
      const r0 = Math.max(0, Math.floor((e.y - e.r - GRID.top) / STEPY));
      const r1 = Math.min(GRID.rows - 1, Math.floor((e.y + e.r - GRID.top) / STEPY));

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const brick = state.grid[r][c];
          if (!brick || !brick.alive || brick.type === 'steel') continue;
          const cx = brick.x + brick.w / 2;
          const cy = brick.y + brick.h / 2;
          if (dist2(cx, cy, e.x, e.y) > (e.r + 8) * (e.r + 8)) continue;
          const wasBomb = brick.type === 'bomb';
          destroyBrick(brick, true);
          if (wasBomb) queue.push({ x: cx, y: cy, r: e.r * 0.88 });
        }
      }
    }
  }

  function bounceOffBrick(b, brick) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    const ox = brick.w / 2 + b.r - Math.abs(b.x - cx);
    const oy = brick.h / 2 + b.r - Math.abs(b.y - cy);
    if (ox < oy) {
      b.vx = -b.vx;
      b.x = b.x < cx ? brick.x - b.r - 0.5 : brick.x + brick.w + b.r + 0.5;
    } else {
      b.vy = -b.vy;
      b.y = b.y < cy ? brick.y - b.r - 0.5 : brick.y + brick.h + b.r + 0.5;
    }
  }

  function handleBrickHit(b, brick) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;

    if (brick.type === 'steel') {
      bounceOffBrick(b, brick);
      spawnBurst(b.x, b.y, '#dbe5f5', 2, 90);
      sound('steel');
      return;
    }

    if (state.buffs.bomb > 0) {
      const wasBomb = brick.type === 'bomb';
      destroyBrick(brick);
      explodeAt(cx, cy, wasBomb ? 88 : 68);
      return;
    }

    const wasBomb = brick.type === 'bomb';
    const destroyed = damageBrick(brick, 1);
    if (destroyed && wasBomb) explodeAt(cx, cy, 80);
    if (state.buffs.fire > 0) return;
    bounceOffBrick(b, brick);
  }

  function collideBricks(b) {
    const c0 = Math.floor((b.x - b.r - GRID.marginX) / STEPX);
    const c1 = Math.floor((b.x + b.r - GRID.marginX) / STEPX);
    const r0 = Math.floor((b.y - b.r - GRID.top) / STEPY);
    const r1 = Math.floor((b.y + b.r - GRID.top) / STEPY);
    const cc0 = Math.max(0, c0);
    const cc1 = Math.min(GRID.cols - 1, c1);
    const rr0 = Math.max(0, r0);
    const rr1 = Math.min(GRID.rows - 1, r1);

    for (let r = rr0; r <= rr1; r++) {
      const row = state.grid[r];
      for (let c = cc0; c <= cc1; c++) {
        const brick = row[c];
        if (!brick || !brick.alive) continue;
        const nx = clamp(b.x, brick.x, brick.x + brick.w);
        const ny = clamp(b.y, brick.y, brick.y + brick.h);
        if (dist2(b.x, b.y, nx, ny) > b.r * b.r) continue;
        handleBrickHit(b, brick);
        return;
      }
    }
  }

  function collideWalls(b) {
    for (const wall of state.walls) {
      const nx = clamp(b.x, wall.x, wall.x + wall.w);
      const ny = clamp(b.y, wall.y, wall.y + wall.h);
      if (dist2(b.x, b.y, nx, ny) > b.r * b.r) continue;
      bounceOffBrick(b, wall);
      spawnBurst(b.x, b.y, '#dbe5f5', 2, 90);
      sound('steel');
      return;
    }
  }

  function spawnExtraBalls(n) {
    const alive = state.balls.find((x) => !x.stuck);
    const cx = alive ? alive.x : state.paddle.cx;
    const cy = alive ? alive.y : PADDLE.y - 24;
    const base = alive ? Math.atan2(alive.vy, alive.vx) : -Math.PI / 2;
    const speed = Math.min(780, 440 + (state.level - 1) * 24);
    for (let i = 0; i < n && state.balls.length < MAX_BALLS; i++) {
      const a = base + (i - (n - 1) / 2) * 0.34 + rand(-0.05, 0.05);
      state.balls.push(makeBall(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, speed));
    }
  }

  function applyPower(id) {
    const b = state.buffs;
    switch (id) {
      case 'multi':
        spawnExtraBalls(3);
        break;
      case 'crazy':
        spawnExtraBalls(8);
        break;
      case 'wide':
        b.wide = 16;
        break;
      case 'slow':
        b.slow = 9;
        break;
      case 'life':
        state.lives++;
        syncHud();
        sound('life');
        break;
      case 'sticky':
        b.sticky = 13;
        break;
      default:
        break;
    }
    const def = POWER_DEFS[id];
    addText(state.paddle.cx, PADDLE.y - 34, def.name, def.color);
    spawnBurst(state.paddle.cx, PADDLE.y - 6, def.color, 14, 260);
    if (id !== 'life') sound('power');
    renderBuffs();
  }

  function reflectPaddle(b) {
    const p = state.paddle;
    if (b.vy <= 0) return;
    if (
      b.y + b.r < p.y ||
      b.y - b.r > p.y + p.h ||
      b.x < p.cx - p.w / 2 - b.r ||
      b.x > p.cx + p.w / 2 + b.r
    )
      return;

    if (state.buffs.sticky > 0) {
      b.stuck = true;
      b.offset = clamp(b.x - p.cx, -p.w / 2 + 12, p.w / 2 - 12);
      b.x = p.cx + b.offset;
      b.y = p.y - b.r - 1;
      b.trail.length = 0;
      sound('bounce');
      return;
    }

    const rel = clamp((b.x - p.cx) / (p.w / 2), -1, 1);
    const angle = rel * (Math.PI / 3);
    b.vx = Math.sin(angle) * b.speed;
    b.vy = -Math.cos(angle) * b.speed;
    b.y = p.y - b.r - 0.5;
    sound('bounce');
  }

  function updateBalls(dt) {
    const slow = state.buffs.slow > 0 ? 0.66 : 1;
    const p = state.paddle;
    const keep = [];

    for (const b of state.balls) {
      if (b.stuck) {
        b.x = p.cx + b.offset;
        b.y = p.y - b.r - 1;
        keep.push(b);
        continue;
      }

      const speed = b.speed * slow;
      const len = Math.hypot(b.vx, b.vy) || 1;
      b.vx = (b.vx / len) * speed;
      b.vy = (b.vy / len) * speed;

      const steps = Math.max(1, Math.ceil((speed * dt) / (b.r * 0.75)));
      const sdt = dt / steps;

      for (let i = 0; i < steps; i++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;

        if (b.x - b.r < 0) {
          b.x = b.r;
          b.vx = Math.abs(b.vx);
          sound('bounce');
        } else if (b.x + b.r > W) {
          b.x = W - b.r;
          b.vx = -Math.abs(b.vx);
          sound('bounce');
        }
        if (b.y - b.r < 0) {
          b.y = b.r;
          b.vy = Math.abs(b.vy);
          sound('bounce');
        }

        reflectPaddle(b);
        if (b.stuck) break;
        collideBricks(b);
        collideWalls(b);
      }

      if (b.y - b.r > H + 24) {
        spawnBurst(b.x, H - 8, '#ff5f7a', 6, 180);
        continue;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 7) b.trail.shift();
      keep.push(b);
    }

    state.balls = keep;

    if (state.balls.length === 0 && state.mode === 'playing') {
      loseLife();
    }
  }

  function updatePaddle(dt) {
    const p = state.paddle;
    let dir = 0;
    if (keys.has('left')) dir -= 1;
    if (keys.has('right')) dir += 1;
    if (dir !== 0) p.cx += dir * PADDLE.speed * dt;

    const target = PADDLE.baseW * (state.buffs.wide > 0 ? 1.6 : 1);
    p.w += (target - p.w) * Math.min(1, dt * 12);
    p.cx = clamp(p.cx, p.w / 2, W - p.w / 2);
  }

  function updateBuffs(dt) {
    const b = state.buffs;
    let changed = false;
    for (const k in b) {
      if (b[k] > 0) {
        b[k] = Math.max(0, b[k] - dt);
        changed = true;
      }
    }
    if (changed) renderBuffs();
  }

  function updatePowerups(dt) {
    const p = state.paddle;
    const keep = [];
    for (const pu of state.powerups) {
      pu.y += pu.vy * dt;
      pu.rot += dt * 2.6;
      if (pu.y - pu.r > H) continue;

      if (
        pu.y + pu.r > p.y &&
        pu.y - pu.r < p.y + p.h &&
        pu.x > p.cx - p.w / 2 - pu.r &&
        pu.x < p.cx + p.w / 2 + pu.r
      ) {
        applyPower(pu.id);
        continue;
      }
      keep.push(pu);
    }
    state.powerups = keep;
  }

  function updateLasers(dt) {
    const p = state.paddle;
    if (state.buffs.laser > 0) {
      state.laserCooldown -= dt;
      if (state.laserCooldown <= 0) {
        state.laserCooldown = 0.26;
        state.lasers.push({ x: p.cx - p.w / 2 + 10, y: p.y - 4, vy: -1050, w: 3, h: 12 });
        state.lasers.push({ x: p.cx + p.w / 2 - 14, y: p.y - 4, vy: -1050, w: 3, h: 12 });
        sound('laser');
      }
    } else {
      state.laserCooldown = 0;
    }

    const keep = [];
    for (const l of state.lasers) {
      l.y += l.vy * dt;
      if (l.y + l.h < 0) continue;

      let hit = false;
      const c0 = Math.max(0, Math.floor((l.x - GRID.marginX) / STEPX));
      const c1 = Math.min(GRID.cols - 1, Math.floor((l.x + l.w - GRID.marginX) / STEPX));
      const r0 = Math.max(0, Math.floor((l.y - GRID.top) / STEPY));
      const r1 = Math.min(GRID.rows - 1, Math.floor((l.y + l.h - GRID.top) / STEPY));

      for (let r = r0; r <= r1 && !hit; r++) {
        for (let c = c0; c <= c1; c++) {
          const brick = state.grid[r][c];
          if (!brick || !brick.alive) continue;
          if (
            l.x < brick.x + brick.w &&
            l.x + l.w > brick.x &&
            l.y < brick.y + brick.h &&
            l.y + l.h > brick.y
          ) {
            if (brick.type === 'bomb') {
              destroyBrick(brick);
              explodeAt(brick.x + brick.w / 2, brick.y + brick.h / 2, 80);
            } else {
              damageBrick(brick, 1);
            }
            hit = true;
            break;
          }
        }
      }
      if (!hit) keep.push(l);
    }
    state.lasers = keep;
  }

  function updateParticles(dt) {
    const keep = [];
    for (const pt of state.particles) {
      pt.life += dt;
      if (pt.life >= pt.max) continue;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 520 * dt;
      pt.vx *= 0.99;
      keep.push(pt);
    }
    state.particles = keep;
  }

  function updateTexts(dt) {
    const keep = [];
    for (const t of state.texts) {
      t.life += dt;
      if (t.life >= t.max) continue;
      t.y += t.vy * dt;
      keep.push(t);
    }
    state.texts = keep;
  }

  function maybeOpenVault() {
    if (state.vaultOpened || state.destructible > 12) return;
    state.vaultOpened = true;
    let opened = 0;
    for (let r = 1; r < state.barrierRow; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const b = state.grid[r][c];
        if (b && b.type === 'steel') {
          state.grid[r][c] = null;
          opened++;
        }
      }
    }
    if (opened) {
      state.brickDirty = true;
      addText(state.paddle.cx, PADDLE.y - 40, 'OCEL POVOLILA!', '#ffd45e');
      sound('level');
    }
  }

  function checkLevelClear() {
    if (state.mode !== 'playing') return;
    maybeOpenVault();
    if (state.destructible > 0) return;

    state.mode = 'levelclear';
    const bonus = 300 + state.lives * 100;
    state.score += bonus;
    sound('level');

    if (state.level >= MAX_LEVEL) {
      winGame();
      return;
    }
    showOverlay(
      `Mozaika ${state.level} rozbita!`,
      `Bonus +${bonus}. Skore: ${state.score}.`,
      'Dalsi mozaika',
      nextLevel
    );
  }

  function update(dt) {
    updatePaddle(dt);
    updateParticles(dt);
    updateTexts(dt);
    state.shake = Math.max(0, state.shake - dt * 70);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    syncHud();
    syncCombo();

    if (state.mode === 'playing') {
      updateBuffs(dt);
      updateBalls(dt);
      if (state.mode !== 'playing') {
        renderBuffs();
        return;
      }
      updatePowerups(dt);
      updateLasers(dt);
      checkLevelClear();
      renderBuffs();
    }
  }

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawBrick(c, b) {
    const col = brickColor(b);
    c.fillStyle = col;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(b.x, b.y, b.w, 1.5);
    c.fillStyle = 'rgba(0,0,0,0.24)';
    c.fillRect(b.x, b.y + b.h - 1.5, b.w, 1.5);

    if (b.type === 'tough') {
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 1;
      c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      c.fillStyle = '#ffe1dc';
      const pipY = b.y + b.h / 2 - 1;
      for (let i = 0; i < b.hp; i++) c.fillRect(b.x + b.w / 2 - b.hp * 2 + i * 4, pipY, 2, 2);
    } else if (b.type === 'bomb') {
      c.fillStyle = '#ff8a2b';
      c.beginPath();
      c.arc(b.x + b.w / 2, b.y + b.h / 2, 3.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffe0b0';
      c.fillRect(b.x + b.w / 2 + 2, b.y + b.h / 2 - 5, 1.5, 3);
    } else if (b.type === 'gold') {
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(b.x + 3, b.y + 3, b.w * 0.35, 2);
    } else if (b.type === 'steel') {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(b.x + 2, b.y + 2, b.w - 4, 1.5);
      c.fillStyle = 'rgba(20,26,40,0.55)';
      c.fillRect(b.x + 2, b.y + b.h - 4, b.w - 4, 1.5);
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(b.x + 3, b.y + b.h - 3);
      c.lineTo(b.x + b.w - 3, b.y + 3);
      c.stroke();
    }
  }

  function redrawBricks() {
    bctx.clearRect(0, 0, W, H);
    bctx.fillStyle = '#04060e';
    for (const k of state.mazeCells) {
      const c = k % GRID.cols;
      const r = (k / GRID.cols) | 0;
      bctx.fillRect(GRID.marginX + c * STEPX, GRID.top + r * STEPY, BW + GRID.gap, GRID.h + GRID.gap);
    }
    for (let r = 0; r < GRID.rows; r++) {
      const row = state.grid[r];
      for (let c = 0; c < GRID.cols; c++) {
        const b = row[c];
        if (b && b.alive) drawBrick(bctx, b);
      }
    }
    for (const wall of state.walls) {
      if (wall.alive) drawBrick(bctx, wall);
    }
    state.brickDirty = false;
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1022');
    g.addColorStop(0.6, '#06080f');
    g.addColorStop(1, '#03040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(FIELD_CX, FIELD_CY, 20, FIELD_CX, FIELD_CY, 560);
    glow.addColorStop(0, state.theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = s.a * (0.6 + 0.4 * Math.sin(time * 1.3 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFieldFrame() {
    const bottom = GRID.top + (state.barrierRow + 2) * STEPY - GRID.gap;
    const x = GRID.marginX - 4;
    const y = GRID.top - 4;
    const w = FIELD_W + 8;
    const h = bottom - y;
    ctx.fillStyle = STEEL_COLOR;
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillRect(x + w - 3, y, 3, h);
    ctx.fillStyle = 'rgba(6,10,20,0.5)';
    ctx.fillRect(x, y + 3, w, 1);
    ctx.fillRect(x + 3, y, 1, h);
    ctx.fillRect(x + w - 4, y, 1, h);
  }

  function drawCorridorMarkers(time) {
    if (!state.corridors.length) return;
    ctx.save();
    for (const co of state.corridors) {
      const x = GRID.marginX + co.gapStart * STEPX;
      const w = co.gapWidth * STEPX - GRID.gap;
      const top = GRID.top + co.topRow * STEPY;
      const bottom = GRID.top + (co.bottomRow + 1) * STEPY - GRID.gap;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + co.gapStart);

      ctx.globalAlpha = 0.05 + 0.05 * pulse;
      ctx.fillStyle = state.theme.accent;
      ctx.fillRect(x, top, w, bottom - top);

      ctx.globalAlpha = 0.45 + 0.4 * pulse;
      ctx.strokeStyle = state.theme.accent;
      ctx.lineWidth = 1.5;
      const ax = x + w / 2;
      const ay = bottom - 4;
      for (let i = 0; i < 3; i++) {
        const yy = ay - i * 6;
        ctx.beginPath();
        ctx.moveTo(ax - 6, yy + 4);
        ctx.lineTo(ax, yy - 2);
        ctx.lineTo(ax + 6, yy + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPaddle() {
    const p = state.paddle;
    const x = p.cx - p.w / 2;
    ctx.save();
    ctx.shadowColor = state.theme.accent;
    ctx.shadowBlur = 12;
    const g = ctx.createLinearGradient(x, p.y, x, p.y + p.h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#dfe8f5');
    g.addColorStop(1, '#9aa9c0');
    ctx.fillStyle = g;
    rr(ctx, x, p.y, p.w, p.h, 7);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    rr(ctx, x, p.y, p.w, p.h, 7);
    ctx.stroke();

    if (state.buffs.laser > 0) {
      ctx.fillStyle = '#ffb066';
      ctx.fillRect(x + 5, p.y - 5, 5, 6);
      ctx.fillRect(x + p.w - 10, p.y - 5, 5, 6);
    }
  }

  function drawBalls() {
    const fire = state.buffs.fire > 0;
    const bomb = state.buffs.bomb > 0;
    const color = bomb ? '#ff6b4a' : fire ? '#ffd45e' : state.theme.accent;

    for (const b of state.balls) {
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const a = ((i + 1) / b.trail.length) * 0.22;
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * (0.35 + (i / b.trail.length) * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPowerups() {
    for (const pu of state.powerups) {
      const def = POWER_DEFS[pu.id];
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.rotate(Math.sin(pu.rot) * 0.16);
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(8,12,26,0.92)';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.color;
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, 0, 1);
      ctx.restore();
    }
  }

  function drawLasers() {
    for (const l of state.lasers) {
      ctx.save();
      ctx.shadowColor = '#ff9d4d';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffd8a8';
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const pt of state.particles) {
      const a = 1 - pt.life / pt.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of state.texts) {
      const a = 1 - t.life / t.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHint(time) {
    const hasStuck = state.balls.some((b) => b.stuck);
    if (state.mode !== 'ready' && !hasStuck) return;
    ctx.globalAlpha = 0.5 + 0.35 * Math.sin(time * 3);
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Klikni / mezernik. Zamer kulicku do male skuliny v ocelove zdi', W / 2, H - 108);
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  let time = 0;

  function render() {
    time += 0.016;
    drawBackground(time);

    ctx.save();
    if (state.shake > 0.4) {
      ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
    }
    if (state.brickDirty) redrawBricks();
    ctx.drawImage(brickLayer, 0, 0, W, H);
    drawFieldFrame();
    drawCorridorMarkers(time);
    drawPowerups();
    drawLasers();
    drawPaddle();
    drawBalls();
    drawParticles();
    drawTexts();
    ctx.restore();

    drawHint(time);
  }

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.04);

    if (state.mode !== 'paused') update(dt);
    render();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointermove', (e) => {
    movePaddleTo(pointerX(e));
  });

  canvas.addEventListener('pointerdown', (e) => {
    movePaddleTo(pointerX(e));
    handlePrimary();
    if (audio && audio.state === 'suspended') audio.resume();
  });

  el.overlayBtn.addEventListener('click', () => {
    if (audio && audio.state === 'suspended') audio.resume();
    overlayAction();
  });

  el.btnPause.addEventListener('click', togglePause);

  el.btnMute.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('bb-muted', muted ? '1' : '0');
    applyMute();
  });
  applyMute();

  document.querySelectorAll('.pad-btn').forEach((btn) => {
    const action = btn.dataset.action;
    const press = (e) => {
      e.preventDefault();
      if (action === 'left') keys.add('left');
      else if (action === 'right') keys.add('right');
      else handlePrimary();
    };
    const release = (e) => {
      e.preventDefault();
      keys.delete('left');
      keys.delete('right');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  });

  const keyMap = {
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
  };

  window.addEventListener('keydown', (e) => {
    if (keyMap[e.key]) {
      keys.add(keyMap[e.key]);
      e.preventDefault();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handlePrimary();
      return;
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      togglePause();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keyMap[e.key]) keys.delete(keyMap[e.key]);
  });

  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(el.stage);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseMusic();
      if (state.mode === 'playing' || state.mode === 'ready') togglePause();
    } else if (musicWanted) {
      playMusic();
    }
  });

  syncHud();
  buildLevel();
  state.balls = [];
  showOverlay(
    'BRICK BREAKER: INSANE',
    'Kostky se skryvaji za ocelovou zdi. Zamer kulicku do male svitici skuliny a projdi zkroucenou chodbou z ocelovych bloku - teprve na jejim konci se dostanes ke kostkam! Kulicka se od kazde kostky odrazi. Chytej bonusy: M multi, X crazy, W wide, S slow, C sticky, + zivot. Svetle kostky jsou tvrdsi, sede ocelove zdi jsou neznicitelne, zlate kostky davaji bonus.',
    'Hrat',
    startGame
  );
  requestAnimationFrame(loop);
})();
