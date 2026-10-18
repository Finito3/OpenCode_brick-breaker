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
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    overlayBtn: document.getElementById('overlayBtn'),
    btnPause: document.getElementById('btnPause'),
    btnMute: document.getElementById('btnMute'),
  };

  const MAX_LEVEL = 6;
  const BRICK = { cols: 10, marginX: 40, top: 86, gap: 8, height: 27, rowGap: 8 };
  const PADDLE = { baseW: 134, h: 16, y: H - 48, speed: 820 };
  const BALL_R = 9;

  const ROW_COLORS = ['#4ad2ff', '#5f8bff', '#a86bff', '#ff6bd6', '#ff7a8a', '#ffb14a', '#ffd45e', '#4be08a'];

  const POWER_DEFS = {
    multi: { color: '#4be08a', label: 'M', weight: 26 },
    wide: { color: '#56b8ff', label: 'W', weight: 16 },
    slow: { color: '#6ff0e0', label: 'S', weight: 12 },
    life: { color: '#ff5f7a', label: '+', weight: 7 },
    laser: { color: '#ff9d4d', label: 'L', weight: 14 },
    sticky: { color: '#c78bff', label: 'C', weight: 8 },
    fire: { color: '#ffd45e', label: 'F', weight: 17 },
  };
  const POWER_KEYS = Object.keys(POWER_DEFS);
  const POWER_TOTAL = POWER_KEYS.reduce((s, k) => s + POWER_DEFS[k].weight, 0);

  const state = {
    mode: 'menu',
    prevMode: 'playing',
    score: 0,
    lives: 3,
    level: 1,
    bricks: [],
    balls: [],
    powerups: [],
    lasers: [],
    particles: [],
    buffs: { wide: 0, slow: 0, laser: 0, sticky: 0, fire: 0 },
    paddle: { cx: W / 2, w: PADDLE.baseW, h: PADDLE.h, y: PADDLE.y },
    laserCooldown: 0,
  };

  let overlayAction = () => {};
  let buffsHtml = '';
  let muted = localStorage.getItem('bb-muted') === '1';
  let audio = null;
  const keys = new Set();
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3,
    a: Math.random() * 0.5 + 0.15,
    tw: Math.random() * Math.PI * 2,
  }));

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);

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

  function sound(name) {
    if (muted) return;
    try {
      if (!audio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio = new AC();
      }
      if (audio.state === 'suspended') audio.resume();
      const cfg = {
        bounce: [430, 300, 'square', 0.05, 0.045],
        hit: [280, 240, 'square', 0.04, 0.03],
        break: [700, 1040, 'triangle', 0.08, 0.07],
        launch: [460, 820, 'sine', 0.09, 0.08],
        power: [520, 1120, 'sine', 0.18, 0.1],
        life: [660, 1180, 'sine', 0.22, 0.1],
        laser: [1000, 380, 'square', 0.05, 0.025],
        steel: [190, 150, 'square', 0.06, 0.05],
        level: [520, 1320, 'triangle', 0.35, 0.09],
        over: [320, 70, 'sawtooth', 0.55, 0.09],
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

  function updateHud() {
    el.score.textContent = state.score;
    el.level.textContent = state.level;
    el.lives.textContent = state.lives;
  }

  function popScore() {
    el.score.classList.remove('pop');
    void el.score.offsetWidth;
    el.score.classList.add('pop');
  }

  function addScore(points) {
    state.score += points;
    el.score.textContent = state.score;
    popScore();
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
    renderBuffs();
  }

  function renderBuffs() {
    const b = state.buffs;
    const parts = [];
    if (b.wide > 0) parts.push(`<span class="buff wide">SIRSI ${Math.ceil(b.wide)}s</span>`);
    if (b.slow > 0) parts.push(`<span class="buff slow">POMALE ${Math.ceil(b.slow)}s</span>`);
    if (b.laser > 0) parts.push(`<span class="buff laser">LASER ${Math.ceil(b.laser)}s</span>`);
    if (b.sticky > 0) parts.push(`<span class="buff sticky">LEPIVA ${Math.ceil(b.sticky)}s</span>`);
    if (b.fire > 0) parts.push(`<span class="buff fire">FIREBALL ${Math.ceil(b.fire)}s</span>`);
    const html = parts.join('');
    if (html !== buffsHtml) {
      buffsHtml = html;
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
      speed: speed || Math.min(700, 380 + (state.level - 1) * 24),
      stuck: false,
      offset: 0,
      trail: [],
    };
  }

  function buildLevel() {
    const level = state.level;
    const cols = BRICK.cols;
    const rows = Math.min(4 + level, 8);
    const bw = (W - 2 * BRICK.marginX - (cols - 1) * BRICK.gap) / cols;
    const bh = BRICK.height;
    const bricks = [];
    const style = (level - 1) % 4;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let present = true;
        if (style === 1) present = (r + c) % 2 === 0;
        else if (style === 2) present = Math.abs(c - (cols - 1) / 2) <= r + 1;
        else if (style === 3) present = c % 3 !== 2;
        if (!present) continue;

        let type = 'normal';
        let hp = 1;
        if (level >= 2 && Math.random() < 0.1 + level * 0.045) {
          type = 'tough';
          hp = level >= 4 ? 3 : 2;
        }

        bricks.push({
          x: BRICK.marginX + c * (bw + BRICK.gap),
          y: BRICK.top + r * (bh + BRICK.rowGap),
          w: bw,
          h: bh,
          row: r,
          col: c,
          type,
          hp,
          maxHp: hp,
          alive: true,
          flash: 0,
        });
      }
    }

    const steelCount = level >= 2 ? Math.min(2 + level, 9) : 0;
    if (steelCount > 0) {
      const pool = bricks.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      let destr = bricks.length;
      let placed = 0;
      for (const b of pool) {
        if (placed >= steelCount || destr <= 10) break;
        if (b.type === 'steel') continue;
        b.type = 'steel';
        b.hp = Infinity;
        b.maxHp = Infinity;
        placed++;
        destr--;
      }
    }

    state.bricks = bricks;
    state.powerups = [];
    state.lasers = [];
    state.particles = [];
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
    state.lives = 3;
    state.level = 1;
    updateHud();
    buildLevel();
    resetBuffs();
    resetBall();
    hideOverlay();
    sound('launch');
  }

  function nextLevel() {
    state.level++;
    if (state.level > MAX_LEVEL) {
      state.level = MAX_LEVEL;
      winGame();
      return;
    }
    updateHud();
    buildLevel();
    resetBuffs();
    resetBall();
    hideOverlay();
  }

  function winGame() {
    state.mode = 'win';
    showOverlay(
      'Vitezstvi!',
      `Prosel jsi vsech ${MAX_LEVEL} levelu. Celkove skore: ${state.score}.`,
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
    updateHud();
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
    } else if (state.mode === 'playing' || state.mode === 'ready') {
      state.prevMode = state.mode;
      state.mode = 'paused';
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

  function spawnBurst(x, y, color, count, spread) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(50, spread);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: rand(0.35, 0.8),
        color,
        size: rand(2, 5),
      });
    }
  }

  function brickColor(b) {
    if (b.type === 'steel') return '#96a3c4';
    if (b.type === 'tough') return '#ff8a5c';
    return ROW_COLORS[b.row % ROW_COLORS.length];
  }

  function dropPowerup(brick) {
    if (state.powerups.length >= 5) return;
    const chance = brick.type === 'tough' ? 0.34 : 0.17;
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
      vy: 145,
      r: 15,
      rot: 0,
      id,
    });
  }

  function destroyBrick(brick) {
    if (!brick.alive) return;
    brick.alive = false;
    const points = brick.type === 'tough' ? 30 : 12;
    addScore(points);
    spawnBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, brickColor(brick), 12, 280);
    dropPowerup(brick);
    sound('break');
  }

  function damageBrick(brick, amount) {
    if (brick.type === 'steel') {
      spawnBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, '#dfe8ff', 4, 120);
      sound('steel');
      return false;
    }
    brick.hp -= amount;
    brick.flash = 0.12;
    if (brick.hp <= 0) {
      destroyBrick(brick);
      return true;
    }
    spawnBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, brickColor(brick), 4, 140);
    sound('hit');
    return false;
  }

  function applyPower(id) {
    const b = state.buffs;
    switch (id) {
      case 'multi': {
        const src = state.balls.find((x) => !x.stuck) || state.balls[0];
        if (src && state.balls.length < 14) {
          const base = src.stuck ? -Math.PI / 2 : Math.atan2(src.vy, src.vx);
          const want = Math.min(2, 14 - state.balls.length);
          for (let i = 0; i < want; i++) {
            const spread = (i - (want - 1) / 2) * 0.55 + rand(-0.08, 0.08);
            const a = base + spread;
            const nb = makeBall(src.x, src.y, Math.cos(a) * src.speed, Math.sin(a) * src.speed, src.speed);
            state.balls.push(nb);
          }
        }
        break;
      }
      case 'wide':
        b.wide = 16;
        break;
      case 'slow':
        b.slow = 9;
        break;
      case 'life':
        state.lives++;
        updateHud();
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
      default:
        break;
    }
    spawnBurst(state.paddle.cx, PADDLE.y - 6, POWER_DEFS[id].color, 16, 260);
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

  function collideBricks(b) {
    const fire = state.buffs.fire > 0;
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const nx = clamp(b.x, brick.x, brick.x + brick.w);
      const ny = clamp(b.y, brick.y, brick.y + brick.h);
      const dx = b.x - nx;
      const dy = b.y - ny;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      if (brick.type === 'steel') {
        const ox = brick.w / 2 + b.r - Math.abs(b.x - (brick.x + brick.w / 2));
        const oy = brick.h / 2 + b.r - Math.abs(b.y - (brick.y + brick.h / 2));
        if (ox < oy) {
          b.vx = -b.vx;
          b.x = b.x < brick.x + brick.w / 2 ? brick.x - b.r - 0.5 : brick.x + brick.w + b.r + 0.5;
        } else {
          b.vy = -b.vy;
          b.y = b.y < brick.y + brick.h / 2 ? brick.y - b.r - 0.5 : brick.y + brick.h + b.r + 0.5;
        }
        spawnBurst(b.x, b.y, '#cfe0ff', 3, 110);
        sound('steel');
        return;
      }

      damageBrick(brick, 1);

      if (fire) return;

      const ox = brick.w / 2 + b.r - Math.abs(b.x - (brick.x + brick.w / 2));
      const oy = brick.h / 2 + b.r - Math.abs(b.y - (brick.y + brick.h / 2));
      if (ox < oy) {
        b.vx = -b.vx;
        b.x = b.x < brick.x + brick.w / 2 ? brick.x - b.r - 0.5 : brick.x + brick.w + b.r + 0.5;
      } else {
        b.vy = -b.vy;
        b.y = b.y < brick.y + brick.h / 2 ? brick.y - b.r - 0.5 : brick.y + brick.h + b.r + 0.5;
      }
      return;
    }
  }

  function updateBalls(dt) {
    const slow = state.buffs.slow > 0 ? 0.68 : 1;
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

      const steps = Math.max(1, Math.ceil((speed * dt) / (b.r * 0.8)));
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
      }

      if (b.y - b.r > H + 20) {
        spawnBurst(b.x, H - 10, '#ff5f7a', 8, 200);
        continue;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();
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
      pu.rot += dt * 2.4;
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
        state.laserCooldown = 0.3;
        state.lasers.push({ x: p.cx - p.w / 2 + 10, y: p.y - 4, vy: -980, w: 4, h: 16 });
        state.lasers.push({ x: p.cx + p.w / 2 - 14, y: p.y - 4, vy: -980, w: 4, h: 16 });
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
      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (
          l.x < brick.x + brick.w &&
          l.x + l.w > brick.x &&
          l.y < brick.y + brick.h &&
          l.y + l.h > brick.y
        ) {
          damageBrick(brick, 1);
          hit = true;
          break;
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

  function checkLevelClear() {
    if (state.mode !== 'playing') return;
    const remaining = state.bricks.some((b) => b.alive && b.type !== 'steel');
    if (remaining) return;

    if (state.level >= MAX_LEVEL) {
      const bonus = 500;
      addScore(bonus);
      winGame();
      sound('level');
      return;
    }

    state.mode = 'levelclear';
    const bonus = 150 + state.lives * 50;
    addScore(bonus);
    sound('level');
    showOverlay(
      `Level ${state.level} dokoncen`,
      `Bonus +${bonus}. Skore: ${state.score}.`,
      'Dalsi level',
      nextLevel
    );
  }

  function update(dt) {
    updatePaddle(dt);
    updateParticles(dt);

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

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1533');
    g.addColorStop(0.55, '#080d21');
    g.addColorStop(1, '#05070f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, 40, 10, W / 2, 40, 520);
    glow.addColorStop(0, 'rgba(74,130,255,0.16)');
    glow.addColorStop(1, 'rgba(74,130,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = s.a * (0.6 + 0.4 * Math.sin(time * 1.4 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBricks() {
    for (const b of state.bricks) {
      if (!b.alive) continue;
      const base = brickColor(b);
      if (b.type === 'steel') {
        const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        g.addColorStop(0, '#b6c2de');
        g.addColorStop(0.5, '#7d8aab');
        g.addColorStop(1, '#59637e');
        ctx.fillStyle = g;
        roundRect(b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,240,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(30,38,58,0.75)';
        for (const [dx, dy] of [
          [10, 8],
          [b.w - 10, 8],
          [10, b.h - 8],
          [b.w - 10, b.h - 8],
        ]) {
          ctx.beginPath();
          ctx.arc(b.x + dx, b.y + dy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      g.addColorStop(0, shade(base, 0.28));
      g.addColorStop(0.55, base);
      g.addColorStop(1, shade(base, -0.22));
      ctx.fillStyle = g;
      roundRect(b.x, b.y, b.w, b.h, 6);
      ctx.fill();

      ctx.strokeStyle = shade(base, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(b.x + 4, b.y + 3, b.w - 8, b.h * 0.3, 3);
      ctx.fill();

      if (b.type === 'tough' && b.hp < b.maxHp) {
        ctx.strokeStyle = 'rgba(40,10,10,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.25, b.y + 3);
        ctx.lineTo(b.x + b.w * 0.38, b.y + b.h * 0.5);
        ctx.lineTo(b.x + b.w * 0.28, b.y + b.h - 3);
        ctx.moveTo(b.x + b.w * 0.62, b.y + 3);
        ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.55);
        ctx.lineTo(b.x + b.w * 0.66, b.y + b.h - 3);
        ctx.stroke();
      }

      if (b.flash > 0) {
        b.flash -= 1 / 60;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, b.flash) * 4})`;
        roundRect(b.x, b.y, b.w, b.h, 6);
        ctx.fill();
      }
    }
  }

  function drawPaddle() {
    const p = state.paddle;
    const x = p.cx - p.w / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(74,210,255,0.7)';
    ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(x, p.y, x, p.y + p.h);
    g.addColorStop(0, '#bff2ff');
    g.addColorStop(0.5, '#4ad2ff');
    g.addColorStop(1, '#1f7fd0');
    ctx.fillStyle = g;
    roundRect(x, p.y, p.w, p.h, 8);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    roundRect(x, p.y, p.w, p.h, 8);
    ctx.stroke();

    if (state.buffs.laser > 0) {
      ctx.fillStyle = '#ffb066';
      ctx.fillRect(x + 5, p.y - 5, 5, 6);
      ctx.fillRect(x + p.w - 10, p.y - 5, 5, 6);
    }
  }

  function drawBalls() {
    const fire = state.buffs.fire > 0;
    for (const b of state.balls) {
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const a = ((i + 1) / b.trail.length) * 0.28;
        ctx.globalAlpha = a;
        ctx.fillStyle = fire ? '#ffd45e' : '#8ef0ff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * (0.4 + (i / b.trail.length) * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 2.2);
      glow.addColorStop(0, fire ? '#fff3c4' : '#e6feff');
      glow.addColorStop(0.4, fire ? '#ffb020' : '#4ad2ff');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = fire ? '#fff1b8' : '#f2ffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPowerups() {
    for (const pu of state.powerups) {
      const def = POWER_DEFS[pu.id];
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.rotate(Math.sin(pu.rot) * 0.18);
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(8,12,26,0.9)';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.color;
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
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
      ctx.shadowBlur = 12;
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

  function drawHint(time) {
    const hasStuck = state.balls.some((b) => b.stuck);
    if (state.mode !== 'ready' && !hasStuck) return;
    const a = 0.55 + 0.35 * Math.sin(time * 3);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Klikni nebo stiskni mezernik pro vystreleni', W / 2, H - 118);
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  let time = 0;

  function render() {
    time += 0.016;
    drawBackground(time);
    drawBricks();
    drawPowerups();
    drawLasers();
    drawPaddle();
    drawBalls();
    drawParticles();
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
    el.btnMute.classList.toggle('off', muted);
  });
  el.btnMute.classList.toggle('off', muted);

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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state.mode === 'playing' || state.mode === 'ready')) togglePause();
  });

  updateHud();
  buildLevel();
  state.balls = [];
  showOverlay(
    'Brick Breaker',
    'Rozbij vsechny barevne kostky. Ocelove kostky jsou neznicitelne - odrazej se od nich. Chytej bonusy: M = multiball, W = sirsi palka, S = pomale kulicky, L = laser, C = lepiva palka, F = fireball, + = zivot.',
    'Hrat',
    startGame
  );
  requestAnimationFrame(loop);
})();
