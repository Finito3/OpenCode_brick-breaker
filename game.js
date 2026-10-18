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
  const GRID = { cols: 36, rows: 28, marginX: 24, top: 62, gap: 2, h: 13 };
  const BW = (W - 2 * GRID.marginX - (GRID.cols - 1) * GRID.gap) / GRID.cols;
  const STEPX = BW + GRID.gap;
  const STEPY = GRID.h + GRID.gap;
  const FIELD_W = GRID.cols * STEPX - GRID.gap;
  const FIELD_H = GRID.rows * STEPY - GRID.gap;
  const FIELD_CX = GRID.marginX + FIELD_W / 2;
  const FIELD_CY = GRID.top + FIELD_H / 2;
  const MOTIF_SCALE = 190;
  const PADDLE = { baseW: 140, h: 15, y: H - 46, speed: 950 };
  const BALL_R = 7;
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
    { base: '#ff8a2b', accent: '#ffd45e', glow: 'rgba(255,138,43,0.16)' },
    { base: '#25c7e8', accent: '#a8f4ff', glow: 'rgba(37,199,232,0.16)' },
    { base: '#f0459e', accent: '#ffb3df', glow: 'rgba(240,69,158,0.16)' },
    { base: '#5fd44a', accent: '#d5ffb3', glow: 'rgba(95,212,74,0.16)' },
    { base: '#9a6bff', accent: '#e0cfff', glow: 'rgba(154,107,255,0.16)' },
    { base: '#ff5a4d', accent: '#ffd0b3', glow: 'rgba(255,90,77,0.16)' },
  ];

  const POWER_DEFS = {
    multi: { color: '#4be08a', label: 'M', name: 'MULTI', weight: 24 },
    crazy: { color: '#ff4fd8', label: 'X', name: 'CRAZY', weight: 8 },
    wide: { color: '#56b8ff', label: 'W', name: 'WIDE', weight: 12 },
    slow: { color: '#6ff0e0', label: 'S', name: 'SLOW', weight: 10 },
    laser: { color: '#ff9d4d', label: 'L', name: 'LASER', weight: 14 },
    sticky: { color: '#c78bff', label: 'C', name: 'STICKY', weight: 8 },
    fire: { color: '#ffd45e', label: 'F', name: 'FIREBALL', weight: 14 },
    bomb: { color: '#ff6b4a', label: 'B', name: 'BOMB BALL', weight: 11 },
    life: { color: '#ff5f7a', label: '+', name: 'LIFE', weight: 6 },
  };
  const POWER_KEYS = Object.keys(POWER_DEFS);
  const POWER_TOTAL = POWER_KEYS.reduce((s, k) => s + POWER_DEFS[k].weight, 0);

  const STAR = (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 1 : 0.45;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  })();

  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0];
      const yi = pts[i][1];
      const xj = pts[j][0];
      const yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function heartAt(nx, ny, cx, cy, s) {
    const x = (nx - cx) / s;
    const y = -(ny - cy) / s;
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y < 0;
  }

  const MOTIFS = [
    (nx, ny) => {
      const x = nx + 0.06;
      const y = ny + 0.02;
      const halfH = 0.86;
      const halfW = 0.92;
      const t = 0.15;
      const left = Math.abs(x + halfW) < t && Math.abs(y) < halfH;
      const right = Math.abs(x - halfW) < t && Math.abs(y) < halfH;
      const diag = distSeg(x, y, -halfW, -halfH, halfW, halfH) < t * 1.1;
      const heart = heartAt(nx, ny, 0.32, -0.74, 0.25);
      return left || right || diag || heart;
    },
    (nx, ny) => inPoly(nx / 1.02, ny / 1.02, STAR),
    (nx, ny) => heartAt(nx, ny, 0, 0, 0.85),
    (nx, ny) => {
      const x = nx;
      const y = ny;
      const head = (x * x) / (0.64 * 0.64) + ((y + 0.05) * (y + 0.05)) / (0.72 * 0.72) < 1;
      const jaw = Math.abs(x) < 0.34 && y > 0.36 && y < 0.74;
      if (!head && !jaw) return false;
      const eyeL = dist2(x, y, -0.25, -0.08) < 0.11 * 0.11;
      const eyeR = dist2(x, y, 0.25, -0.08) < 0.11 * 0.11;
      const nose = Math.abs(x) < 0.07 && y > 0.14 && y < 0.3;
      if (eyeL || eyeR || nose) return false;
      return true;
    },
    (nx, ny) => {
      const r = Math.hypot(nx, ny);
      const ring = r > 0.6 && r < 0.78;
      const eyeL = dist2(nx, ny, -0.24, -0.14) < 0.1 * 0.1;
      const eyeR = dist2(nx, ny, 0.24, -0.14) < 0.1 * 0.1;
      const mouth = Math.abs(r - 0.44) < 0.055 && ny > 0.06;
      return ring || eyeL || eyeR || mouth;
    },
    (nx, ny) => Math.abs(nx) / 1.02 + Math.abs(ny) / 0.88 < 1,
  ];

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
    rowColors: [],
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

  const stars = Array.from({ length: 110 }, () => ({
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
  const MUSIC_VOLUME = 0.3;
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
      music = new Audio('assets/neon-gaming.mp3');
      music.loop = true;
      music.preload = 'auto';
      music.volume = MUSIC_VOLUME;
    }
    return music;
  }

  function playMusic() {
    musicWanted = true;
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
    [9],
    [7, 26],
    [26],
    [11, 24],
    [5],
    [5, 17, 29],
  ];

  function makeBrick(r, c, type, hp) {
    return {
      x: GRID.marginX + c * STEPX,
      y: GRID.top + r * STEPY,
      w: BW,
      h: GRID.h,
      row: r,
      col: c,
      type,
      hp: type === 'steel' ? Infinity : hp,
      maxHp: type === 'steel' ? Infinity : hp,
      alive: true,
    };
  }

  function buildLevel() {
    const level = state.level;
    const theme = THEMES[(level - 1) % THEMES.length];
    state.theme = theme;
    state.rowColors = [];
    for (let r = 0; r < GRID.rows; r++) {
      const amt = (r % 2 === 0 ? 0.05 : -0.06) + (r / GRID.rows - 0.5) * 0.12;
      state.rowColors.push(shade(theme.base, amt));
    }

    const barrierRow = 14 + (level % 3);
    const gapWidth = 2;
    const gapStarts = LEVEL_GAPS[(level - 1) % LEVEL_GAPS.length];
    const corridorLen = 6 + (level % 2);

    const grid = [];
    for (let r = 0; r < GRID.rows; r++) grid.push(new Array(GRID.cols).fill(null));

    const motif = MOTIFS[(level - 1) % MOTIFS.length];
    const copies = level === 1 ? 1 : level % 2 === 0 ? 2 : 3;
    const chamberCY = GRID.top + (barrierRow * STEPY) / 2;
    const scale = (barrierRow * STEPY) / 2 / 1.22;

    for (let r = 1; r < barrierRow; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const px = GRID.marginX + c * STEPX + BW / 2;
        const py = GRID.top + r * STEPY + GRID.h / 2;
        let hole = false;
        for (let k = 0; k < copies; k++) {
          const cx = (W * (k + 1)) / (copies + 1);
          if (motif((px - cx) / scale, (py - chamberCY) / scale)) {
            hole = true;
            break;
          }
        }
        if (hole) continue;

        let type = 'normal';
        let hp = 1;
        const roll = Math.random();
        if (roll < 0.026) {
          type = 'bomb';
        } else if (roll < 0.036) {
          type = 'gold';
        } else if (level >= 2 && roll < 0.055 + level * 0.006) {
          type = 'tough';
          hp = level >= 5 ? 3 : 2;
        } else if (level >= 3 && roll < 0.068 + level * 0.005) {
          type = 'steel';
        }
        grid[r][c] = makeBrick(r, c, type, hp);
      }
    }

    const corridors = [];
    for (const start of gapStarts) {
      const gs = clamp(start, 2, GRID.cols - gapWidth - 2);
      const ge = gs + gapWidth - 1;
      corridors.push({
        gapStart: gs,
        gapEnd: ge,
        gapWidth,
        topRow: barrierRow,
        bottomRow: barrierRow + 1 + corridorLen,
      });

      for (let r = Math.max(1, barrierRow - 4); r < barrierRow; r++) {
        for (let c = gs - 3; c <= ge + 3; c++) {
          if (c >= 0 && c < GRID.cols) grid[r][c] = null;
        }
      }

      for (let i = 0; i < corridorLen; i++) {
        const r = barrierRow + 2 + i;
        if (r >= GRID.rows) break;
        let spread = 0;
        if (i >= corridorLen - 3) spread = i - (corridorLen - 3);
        const lc = gs - 1 - spread;
        const rc = ge + 1 + spread;
        if (lc >= 0 && lc < GRID.cols) grid[r][lc] = makeBrick(r, lc, 'steel', 1);
        if (rc >= 0 && rc < GRID.cols) grid[r][rc] = makeBrick(r, rc, 'steel', 1);
      }
    }

    for (let r = barrierRow; r < barrierRow + 2 && r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        let inGap = false;
        for (const co of corridors) {
          if (c >= co.gapStart && c <= co.gapEnd) {
            inGap = true;
            break;
          }
        }
        if (!inGap) grid[r][c] = makeBrick(r, c, 'steel', 1);
      }
    }

    let destructible = 0;
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const b = grid[r][c];
        if (b && b.type !== 'steel') destructible++;
      }
    }

    state.grid = grid;
    state.corridors = corridors;
    state.walls = [];
    const wallY = GRID.top + barrierRow * STEPY;
    const wallH = GRID.h * 2 + GRID.gap;
    state.walls.push({ x: 0, y: wallY, w: GRID.marginX, h: wallH, type: 'steel', alive: true });
    state.walls.push({ x: W - GRID.marginX, y: wallY, w: GRID.marginX, h: wallH, type: 'steel', alive: true });
    state.destructible = destructible;
    state.powerups = [];
    state.lasers = [];
    state.particles = [];
    state.texts = [];
    state.brickDirty = true;
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
    playMusic();
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
        return '#5a6482';
      case 'tough':
        return '#ff5f4a';
      case 'bomb':
        return '#5a2340';
      case 'gold':
        return '#ffd45e';
      default:
        return state.rowColors[b.row];
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
      vy: 165,
      r: 13,
      rot: Math.random() * Math.PI,
      id,
    });
  }

  function destroyBrick(brick, silent) {
    if (!brick.alive || brick.type === 'steel') return false;
    brick.alive = false;
    state.brickDirty = true;
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
    state.brickDirty = true;
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
        b.fire = Math.max(b.fire, 5);
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
      case 'laser':
        b.laser = 13;
        state.laserCooldown = 0;
        break;
      case 'sticky':
        b.sticky = 13;
        break;
      case 'fire':
        b.fire = 10;
        break;
      case 'bomb':
        b.bomb = 9;
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
        state.lasers.push({ x: p.cx - p.w / 2 + 10, y: p.y - 4, vy: -1050, w: 4, h: 15 });
        state.lasers.push({ x: p.cx + p.w / 2 - 14, y: p.y - 4, vy: -1050, w: 4, h: 15 });
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

  function checkLevelClear() {
    if (state.mode !== 'playing') return;
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
    ctx.strokeStyle = 'rgba(210,225,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(GRID.marginX - 5, GRID.top - 5, FIELD_W + 10, FIELD_H + 10);
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
      ctx.lineWidth = 2;
      const ax = x + w / 2;
      const ay = bottom - 3;
      for (let i = 0; i < 3; i++) {
        const yy = ay - i * 7;
        ctx.beginPath();
        ctx.moveTo(ax - 8, yy + 5);
        ctx.lineTo(ax, yy - 2);
        ctx.lineTo(ax + 8, yy + 5);
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
    ctx.shadowBlur = 20;
    const g = ctx.createLinearGradient(x, p.y, x, p.y + p.h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, state.theme.accent);
    g.addColorStop(1, state.theme.base);
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
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(8,12,26,0.92)';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.color;
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
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
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
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
    'Kostky se skryvaji za ocelovou zdi. Zamer kulicku do svitici skuliny a proskakej ulickou dovnitr! Kulicka se od kazde kostky odrazi. Chytej bonusy: M multi, X crazy, W wide, S slow, L laser, C sticky, F fireball, B bomb ball, + zivot. Barevne kostky jsou tvrdsi, sede ocelove jsou neznicitelne.',
    'Hrat',
    startGame
  );
  requestAnimationFrame(loop);
})();
