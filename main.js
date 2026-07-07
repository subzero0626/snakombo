const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const IS_MOBILE = (
  ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
) && (
  Math.min(window.innerWidth, window.innerHeight) < 900 ||
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
);
const MOBILE_VIRTUAL_W = 1280;
const MOBILE_VIRTUAL_H = 720;
const MOBILE_MENU_W = 1280;
const MOBILE_MENU_H = 720;
if (IS_MOBILE) {
  document.documentElement.classList.add('is-mobile');
  // 허브 패널들의 body 직속 이동(메뉴 scale 영향권 밖)은 허브 초기화 시점에서 처리한다.
  // 모바일에서 연습 설정 패널을 원본 비율 그대로 50% 축소
  const _practicePanel = document.getElementById('practice-panel-wrap');
  if (_practicePanel) {
    _practicePanel.style.setProperty('transform', 'scale(0.5)', 'important');
    _practicePanel.style.setProperty('transform-origin', 'top left', 'important');
  }
}

function applyMobileMenuScale() {
  if (!IS_MOBILE) return;
  const m = document.getElementById('menu-screen');
  if (!m) return;
  m.classList.remove('menu-animate');
  m.style.setProperty('position', 'fixed', 'important');
  m.style.setProperty('left', '0', 'important');
  m.style.setProperty('top', '0', 'important');
  m.style.setProperty('right', 'auto', 'important');
  m.style.setProperty('bottom', 'auto', 'important');
  m.style.setProperty('width', MOBILE_MENU_W + 'px', 'important');
  m.style.setProperty('height', MOBILE_MENU_H + 'px', 'important');
  m.style.setProperty('min-height', '0', 'important');
  m.style.setProperty('max-width', 'none', 'important');
  m.style.setProperty('transform-origin', 'top left', 'important');
  m.style.setProperty('animation', 'none', 'important');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / MOBILE_MENU_W, vh / MOBILE_MENU_H);
  const scaledW = MOBILE_MENU_W * scale;
  const scaledH = MOBILE_MENU_H * scale;
  const left = (vw - scaledW) / 2;
  const top = (vh - scaledH) / 2;
  m.style.setProperty('transform', `translate(${left}px, ${top}px) scale(${scale})`, 'important');
}

function isMobilePortrait() {
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(orientation: portrait)');
    if (mq && typeof mq.matches === 'boolean') return mq.matches;
  }
  return window.innerWidth < window.innerHeight;
}

function updatePortraitPrompt() {
  const overlay = document.getElementById('portrait-required-overlay');
  if (overlay) overlay.classList.remove('is-active');
}

const LOADING_MIN_MS = 1250;
const loadingShownAtMs = performance.now();
let loadingReady = false;
let loadingDoneAtMs = 0;
let loadingRafId = null;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function setLoadingProgress(p01) {
  const p = clamp01(p01);
  const pct = Math.round(p * 100);
  const elText = document.getElementById('loading-text');
  const elFill = document.getElementById('loading-bar-fill');
  if (elText) elText.textContent = 'Loading ' + pct + '%';
  if (elFill) elFill.style.width = pct + '%';
}

function startLoadingProgressLoop() {
  if (loadingRafId) return;
  const t0 = performance.now();
  let shownMax = 0;
  function tick() {
    const now = performance.now();
    // 체감 진행률: 초반 빠르게, 후반 느리게(최대 99%에서 대기)
    const t = (now - t0) / 1200; // 1.2s 기준
    const eased = 1 - Math.exp(-t * 2.1);
    const target = loadingReady ? 1 : Math.min(0.99, eased);
    shownMax = Math.max(shownMax, target);
    setLoadingProgress(shownMax);

    if (loadingReady && shownMax >= 1) {
      loadingRafId = null;
      return;
    }
    loadingRafId = requestAnimationFrame(tick);
  }
  loadingRafId = requestAnimationFrame(tick);
}

let comboAudioCtx = null;
function getComboAudioContext() {
  if (!comboAudioCtx) {
    comboAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return comboAudioCtx;
}

/** 콤보가 쌓일 때마다 — 도·래·미·파·솔·라·시·(다음)도… 순으로 상승(7콤보마다 한 옥타브) */
function playComboStackSound(comboValue) {
  try {
    const ac = getComboAudioContext();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const c = Math.max(1, comboValue | 0);
    const doToSi = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88];
    const n = c - 1;
    const step = n % 7;
    const octave = Math.floor(n / 7);
    const freq = doToSi[step] * Math.pow(2, octave);
    const peak = Math.min(0.14, 0.08 + Math.min(c - 1, 11) * 0.0035);

    const master = ac.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(peak, t + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    master.connect(ac.destination);

    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 0.96, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.02, t + 0.04);
    const g1 = ac.createGain();
    g1.gain.value = 0.82;
    osc.connect(g1);
    g1.connect(master);

    const oscHi = ac.createOscillator();
    oscHi.type = 'sine';
    oscHi.frequency.setValueAtTime(freq * 2.01, t);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.28, t + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    oscHi.connect(g2);
    g2.connect(master);

    osc.start(t);
    oscHi.start(t);
    osc.stop(t + 0.14);
    oscHi.stop(t + 0.14);
  } catch (_) {}
}

/** 메뉴 버튼 등 — primary: 게임/튜토리얼 시작, soft: 업적·닫기·패널 */
function playMenuUiSound(kind) {
  try {
    const ac = getComboAudioContext();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const primary = kind === 'primary';
    const f0 = primary ? 400 : 280;
    const f1 = primary ? 580 : 385;
    const peak = primary ? 0.075 : 0.052;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const g = ac.createGain();
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.048);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  } catch (_) {}
}

/** 잠긴 메뉴 액션: '뚜' 같은 거부음 */
function playMenuDenySound() {
  try {
    const ac = getComboAudioContext();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'square';
    const g = ac.createGain();
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.06);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch (_) {}
}

// 모바일 스케일링 제거: 고정 스케일 1
const GAME_SCALE = 1;

const SEGMENT_DIST = 6;
const HEAD_RADIUS = 8;
const HEAD_WIDTH = 15.5;
const MIN_GAP = HEAD_WIDTH * 5;
const SNAKE_SAFE_DIST = 200;

// (모바일 스케일링을 걷어내면서) 기존 코드 호환용: px()는 그대로 두되 1:1로 동작
function px(n) {
  return n;
}

function resize() {
  if (IS_MOBILE) {
    canvas.width = MOBILE_VIRTUAL_W;
    canvas.height = MOBILE_VIRTUAL_H;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / MOBILE_VIRTUAL_W, vh / MOBILE_VIRTUAL_H);
    const scaledW = Math.round(MOBILE_VIRTUAL_W * scale);
    const scaledH = Math.round(MOBILE_VIRTUAL_H * scale);
    canvas.style.width = scaledW + 'px';
    canvas.style.height = scaledH + 'px';
    canvas.style.left = Math.round((vw - scaledW) / 2) + 'px';
    canvas.style.top = Math.round((vh - scaledH) / 2) + 'px';
    canvas.style.right = 'auto';
    canvas.style.bottom = 'auto';
    applyMobileMenuScale();
    updatePortraitPrompt();
  } else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

const SEGMENTS = 100;
/** 혼돈 디버프 long_snake: 세그먼트 개수만 1.5배 */
const SEGMENTS_CHAOS_LONG = 150;
const SNAKE_START_X_OFFSET = -100;
const points = [];

for (let i = 0; i < SEGMENTS_CHAOS_LONG; i++) {
  points.push({ x: 0, y: 0 });
}

function getRunSegmentCount() {
  return chaosHasDebuff('long_snake') ? SEGMENTS_CHAOS_LONG : SEGMENTS;
}

let angle = 0;
const BASE_SPEED = 4.3;
const SPEED_INCREMENT = 0.048; // per second (시간 경과 가속 완화, 기본 0.06)
const COMBO_TIMEOUT_MS = 2000;
/** 튜토리얼에서만 콤보 유지 제한(초) — 본편은 COMBO_TIMEOUT_MS */
const TUTORIAL_COMBO_TIMEOUT_MS = 4000;

/** 튜토리얼 1단계: 챌린지 유지 시간(ms) */
const TUTORIAL_S1_CHALLENGE_MS = 7000;

/** 콤보 HUD — 1~2 흰, 3~4 노랑, 5~6 주황, 7+ 붉은 동그라미 상승. 전체 불투명도 ~70% */
const COMBO_HUD_ALPHA = 0.7;

/** 콤보 7+ 동그라미 상승 — 메인 제목 불꽃과 동일 로직 */
function drawComboHudRisingParticles(ctx, x, baselineY, tw, fontSize, now) {
  const emitY = baselineY - fontSize * 0.18;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const spread = 0.06 + ((i * 0.618) % 1) * 0.88;
    const px0 = x + spread * tw;
    const phase = (now * 0.00155 + i * 0.11) % 1;
    const rise = 22 + (i % 4) * 7;
    const wob = Math.sin(now * 0.0038 + i * 0.9) * 1.4;
    const px = px0 + wob * phase;
    const py = emitY - phase * rise;
    const fade = (1 - phase) * (1 - phase);
    ctx.globalAlpha = COMBO_HUD_ALPHA * (0.12 + 0.55 * fade);
    const r = 1.45 + (1 - phase) * 1.75;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = phase < 0.4 ? '#f87171' : '#ed4242';
    ctx.fill();
  }
  ctx.globalAlpha = COMBO_HUD_ALPHA;
}

function drawMenuTitleRisingParticles(ctx, x, baselineY, tw, fontSize, now) {
  const emitY = baselineY - fontSize * 0.18;
  const n = 20;
  for (let i = 0; i < n; i++) {
    const spread = 0.06 + ((i * 0.618) % 1) * 0.88;
    const px0 = x + spread * tw;
    const phase = (now * 0.00195 + i * 0.09) % 1;
    const rise = 38 + (i % 6) * 11;
    const wob = Math.sin(now * 0.0032 + i * 0.85) * 2.4;
    const px = px0 + wob * phase;
    const py = emitY - phase * rise;
    const fade = (1 - phase) * (1 - phase);
    ctx.globalAlpha = 0.7 * (0.18 + 0.9 * fade);
    const r = 1.95 + (1 - phase) * 2.65;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = phase < 0.4 ? '#f87171' : '#ed4242';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawComboHudText(ctx, str, x, y, combo, fontSpec) {
  ctx.save();
  ctx.font = fontSpec;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = COMBO_HUD_ALPHA;

  if (combo <= 2) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillText(str, x, y);
    ctx.restore();
    return;
  }
  if (combo <= 4) {
    ctx.fillStyle = '#fde68a';
    ctx.fillText(str, x, y);
    ctx.restore();
    return;
  }
  if (combo <= 6) {
    ctx.fillStyle = '#fdba74';
    ctx.fillText(str, x, y);
    ctx.restore();
    return;
  }

  const fsMatch = /(\d+)px/.exec(fontSpec);
  const fontSize = fsMatch ? parseInt(fsMatch[1], 10) : 18;
  const tw = ctx.measureText(str).width;
  const now = performance.now();
  drawComboHudRisingParticles(ctx, x, y, tw, fontSize, now);
  ctx.fillStyle = '#fca3a3';
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** 튜토리얼 전체에서 사용하는 고정 이동 속도 */
const TUTORIAL_SNAKE_SPEED = 4;
let currentSpeed = BASE_SPEED;
const TURN_SPEED = 0.072;
/** 속도가 올라갈 때 회전 가속을 선형보다 살짝만 덜 주기 (1 = 기존과 동일) */
const TURN_SPEED_RAMP = 0.78;
const keys = { a: false, d: false, left: false, right: false };

// Local play (1 PC, 2 snakes) - scaffolding
let localPlayEnabled = false;
let nextRunIsLocal = false;
const LOCAL_SPEED_MULT = 0.9; // 10% slower (base + increment)
const LOCAL_TURN_MULT = 0.9; // 10% slower turning
const LOCAL_SPAWN_RATE_MULT = 1.75; // obstacles spawn 1.75x faster
const LOCAL_WIN_SCORE = 50;

let localWinner = null; // 'white' | 'gray' | null
let localWinReason = ''; // 'death' | 'score'
let localWinTimeSec = null; // number | null

const localSnakeGray = {
  id: 'gray',
  points: [],
  angle: 0
};

// Obstacle system
const GOLDEN_OBS_CHANCE = 1 / 3000;
// 테스트용: 황금 장애물 무조건 생성(원하면 false로)
const GOLDEN_OBS_FORCE_TEST = false;
const GOLDEN_OBS_ENABLED_IN_PRACTICE = false;
/** 본편: 시작 시 장애물 소환 간격(프레임) — 클수록 생성 느림 */
const SPAWN_INTERVAL_START = 74;
/** 경과 시간에 따라 간격이 줄어들며 이 값(프레임) 아래로는 내려가지 않음 */
const SPAWN_INTERVAL_MIN = 17;
/** 경과 1초당 소환 간격이 줄어드는 프레임 수(작을수록 후반까지 장애물 증가가 더 완만) */
const SPAWN_INTERVAL_RAMP = 0.75;
const CHAOS_MODE_MULT = 1.2;
/** 혼돈 obs_glitch 디버프: 흔들림 세기 배율 */
const CHAOS_GLITCH_STRENGTH = 1.15;
// 일반 모드만 살짝 더 빠르게 (+10%)
const NORMAL_MODE_MULT = 1.1;
// 모든 모드에서 장애물 생성 "시간"(간격) +20% (더 느리게)
const SPAWN_TIME_MULT = 1.2;
/** 전 모드 장애물 생성 빈도 15% 감소 (= 소환 간격 1/0.85 배) */
const SPAWN_INTERVAL_SCALE = 1 / 0.85;
/** 이동 장애물 등장 최소 점수 (혼돈·이동 장애물 강화 디버프 시 20) */
const MOVING_OBS_SCORE_THRESHOLD = 35;
const MOVING_OBS_SCORE_THRESHOLD_BOOST = 20;
const MOVING_OBS_BASE_CHANCE = 0.15;
const MOVING_OBS_BASE_CHANCE_HARD = 0.25;
const MOVING_OBS_CHANCE_STEP = 0.01;
const MOVING_OBS_SPEED_MULT = 1.35;
/** 벽·다른 장애물과 유지할 최소 간격(머리 너비×2, 여유 포함) */
const MOVING_OBS_CLEARANCE = HEAD_WIDTH * 2 + 2;
/** 왕복 경로로 쓸 수 있는 최소·최대 길이(고정 거리) */
const MOVING_OBS_TRAVEL_LEN_MIN = HEAD_WIDTH * 4;
const MOVING_OBS_TRAVEL_LEN_MAX = HEAD_WIDTH * 8;
const MOVING_OBS_SPEED_MIN = 0.132;
const MOVING_OBS_SPEED_MAX = 0.252;
/** 필드에 동시에 존재할 수 있는 장애물 최대 개수(일반+이동 합산) */
const MAX_OBSTACLES = 14;

function runCountsForRecords() {
  return !tutorialMode && gameMode !== 'practice' && gameMode !== 'multi';
}

function getRunBaseSpeed() {
  if (gameMode === 'practice') return BASE_SPEED * 0.72 * practiceSettings.speedMult;
  if (gameMode === 'hard') return BASE_SPEED * 1.35;
  if (gameMode === 'chaos') return BASE_SPEED * CHAOS_MODE_MULT;
  const base = BASE_SPEED;
  const normalMult = gameMode === 'normal' ? NORMAL_MODE_MULT : 1;
  return localPlayEnabled ? base * LOCAL_SPEED_MULT * normalMult : base * normalMult;
}

function getRunSpeedIncrement() {
  // 연습 모드: 시간 경과로 속도 증가 없음
  if (gameMode === 'practice') return 0;
  if (gameMode === 'hard') return SPEED_INCREMENT * 1.35;
  if (gameMode === 'chaos') return SPEED_INCREMENT * CHAOS_MODE_MULT;
  const inc = SPEED_INCREMENT;
  const normalMult = gameMode === 'normal' ? NORMAL_MODE_MULT : 1;
  return localPlayEnabled ? inc * LOCAL_SPEED_MULT * normalMult : inc * normalMult;
}

function getSpawnParamsForMode() {
  const applyMult = (p) => ({
    start: p.start * SPAWN_TIME_MULT * SPAWN_INTERVAL_SCALE,
    min: p.min * SPAWN_TIME_MULT * SPAWN_INTERVAL_SCALE,
    ramp: p.ramp * SPAWN_TIME_MULT * SPAWN_INTERVAL_SCALE
  });
  if (gameMode === 'practice') {
    return applyMult({
      start: SPAWN_INTERVAL_START + 36,
      min: SPAWN_INTERVAL_MIN + 10,
      // 연습 모드: 시간 경과로 스폰 가속 없음
      ramp: 0
    });
  }
  if (gameMode === 'hard') {
    return applyMult({
      // 하드: 생성 속도(빈도) 35% 증가 = 간격 1/1.35
      start: SPAWN_INTERVAL_START / 1.35,
      min: Math.max(8, SPAWN_INTERVAL_MIN / 1.35),
      ramp: SPAWN_INTERVAL_RAMP / 1.35
    });
  }
  if (gameMode === 'chaos') {
    return applyMult({
      // 혼돈: 이동/회전/장애물 생성이 일반보다 20% 빠름
      start: SPAWN_INTERVAL_START / CHAOS_MODE_MULT,
      min: Math.max(8, SPAWN_INTERVAL_MIN / CHAOS_MODE_MULT),
      ramp: SPAWN_INTERVAL_RAMP / CHAOS_MODE_MULT
    });
  }
  if (gameMode === 'normal') {
    return applyMult({
      start: SPAWN_INTERVAL_START / NORMAL_MODE_MULT,
      min: Math.max(8, SPAWN_INTERVAL_MIN / NORMAL_MODE_MULT),
      ramp: SPAWN_INTERVAL_RAMP / NORMAL_MODE_MULT
    });
  }
  return applyMult({
    start: SPAWN_INTERVAL_START,
    min: SPAWN_INTERVAL_MIN,
    ramp: SPAWN_INTERVAL_RAMP
  });
}

let staticObs = [];
let score = 0;
let localScoreGrayValue = 0;
let scoreStart = performance.now();
let gameOver = false;
let paused = false;
/** 일시정지 중 ESC 길게 누름 → 메인 (0이면 미추적) */
let escMenuHoldStart = 0;
let gameRunning = false;
let spawnTimer = 0;
let combo = 0; // consecutive scores
let lastScoreTime = 0; // for combo timeout
let localComboGrayValue = 0;
let localLastScoreTimeGray = 0;
/** 본편 한 판에서 달성한 최대 콤보 (업적용) */
let maxComboThisRun = 0;
/** 본편 한 판에서 누적된 콤보 보너스 합 (콤보점수, 업적: 티끌모아 태산) */
let comboBonusPointsThisRun = 0;
/** 연속으로 한 판 최종 점수가 정확히 7점인 횟수 (행운아) */
let consecutiveExactSevenGames = 0;
/** 연속으로 한 판 최종 점수가 5를 넘는 제곱수인 횟수 (제제곱수) */
let consecutiveSquareScoreGames = 0;
/** 본편 한 판에서 움직이는 장애물 연속 통과 횟수 (무브먼트) */
let consecutiveMovingObsPasses = 0;
let practicePlayMsSession = 0;
let practicePlayMsLastSaveAt = 0;
/** 본편: 첫 점수 획득 시 고정된 반(왼/오), 통행금지 업적 */
let halfLaneLock = null;
/** 본편: 반대편에 머문 누적 ms (2초까지 허용) */
let wrongHalfAccumMs = 0;
/** 본편 한 판에서 D키 조향 입력이 있었는지 ("A"ce 업적) */
let mainRunSteerDUsed = false;
/** 본편에서 0점 유지 누적 ms (숨김: 초보자..?) */
let zeroScoreHoldMs = 0;
let animateLastFrameTime = 0;
// HEAD_WIDTH is device-scaled (see updateGameScale)
let floatingTexts = []; // for showing +points on screen

let tutorialMode = false;
let tutorialStep = 0;
let tutorialSnakeActive = true;
/** await_keys → text1_fading → challenge → success_fade → step1_done */
let tutorialStep1State = 'await_keys';
let tutorialS1_text1FadeStart = 0;
let tutorialS1_challengeEnd = 0;
let tutorialS1_challengeAppearStart = 0;
let tutorialS1_successFadeStart = 0;
let gameStartDelayUntil = 0;
/** 본편: normal | hard | practice — 메인 타이틀 클릭으로 전환 */
let gameMode = 'normal';
const SELECTED_MODE_KEY = 'snakombo_selected_mode_v1';

function loadSelectedMode() {
  try {
    const raw = localStorage.getItem(SELECTED_MODE_KEY);
    if (!raw) return;
    const m = String(raw);
    if (m === 'normal' || m === 'hard' || m === 'chaos' || m === 'practice' || m === 'multi') gameMode = m;
  } catch (_) {}
}

function saveSelectedMode() {
  try {
    localStorage.setItem(SELECTED_MODE_KEY, String(gameMode));
  } catch (_) {}
}

// 혼돈(Chaos) 모드: 시작 시 랜덤 디버프 3개 적용 (기본 룰은 일반과 동일)
const CHAOS_DEBUFF_POOL = [
  'tight_gap', // 장애물 간격 감소 (3머리)
  'long_snake', // 뱀 길이 증가 (1.5배)
  'obs_glitch', // 장애물 가끔 글리치 (1/7)
  'speed_flux', // 이동속도 유동 (0.7~1.5)
  'turn_inertia', // 회전 관성 증가(살짝)
  'combo_short', // 콤보 유지시간 1.25초
  'tight_collision', // 충돌 봐주기 제거
  'no_half_point', // 기본점수 구간 축소 (0.5점 구간 삭제)
  'small_safe_zone', // 안전구역 축소(뱀 주변 스폰 금지 구역 감소)
  'moving_obs_boost' // 이동 장애물 강화 (20점부터 등장)
];
let chaosDebuffs = new Set();
let chaosDebuffsPicked = [];
let runSegmentDist = SEGMENT_DIST;
let chaosTurnVel = 0;
let chaosTurnHoldMs = 0;
let chaosIntroUntil = 0;
let chaosIntroWasActive = false;
let chaosIntroStartMs = 0;

function chaosHasDebuff(id) {
  return gameMode === 'chaos' && chaosDebuffs && chaosDebuffs.has(id);
}

function pickChaosDebuffsForRun() {
  chaosDebuffs = new Set();
  chaosDebuffsPicked = [];
  if (gameMode !== 'chaos') return;
  const pool = CHAOS_DEBUFF_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  chaosDebuffsPicked = pool.slice(0, 3);
  for (const id of chaosDebuffsPicked) chaosDebuffs.add(id);
}

function chaosSpeedMultiplier(nowMs) {
  // 0.7 ~ 1.5 사이를 부드럽게 왕복
  const t = nowMs * 0.001;
  const n =
    (Math.sin(t * 0.82) + 0.6 * Math.sin(t * 1.73 + 1.2) + 0.3 * Math.sin(t * 3.9 + 0.7)) /
    1.9; // 대략 -1 ~ 1
  return clamp(1.1 + n * 0.4, 0.7, 1.5);
}

function chaosHash01(x) {
  const s = Math.sin(x) * 10000;
  return s - Math.floor(s);
}

function chaosDebuffLabel(id) {
  switch (id) {
    case 'tight_gap': return '장애물 간격 감소';
    case 'long_snake': return '뱀 길이 1.5배';
    case 'obs_glitch': return '장애물 글리치';
    case 'speed_flux': return '이동속도 유동';
    case 'turn_inertia': return '회전 관성 증가';
    case 'combo_short': return '콤보 유지시간 감소';
    case 'tight_collision': return '충돌 판정 강화';
    case 'no_half_point': return '기본점수 구간 축소';
    case 'small_safe_zone': return '안전구역 축소';
    case 'moving_obs_boost': return '이동 장애물 강화';
    default: return '';
  }
}

function easeOutCubic(t) {
  const p = clamp(t, 0, 1);
  return 1 - Math.pow(1 - p, 3);
}

function drawChaosDebuffHud(ctx, nowMs, { dimBackground }) {
  const aLabel = chaosDebuffLabel(chaosDebuffsPicked[0] || '');
  const bLabel = chaosDebuffLabel(chaosDebuffsPicked[1] || '');
  const cLabel = chaosDebuffLabel(chaosDebuffsPicked[2] || '');
  const line1 = '- ' + (aLabel || '-');
  const line2 = '- ' + (bLabel || '-');
  const line3 = '- ' + (cLabel || '-');

  const introActive = gameMode === 'chaos' && chaosIntroUntil > 0 && nowMs < chaosIntroUntil;
  const transitionStart = Math.max(0, chaosIntroUntil - 900);
  const tr =
    chaosIntroUntil > 0
      ? (nowMs >= chaosIntroUntil
          ? 1
          : nowMs >= transitionStart
            ? easeOutCubic((nowMs - transitionStart) / 900)
            : 0)
      : 1;

  // Center → Top-left (left-anchor 고정: 화면 밖으로 "넘어갔다가" 보이는 현상 방지)
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 + 2;
  const tx = 16;
  const ty = 34;

  const fontSize = 22 + (14 - 22) * tr; // 작아짐
  const alpha = introActive ? (0.78 * (0.9 + 0.1 * (1 - tr))) : 0.82;

  ctx.save();

  if (dimBackground) {
    const remain = chaosIntroUntil - nowMs;
    const a = clamp(remain / 450, 0, 1);
    ctx.globalAlpha = 0.62 * (0.65 + 0.35 * a);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(fontSize)}px Nunito, sans-serif`;

  const w1 = ctx.measureText(line1).width;
  const w2 = ctx.measureText(line2).width;
  const w3 = ctx.measureText(line3).width;
  const maxW = Math.max(w1, w2, w3);
  const lh = fontSize * 1.15;

  // 처음·끝 모두 동일한 3줄 간격 — 중앙 블록 중심 → 좌상단 최종 위치로 한 번에 이동
  const startX = Math.max(8, cx - maxW / 2);
  const startY = cy - lh;
  const x = startX + (tx - startX) * tr;
  const y = startY + (ty - startY) * tr;

  ctx.fillText(line1, x, y);
  ctx.fillText(line2, x, y + lh);
  ctx.fillText(line3, x, y + lh * 2);

  ctx.restore();
}

const PRACTICE_SETTINGS_KEY = 'snakombo_practice_settings_v1';
const PRACTICE_PANEL_UI_KEY = 'snakombo_practice_panel_ui_v1';
const practiceSettings = {
  speedMult: 1,
  turnMult: 1,
  spawnRateMult: 1,
  comboHoldMult: 1,
  invincible: false
};
let practiceRespawnInvulnUntil = 0;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

let practicePanelCollapsed = false;

function loadPracticePanelUiState() {
  try {
    const raw = localStorage.getItem(PRACTICE_PANEL_UI_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.collapsed === 'boolean') practicePanelCollapsed = obj.collapsed;
  } catch (_) {}
}

function savePracticePanelUiState() {
  try {
    localStorage.setItem(
      PRACTICE_PANEL_UI_KEY,
      JSON.stringify({ collapsed: !!practicePanelCollapsed })
    );
  } catch (_) {}
}

function loadPracticeSettings() {
  try {
    const raw = localStorage.getItem(PRACTICE_SETTINGS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return;
    if (Number.isFinite(obj.speedMult)) practiceSettings.speedMult = clamp(obj.speedMult, 0.5, 3);
    if (Number.isFinite(obj.turnMult)) practiceSettings.turnMult = clamp(obj.turnMult, 0.5, 3);
    if (Number.isFinite(obj.spawnRateMult)) practiceSettings.spawnRateMult = clamp(obj.spawnRateMult, 0.5, 3);
    if (Number.isFinite(obj.comboHoldMult)) practiceSettings.comboHoldMult = clamp(obj.comboHoldMult, 0.5, 3);
    if (typeof obj.invincible === 'boolean') practiceSettings.invincible = obj.invincible;
  } catch (_) {}
}

function savePracticeSettings() {
  try {
    localStorage.setItem(PRACTICE_SETTINGS_KEY, JSON.stringify(practiceSettings));
  } catch (_) {}
}

function isPracticeRun() {
  return gameRunning && !tutorialMode && gameMode === 'practice';
}

function respawnPracticeRun() {
  // "무적": 게임오버 대신 중앙에서 다시 시작(장애물은 유지)
  const cx = snakeStartCenterX();
  const cy = canvas.height / 2;
  angle = 0;
  spreadSnakeAtCenter(cx, cy, angle);
  currentSpeed = getRunBaseSpeed();
  combo = 0;
  lastScoreTime = 0;
  // 장애물/스폰 상태는 그대로 유지한다.
  // (리스폰 직후 즉사 방지용 짧은 유예는 아래 타임스탬프로 처리)
  scoreStart = performance.now();
  gameStartDelayUntil = performance.now() + 200;
  practiceRespawnInvulnUntil = performance.now() + 650;
}

const TUTORIAL_S1_TEXT1_MS = 520;
const TUTORIAL_S1_CHALLENGE_ENTER_MS = 300;
const TUTORIAL_S1_SUCCESS_MS = 1100;
const TUTORIAL_S2_TARGET = 4;
const TUTORIAL_S3_TARGET = 5;
/** 2·3단계 설명 글자 표시 시간 */
const TUTORIAL_S2_S3_INTRO_MS = 3000;
/** 업적 통행금지: 반대편 체류 허용 상한(ms) */
const ACHIEVEMENT_HALF_LANE_GRACE_MS = 2000;

/** intro(3초) → play → complete */
let tutorialStep2State = 'intro';
let tutorialS2_introUntil = 0;
let tutorialS2_passCount = 0;

/** intro(3초) → play(5콤보) → complete */
let tutorialStep3State = 'intro';
let tutorialS3_introUntil = 0;

// Offscreen canvas for metaball rendering
const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d');

function createObstacleShape() {
  const circles = [];
  const type = Math.random();
  const gs = (v) => v * GAME_SCALE;

  if (type < 0.2) {
    // Long chain: 4-7 circles in a sharply curving line with size variation
    const count = 4 + Math.floor(Math.random() * 4);
    let dir = Math.random() * Math.PI * 2;
    let ox = 0, oy = 0;
    for (let j = 0; j < count; j++) {
      const t = j / (count - 1);
      const r = gs(15 + Math.random() * 20 + Math.sin(t * Math.PI) * 20); // bulge in middle
      circles.push({ ox, oy, r });
      dir += (Math.random() - 0.5) * 2.0; // sharper curves
      const step = r * 0.5 + gs(10 + Math.random() * 10);
      ox += Math.cos(dir) * step;
      oy += Math.sin(dir) * step;
    }
  } else if (type < 0.4) {
    // Big body + varied satellites at different distances
    const r1 = gs(50 + Math.random() * 40);
    circles.push({ ox: 0, oy: 0, r: r1 });
    const satCount = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < satCount; j++) {
      const r = gs(12 + Math.random() * 28);
      const dir = (j / satCount) * Math.PI * 2 + (Math.random() - 0.5) * 1.0;
      const dist = r1 * (0.4 + Math.random() * 0.4) + r * 0.3;
      circles.push({ ox: Math.cos(dir) * dist, oy: Math.sin(dir) * dist, r });
      // Sub-satellite branching off
      if (Math.random() < 0.4) {
        const rs = gs(10 + Math.random() * 15);
        const dir2 = dir + (Math.random() - 0.5) * 1.5;
        const dist2 = dist + r * 0.5 + rs * 0.3;
        circles.push({ ox: Math.cos(dir2) * dist2, oy: Math.sin(dir2) * dist2, r: rs });
      }
    }
  } else if (type < 0.6) {
    // Y/X-fork: center + 3-4 branches with varying lengths
    const r1 = gs(30 + Math.random() * 25);
    circles.push({ ox: 0, oy: 0, r: r1 });
    const branchCount = 3 + (Math.random() < 0.4 ? 1 : 0); // 3 or 4 branches
    const baseAngle = Math.random() * Math.PI * 2;
    for (let j = 0; j < branchCount; j++) {
      const dir = baseAngle + j * (Math.PI * 2 / branchCount) + (Math.random() - 0.5) * 0.7;
      const segments = 1 + Math.floor(Math.random() * 3); // 1-3 segments per branch
      let bx = 0, by = 0;
      let prevR = r1;
      for (let s = 0; s < segments; s++) {
        const r = Math.max(gs(12), prevR * (0.6 + Math.random() * 0.3));
        const dist = prevR * 0.4 + r * 0.4 + gs(Math.random() * 8);
        const sdir = dir + (Math.random() - 0.5) * 0.6;
        bx += Math.cos(sdir) * dist;
        by += Math.sin(sdir) * dist;
        circles.push({ ox: bx, oy: by, r });
        prevR = r;
      }
    }
  } else if (type < 0.8) {
    // Dumbbell/triplet: 2-3 big circles with thin connectors
    const nodeCount = 2 + (Math.random() < 0.4 ? 1 : 0);
    let dir = Math.random() * Math.PI * 2;
    let ox = 0, oy = 0;
    let prevR = gs(35 + Math.random() * 30);
    circles.push({ ox, oy, r: prevR });
    for (let j = 1; j < nodeCount; j++) {
      const r = gs(35 + Math.random() * 30);
      dir += (Math.random() - 0.5) * 1.5;
      const gap = prevR * 0.5 + r * 0.5 + gs(15 + Math.random() * 20);
      ox += Math.cos(dir) * gap;
      oy += Math.sin(dir) * gap;
      circles.push({ ox, oy, r });
      // Thin connector(s) between nodes
      const steps = 1 + Math.floor(Math.random() * 2);
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const rc = gs(10 + Math.random() * 12);
        const cx = circles[circles.length - 2].ox * (1 - t) + ox * t;
        const cy = circles[circles.length - 2].oy * (1 - t) + oy * t;
        circles.push({ ox: cx + gs((Math.random() - 0.5) * 8), oy: cy + gs((Math.random() - 0.5) * 8), r: rc });
      }
      prevR = r;
    }
  } else {
    // Cluster blob: dense chaotic spread with size extremes
    const r1 = gs(40 + Math.random() * 35);
    circles.push({ ox: 0, oy: 0, r: r1 });
    const extraCount = 3 + Math.floor(Math.random() * 5);
    let baseDir = Math.random() * Math.PI * 2;
    for (let j = 0; j < extraCount; j++) {
      const prev = circles[Math.floor(Math.random() * circles.length)];
      const r = gs(12 + Math.random() * 35);
      const dir = baseDir + (Math.random() - 0.5) * 3.0;
      const dist = prev.r * 0.3 + r * 0.3 + gs(Math.random() * 20);
      circles.push({
        ox: prev.ox + Math.cos(dir) * dist,
        oy: prev.oy + Math.sin(dir) * dist,
        r
      });
      baseDir += 0.5 + Math.random() * 1.8;
    }
  }
  return circles;
}

function getMinGapForMode() {
  // 하드: 장애물 간격을 3.5머리로 더 촘촘하게
  if (gameMode === 'hard') return HEAD_WIDTH * 3.5;
  if (chaosHasDebuff('tight_gap')) return HEAD_WIDTH * 3;
  return MIN_GAP;
}

function getScoreForMovingObstacleSpawn() {
  return score;
}

function getMovingObstacleScoreThreshold() {
  if (chaosHasDebuff('moving_obs_boost')) return MOVING_OBS_SCORE_THRESHOLD_BOOST;
  return MOVING_OBS_SCORE_THRESHOLD;
}

function getMovingObstacleSpawnChance(runScore) {
  const threshold = getMovingObstacleScoreThreshold();
  if (runScore < threshold) return 0;
  const base = gameMode === 'hard' ? MOVING_OBS_BASE_CHANCE_HARD : MOVING_OBS_BASE_CHANCE;
  return Math.min(
    1,
    base + Math.floor((runScore - threshold) / 5) * MOVING_OBS_CHANCE_STEP
  );
}

function shouldTryMovingObstacleSpawn() {
  if (tutorialMode) return false;
  const runScore = getScoreForMovingObstacleSpawn();
  if (runScore < getMovingObstacleScoreThreshold()) return false;
  return Math.random() < getMovingObstacleSpawnChance(runScore);
}

function getCirclesBounds(circles) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of circles) {
    minX = Math.min(minX, c.ox - c.r);
    minY = Math.min(minY, c.oy - c.r);
    maxX = Math.max(maxX, c.ox + c.r);
    maxY = Math.max(maxY, c.oy + c.r);
  }
  return { minX, minY, maxX, maxY };
}

function mergeForbiddenIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.lo - b.lo);
  const out = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i];
    const last = out[out.length - 1];
    if (cur.lo <= last.hi) last.hi = Math.max(last.hi, cur.hi);
    else out.push(cur);
  }
  return out;
}

function largestAllowedTravelSegment(tLo, tHi, forbidden) {
  if (tLo > tHi) return null;
  let best = null;
  let curLo = tLo;
  for (const f of forbidden) {
    const segLo = curLo;
    const segHi = Math.min(f.lo, tHi);
    if (segHi > segLo) {
      const len = segHi - segLo;
      if (!best || len > best.hi - best.lo) best = { lo: segLo, hi: segHi };
    }
    curLo = Math.max(curLo, f.hi);
  }
  if (tHi > curLo) {
    const len = tHi - curLo;
    if (!best || len > best.hi - best.lo) best = { lo: curLo, hi: tHi };
  }
  if (!best || best.hi - best.lo < MOVING_OBS_CLEARANCE * 2) return null;
  return best;
}

/** 월드 좌표 기준 벽·다른 장애물과 머리×2 간격 유지 여부 */
function movingObsClearanceOkAtWorld(circles, originX, originY, selfObs, otherObsList) {
  const b = getCirclesBounds(circles);
  if (originX + b.minX < MOVING_OBS_CLEARANCE) return false;
  if (originY + b.minY < MOVING_OBS_CLEARANCE) return false;
  if (originX + b.maxX > canvas.width - MOVING_OBS_CLEARANCE) return false;
  if (originY + b.maxY > canvas.height - MOVING_OBS_CLEARANCE) return false;
  for (const other of otherObsList) {
    if (other === selfObs || other.fadeOut) continue;
    for (const c1 of circles) {
      for (const ec of other.circles) {
        const dx = originX + c1.ox - (other.x + ec.ox);
        const dy = originY + c1.oy - (other.y + ec.oy);
        const dist = Math.sqrt(dx * dx + dy * dy) - c1.r - ec.r;
        if (dist < MOVING_OBS_CLEARANCE) return false;
      }
    }
  }
  return true;
}

function movingObsClearanceOkAtT(baseX, baseY, circles, ux, uy, t, otherObsList) {
  return movingObsClearanceOkAtWorld(
    circles,
    baseX + t * ux,
    baseY + t * uy,
    null,
    otherObsList
  );
}

/** 허용 구간 안에서 고정 길이 왕복 구간 [lo,hi] 선택 (전 구간 간격 검증) */
function pickFixedPingPongSegment(baseX, baseY, circles, ux, uy, allowed, otherObsList) {
  const avail = allowed.hi - allowed.lo;
  const minNeed = MOVING_OBS_CLEARANCE * 2;
  if (avail < minNeed) return null;
  const maxLen = Math.min(avail, MOVING_OBS_TRAVEL_LEN_MAX);
  const minLen = Math.max(minNeed, Math.min(MOVING_OBS_TRAVEL_LEN_MIN, maxLen));

  for (let attempt = 0; attempt < 40; attempt++) {
    const pathLen = minLen + Math.random() * (maxLen - minLen);
    const tStart = allowed.lo + Math.random() * (avail - pathLen);
    const tEnd = tStart + pathLen;
    let ok = true;
    const samples = 7;
    for (let s = 0; s <= samples; s++) {
      const t = tStart + (pathLen * s) / samples;
      if (!movingObsClearanceOkAtT(baseX, baseY, circles, ux, uy, t, otherObsList)) {
        ok = false;
        break;
      }
    }
    if (ok) return { lo: tStart, hi: tEnd };
  }
  return null;
}

function collectMovingForbiddenIntervalsVector(baseX, baseY, circles, ux, uy, otherObsList) {
  const forbidden = [];
  for (const other of otherObsList) {
    if (other.fadeOut) continue;
    for (const c1 of circles) {
      for (const ec of other.circles) {
        const A0 = baseX + c1.ox - (other.x + ec.ox);
        const B0 = baseY + c1.oy - (other.y + ec.oy);
        const dot = A0 * ux + B0 * uy;
        const C0 = A0 * A0 + B0 * B0;
        const R = c1.r + ec.r + MOVING_OBS_CLEARANCE;
        const disc = dot * dot - C0 + R * R;
        if (disc < 0) continue;
        const s = Math.sqrt(disc);
        forbidden.push({ lo: -dot - s, hi: -dot + s });
      }
    }
  }
  return mergeForbiddenIntervals(forbidden);
}

function applyWallTravelLimit(tLo, tHi, base, relEdge, bound, dir, isMinEdge) {
  const edgeAt0 = base + relEdge;
  if (Math.abs(dir) < 1e-6) {
    if (isMinEdge && edgeAt0 < bound) return null;
    if (!isMinEdge && edgeAt0 > bound) return null;
    return { lo: tLo, hi: tHi };
  }
  const tEdge = (bound - base - relEdge) / dir;
  let lo = tLo;
  let hi = tHi;
  if (dir > 0) {
    if (isMinEdge) lo = Math.max(lo, tEdge);
    else hi = Math.min(hi, tEdge);
  } else {
    if (isMinEdge) hi = Math.min(hi, tEdge);
    else lo = Math.max(lo, tEdge);
  }
  if (lo > hi) return null;
  return { lo, hi };
}

function computeMovingTravelRangeVector(baseX, baseY, circles, ux, uy, otherObsList) {
  const b = getCirclesBounds(circles);
  let tLo = -Infinity;
  let tHi = Infinity;
  const steps = [
    [baseX, b.minX, MOVING_OBS_CLEARANCE, ux, true],
    [baseX, b.maxX, canvas.width - MOVING_OBS_CLEARANCE, ux, false],
    [baseY, b.minY, MOVING_OBS_CLEARANCE, uy, true],
    [baseY, b.maxY, canvas.height - MOVING_OBS_CLEARANCE, uy, false]
  ];
  for (const [base, rel, bound, dir, isMin] of steps) {
    const next = applyWallTravelLimit(tLo, tHi, base, rel, bound, dir, isMin);
    if (!next) return null;
    tLo = next.lo;
    tHi = next.hi;
  }
  return largestAllowedTravelSegment(
    tLo,
    tHi,
    collectMovingForbiddenIntervalsVector(baseX, baseY, circles, ux, uy, otherObsList)
  );
}

function pickMovingObstacleTravelFallback(baseX, baseY, circles, ux, uy, otherObsList) {
  const allowed = computeMovingTravelRangeVector(baseX, baseY, circles, ux, uy, otherObsList);
  if (!allowed) return null;
  const avail = allowed.hi - allowed.lo;
  const minNeed = MOVING_OBS_CLEARANCE * 2;
  if (avail < minNeed) return null;
  const pathLen = Math.min(MOVING_OBS_TRAVEL_LEN_MIN, avail);
  const tStart = allowed.lo + (avail - pathLen) * 0.5;
  const tEnd = tStart + pathLen;
  if (
    movingObsClearanceOkAtT(baseX, baseY, circles, ux, uy, tStart, otherObsList) &&
    movingObsClearanceOkAtT(baseX, baseY, circles, ux, uy, tEnd, otherObsList)
  ) {
    return { ux, uy, lo: tStart, hi: tEnd };
  }
  return null;
}

function pickMovingObstacleTravel(baseX, baseY, circles, otherObsList) {
  const tryDir = (ux, uy) => {
    const allowed = computeMovingTravelRangeVector(baseX, baseY, circles, ux, uy, otherObsList);
    if (!allowed) return null;
    const fixed = pickFixedPingPongSegment(baseX, baseY, circles, ux, uy, allowed, otherObsList);
    if (fixed) return { ux, uy, ...fixed };
    return pickMovingObstacleTravelFallback(baseX, baseY, circles, ux, uy, otherObsList);
  };

  const cardinals = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (let i = cardinals.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = cardinals[i];
    cardinals[i] = cardinals[j];
    cardinals[j] = tmp;
  }
  for (const [ux, uy] of cardinals) {
    const seg = tryDir(ux, uy);
    if (seg) return seg;
  }

  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const seg = tryDir(Math.cos(angle), Math.sin(angle));
    if (seg) return seg;
  }
  return null;
}

function pushObstacleAt(x, y, circles, extra) {
  const isGolden =
    !tutorialMode &&
    (GOLDEN_OBS_ENABLED_IN_PRACTICE ? true : gameMode !== 'practice') &&
    gameMode !== 'multi' &&
    (GOLDEN_OBS_FORCE_TEST || Math.random() < GOLDEN_OBS_CHANCE);
  staticObs.push({
    x,
    y,
    circles,
    fadeIn: 36,
    _gid: Math.random() * 1e9,
    isGolden,
    _chaosGlitchTarget: chaosHasDebuff('obs_glitch') ? Math.random() < 1 / 3 : false,
    ...extra
  });
}

function findObstacleSpawnPosition(circles, minGapToObs) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of circles) {
    minX = Math.min(minX, c.ox - c.r);
    minY = Math.min(minY, c.oy - c.r);
    maxX = Math.max(maxX, c.ox + c.r);
    maxY = Math.max(maxY, c.oy + c.r);
  }
  const pad = 30;
  const scoreUiRect = !tutorialMode
    ? {
        x1: canvas.width * 0.5 - 190,
        y1: 0,
        x2: canvas.width * 0.5 + 190,
        y2: 104
      }
    : null;
  const safeDist =
    chaosHasDebuff('small_safe_zone') ? Math.max(70, SNAKE_SAFE_DIST * 0.42) : SNAKE_SAFE_DIST;

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = -minX + pad + Math.random() * (canvas.width - (maxX - minX) - pad * 2);
    const y = -minY + pad + Math.random() * (canvas.height - (maxY - minY) - pad * 2);
    if (scoreUiRect) {
      const bx1 = x + minX;
      const by1 = y + minY;
      const bx2 = x + maxX;
      const by2 = y + maxY;
      const intersects =
        bx1 < scoreUiRect.x2 &&
        bx2 > scoreUiRect.x1 &&
        by1 < scoreUiRect.y2 &&
        by2 > scoreUiRect.y1;
      if (intersects) continue;
    }
    let tooCloseToSnake = false;
    for (let i = 0; i < getRunSegmentCount(); i++) {
      for (const c of circles) {
        const dx = x + c.ox - points[i].x;
        const dy = y + c.oy - points[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < c.r + safeDist) {
          tooCloseToSnake = true;
          break;
        }
      }
      if (tooCloseToSnake) break;
    }
    if (!tooCloseToSnake && localPlayEnabled && localSnakeGray.points && localSnakeGray.points.length >= getRunSegmentCount()) {
      for (let i = 0; i < getRunSegmentCount(); i++) {
        for (const c of circles) {
          const dx = x + c.ox - localSnakeGray.points[i].x;
          const dy = y + c.oy - localSnakeGray.points[i].y;
          if (Math.sqrt(dx * dx + dy * dy) < c.r + safeDist) {
            tooCloseToSnake = true;
            break;
          }
        }
        if (tooCloseToSnake) break;
      }
    }
    if (tooCloseToSnake) continue;

    let tooCloseToObs = false;
    for (const obs of staticObs) {
      for (const ec of obs.circles) {
        for (const nc of circles) {
          const dx = obs.x + ec.ox - (x + nc.ox);
          const dy = obs.y + ec.oy - (y + nc.oy);
          const dist = Math.sqrt(dx * dx + dy * dy) - ec.r - nc.r;
          if (dist < minGapToObs) {
            tooCloseToObs = true;
            break;
          }
        }
        if (tooCloseToObs) break;
      }
      if (tooCloseToObs) break;
    }
    if (tooCloseToObs) continue;
    return { x, y };
  }
  return null;
}

function countObstaclesOnField() {
  let n = 0;
  for (const obs of staticObs) {
    if (obs.fadeOut > 0) continue;
    n++;
  }
  return n;
}

function commitMovingObstacle(pos, circles, travel) {
  const moveSpeed =
    (MOVING_OBS_SPEED_MIN + Math.random() * (MOVING_OBS_SPEED_MAX - MOVING_OBS_SPEED_MIN)) *
    MOVING_OBS_SPEED_MULT;
  const moveBaseX = pos.x - travel.lo * travel.ux;
  const moveBaseY = pos.y - travel.lo * travel.uy;
  pushObstacleAt(pos.x, pos.y, circles, {
    isMoving: true,
    moveUx: travel.ux,
    moveUy: travel.uy,
    moveBaseX,
    moveBaseY,
    moveT: travel.lo,
    moveTLo: travel.lo,
    moveTHi: travel.hi,
    moveDir: 1,
    moveSpeed
  });
}

function trySpawnMovingObstacle() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const circles = createObstacleShape();
    const pos = findObstacleSpawnPosition(circles, MOVING_OBS_CLEARANCE);
    if (!pos) continue;
    const travel = pickMovingObstacleTravel(pos.x, pos.y, circles, staticObs);
    if (!travel) continue;
    commitMovingObstacle(pos, circles, travel);
    return true;
  }
  return false;
}

function updateMovingObstacles(frameFactor) {
  for (const obs of staticObs) {
    if (!obs.isMoving || obs.fadeOut > 0) continue;

    const tryAdvance = (dir) => {
      let nextT = obs.moveT + dir * obs.moveSpeed * frameFactor;
      if (nextT > obs.moveTHi) nextT = obs.moveTHi;
      else if (nextT < obs.moveTLo) nextT = obs.moveTLo;
      const nextX = obs.moveBaseX + nextT * obs.moveUx;
      const nextY = obs.moveBaseY + nextT * obs.moveUy;
      if (!movingObsClearanceOkAtWorld(obs.circles, nextX, nextY, obs, staticObs)) {
        return null;
      }
      return { nextT, nextX, nextY };
    };

    let moved = tryAdvance(obs.moveDir);
    if (!moved) {
      obs.moveDir = -obs.moveDir;
      moved = tryAdvance(obs.moveDir);
    }
    if (!moved) continue;

    obs.moveT = moved.nextT;
    if (obs.moveT >= obs.moveTHi) obs.moveDir = -1;
    else if (obs.moveT <= obs.moveTLo) obs.moveDir = 1;
    obs.x = moved.nextX;
    obs.y = moved.nextY;
  }
}

function trySpawnObstacle() {
  if (countObstaclesOnField() >= MAX_OBSTACLES) return;

  if (shouldTryMovingObstacleSpawn()) {
    if (trySpawnMovingObstacle()) return;
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const circles = createObstacleShape();
    const pos = findObstacleSpawnPosition(circles, getMinGapForMode());
    if (!pos) continue;
    pushObstacleAt(pos.x, pos.y, circles, {});
    return;
  }
}

function ensureTutorialStep2Obstacles(n) {
  let guard = 0;
  while (staticObs.length < n && guard < 400) {
    trySpawnObstacle();
    guard++;
  }
}

// Pre-render metaball to a cached canvas (called once per obstacle at spawn)
function bakeMetaball(obs) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of obs.circles) {
    minX = Math.min(minX, c.ox - c.r);
    minY = Math.min(minY, c.oy - c.r);
    maxX = Math.max(maxX, c.ox + c.r);
    maxY = Math.max(maxY, c.oy + c.r);
  }
  const pad = 30;
  const bw = Math.ceil(maxX - minX + pad * 2);
  const bh = Math.ceil(maxY - minY + pad * 2);
  const bakeCanvas = document.createElement('canvas');
  bakeCanvas.width = bw;
  bakeCanvas.height = bh;
  const bCtx = bakeCanvas.getContext('2d');

  bCtx.filter = 'blur(18px)';
  bCtx.fillStyle = '#fff';
  for (const c of obs.circles) {
    bCtx.beginPath();
    bCtx.arc(c.ox - minX + pad, c.oy - minY + pad, c.r, 0, Math.PI * 2);
    bCtx.fill();
  }
  bCtx.filter = 'none';

  const imgData = bCtx.getImageData(0, 0, bw, bh);
  const d = imgData.data;
  for (let j = 3; j < d.length; j += 4) {
    d[j] = d[j] > 100 ? 255 : 0;
  }
  bCtx.putImageData(imgData, 0, 0);

  obs._cache = bakeCanvas;
  obs._offX = minX - pad;
  obs._offY = minY - pad;

  // 이동 장애물: 일반보다 아주 살짝 어두운 톤
  if (obs.isMoving && !obs.isGolden) {
    const darkCanvas = document.createElement('canvas');
    darkCanvas.width = bw;
    darkCanvas.height = bh;
    const dCtx = darkCanvas.getContext('2d');
    dCtx.drawImage(bakeCanvas, 0, 0);
    dCtx.globalCompositeOperation = 'source-in';
    dCtx.fillStyle = '#5a5a5a';
    dCtx.fillRect(0, 0, bw, bh);
    dCtx.globalCompositeOperation = 'source-over';
    obs._cacheMoving = darkCanvas;
  }

  // Golden obstacles: pre-bake tinted body + subtle glow once (avoid per-frame shadow/composite cost).
  if (obs.isGolden) {
    const goldCanvas = document.createElement('canvas');
    goldCanvas.width = bw;
    goldCanvas.height = bh;
    const gCtx = goldCanvas.getContext('2d');
    gCtx.drawImage(bakeCanvas, 0, 0);
    gCtx.globalCompositeOperation = 'source-in';
    gCtx.fillStyle = '#fbbf24';
    gCtx.fillRect(0, 0, bw, bh);
    gCtx.globalCompositeOperation = 'source-over';
    obs._cacheGolden = goldCanvas;

    // Slight outer glow (small spread outside)
    const outerPad = 70;
    const outerCanvas = document.createElement('canvas');
    outerCanvas.width = bw + outerPad * 2;
    outerCanvas.height = bh + outerPad * 2;
    const oCtx = outerCanvas.getContext('2d');
    oCtx.globalAlpha = 0.22;
    oCtx.shadowColor = 'rgba(255, 214, 102, 0.55)';
    oCtx.shadowBlur = 34;
    oCtx.shadowOffsetX = 0;
    oCtx.shadowOffsetY = 0;
    oCtx.drawImage(bakeCanvas, outerPad, outerPad);
    oCtx.globalCompositeOperation = 'source-in';
    oCtx.fillStyle = 'rgba(255, 214, 102, 0.55)';
    oCtx.fillRect(outerPad, outerPad, bw, bh);
    oCtx.globalCompositeOperation = 'source-over';
    oCtx.globalAlpha = 1;
    obs._cacheGoldenOuterGlow = outerCanvas;
    obs._cacheGoldenOuterGlowPad = outerPad;

    const glowCanvas = document.createElement('canvas');
    // Inner neon glow (kept inside the obstacle silhouette)
    glowCanvas.width = bw;
    glowCanvas.height = bh;
    const glCtx = glowCanvas.getContext('2d');

    // 1) Base inner glow color inside mask
    glCtx.drawImage(bakeCanvas, 0, 0);
    glCtx.globalCompositeOperation = 'source-in';
    glCtx.fillStyle = 'rgba(255, 230, 120, 1)';
    glCtx.fillRect(0, 0, bw, bh);

    // 2) Blur it, then clip again to keep it strictly inside (neon core)
    const tmp = document.createElement('canvas');
    tmp.width = bw;
    tmp.height = bh;
    const tCtx = tmp.getContext('2d');
    tCtx.filter = 'blur(10px)';
    tCtx.globalAlpha = 0.95;
    tCtx.drawImage(glowCanvas, 0, 0);
    tCtx.filter = 'none';
    tCtx.globalAlpha = 1;

    glCtx.globalCompositeOperation = 'source-over';
    glCtx.clearRect(0, 0, bw, bh);
    glCtx.globalCompositeOperation = 'lighter';
    glCtx.globalAlpha = 0.95;
    glCtx.drawImage(tmp, 0, 0);
    glCtx.globalAlpha = 0.55;
    glCtx.drawImage(tmp, 0, 0);
    // clip to obstacle mask
    glCtx.globalAlpha = 1;
    glCtx.globalCompositeOperation = 'destination-in';
    glCtx.drawImage(bakeCanvas, 0, 0);
    glCtx.globalCompositeOperation = 'source-over';

    obs._cacheGoldenGlow = glowCanvas;
    obs._cacheGoldenGlowPad = 0;
  }
}

function drawMetaballObstacle(obs) {
  if (!obs._cache) bakeMetaball(obs);
  const dx = obs.x + obs._offX;
  const dy = obs.y + obs._offY;
  if (obs.isGolden && obs._cacheGolden) {
    if (obs._cacheGoldenOuterGlow) {
      const op = obs._cacheGoldenOuterGlowPad || 0;
      ctx.drawImage(obs._cacheGoldenOuterGlow, dx - op, dy - op);
    }
    if (obs._cacheGoldenGlow) {
      const gp = obs._cacheGoldenGlowPad || 0;
      ctx.drawImage(obs._cacheGoldenGlow, dx - gp, dy - gp);
    }
    ctx.drawImage(obs._cacheGolden, dx, dy);
    return;
  }
  if (obs.isMoving && obs._cacheMoving) {
    ctx.drawImage(obs._cacheMoving, dx, dy);
    return;
  }
  ctx.drawImage(obs._cache, dx, dy);
}

function checkCollision(hx, hy, ccx, ccy, cr) {
  const dx = hx - ccx;
  const dy = hy - ccy;
  const forgive = chaosHasDebuff('tight_collision') ? 0 : 4; // 충돌 봐주기 제거(혼돈 디버프)
  const r = HEAD_RADIUS + cr - forgive;
  return (dx * dx + dy * dy) < (r * r);
}

/** 머리 방향 moveAngle 기준, 몸이 이미 펼쳐진 직선으로 (cx,cy)를 가운데에 두고 배치 */
function spreadSnakePointsAtCenter(pts, cx, cy, moveAngle) {
  const cosA = Math.cos(moveAngle);
  const sinA = Math.sin(moveAngle);
  const n = getRunSegmentCount();
  const totalLen = (n - 1) * runSegmentDist;
  const hx = cx + (totalLen * 0.5) * cosA;
  const hy = cy + (totalLen * 0.5) * sinA;
  for (let i = 0; i < n; i++) {
    pts[i].x = hx - i * runSegmentDist * cosA;
    pts[i].y = hy - i * runSegmentDist * sinA;
  }
}

function ensureLocalGraySnakePoints() {
  if (localSnakeGray.points.length >= SEGMENTS_CHAOS_LONG) return;
  localSnakeGray.points = [];
  for (let i = 0; i < SEGMENTS_CHAOS_LONG; i++) localSnakeGray.points.push({ x: 0, y: 0 });
}

function spreadSnakeAtCenter(cx, cy, moveAngle) {
  angle = moveAngle;
  spreadSnakePointsAtCenter(points, cx, cy, moveAngle);
}

function snakeStartCenterX() {
  return canvas.width / 2 + SNAKE_START_X_OFFSET;
}

function restartTutorialStep3Challenge() {
  const cx = snakeStartCenterX();
  const cy = canvas.height / 2;
  spreadSnakeAtCenter(cx, cy, 0);
  currentSpeed = TUTORIAL_SNAKE_SPEED;
  scoreStart = performance.now();
  score = 0;
  spawnTimer = 0;
  combo = 0;
  lastScoreTime = 0;
  staticObs = [];
  floatingTexts = [];
  tutorialStep3State = 'play';
  ensureTutorialStep2Obstacles(TUTORIAL_S3_TARGET);
}

/** cause: 'self' = 머리·몸 자가충돌 (업적 카운트) */
function triggerGameOver(cause) {
  if (localPlayEnabled) {
    // Local mode uses explicit winner flow.
    gameOver = true;
    paused = false;
    return;
  }
  if (tutorialMode) {
    if (tutorialStep === 3) {
      restartTutorialStep3Challenge();
      gameOver = false;
      paused = false;
      return;
    }
    const cx = snakeStartCenterX();
    const cy = canvas.height / 2;
    spreadSnakeAtCenter(cx, cy, 0);
    currentSpeed = TUTORIAL_SNAKE_SPEED;
    scoreStart = performance.now();
    gameOver = false;
    paused = false;
    score = 0;
    spawnTimer = 0;
    floatingTexts = [];
    combo = 0;
    lastScoreTime = 0;
    if (tutorialStep === 2) {
      tutorialStep2State = 'play';
      tutorialS2_passCount = 0;
      staticObs = [];
      ensureTutorialStep2Obstacles(TUTORIAL_S2_TARGET);
    } else if (tutorialStep === 1 && tutorialStep1State === 'challenge') {
      const tNow = performance.now();
      tutorialS1_challengeAppearStart = tNow;
      tutorialS1_challengeEnd = tNow + TUTORIAL_S1_CHALLENGE_MS;
    } else {
      tutorialStep1State = 'await_keys';
      tutorialS1_text1FadeStart = 0;
      tutorialS1_challengeEnd = 0;
      tutorialS1_challengeAppearStart = 0;
      tutorialS1_successFadeStart = 0;
    }
    return;
  }
  // 기록(최고점): 일반/하드만 저장, 연습은 저장 안 함
  if (!tutorialMode && gameMode !== 'practice') {
    trySaveHighScore(score, gameMode);
  }
  // 업적: 연습 제외(일반/하드에서 반영). 개별 업적의 모드 제한은 checkAchievementsAfterRun에서 처리.
  if (!tutorialMode && gameMode !== 'practice') {
    checkAchievementsAfterRun(score, maxComboThisRun, comboBonusPointsThisRun);
    if (cause === 'self') {
      const n = incrementSelfDeathCount();
      if (n >= 15) unlockAchievement('hidden_tail_chain');
    }
    // 비늘 재화: 5점당 1개(내림). 하드/혼돈은 1.5배(내림). 연습/튜토리얼 제외. (예: 37점 → 일반 7 / 하드·혼돈 11)
    const scaleMult = (gameMode === 'hard' || gameMode === 'chaos') ? 1.5 : 1;
    addScales(Math.floor((score / 5) * scaleMult));
  }
  gameOver = true;
  paused = false;
}

function triggerLocalWin(winner, reason) {
  if (!localPlayEnabled) return;
  if (localWinner) return;
  localWinner = winner;
  localWinReason = reason || '';
  // Freeze end time at win moment (0.01s precision displayed in UI)
  localWinTimeSec = Math.max(0, (performance.now() - scoreStart) / 1000);
  gameOver = true;
  paused = false;
}

function triggerLocalDeath(victim, cause) {
  if (!localPlayEnabled) {
    triggerGameOver(cause);
    return;
  }
  if (localWinner) return;
  if (victim === 'white') triggerLocalWin('gray', 'death');
  else if (victim === 'gray') triggerLocalWin('white', 'death');
  else triggerLocalWin('white', 'death');
}

const HIGH_SCORE_KEY_LEGACY = 'snakombo_high_score';
const HIGH_SCORE_KEY_NORMAL = 'snakombo_high_score_normal_v1';
const HIGH_SCORE_KEY_HARD = 'snakombo_high_score_hard_v1';
const HIGH_SCORE_KEY_CHAOS = 'snakombo_high_score_chaos_v1';

function highScoreKeyForMode(mode) {
  if (mode === 'hard') return HIGH_SCORE_KEY_HARD;
  if (mode === 'chaos') return HIGH_SCORE_KEY_CHAOS;
  return HIGH_SCORE_KEY_NORMAL;
}

function readHighScoreFromKey(key) {
  try {
    const v = localStorage.getItem(key);
    if (v == null || v === '') return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function getHighScore(mode) {
  if (mode === 'normal' || mode === 'hard' || mode === 'chaos') {
    const v = readHighScoreFromKey(highScoreKeyForMode(mode));
    if (v > 0) return v;
    // 이전 버전(단일 키)에서 마이그레이션: 값이 있으면 normal로 간주
    if (mode === 'normal') return readHighScoreFromKey(HIGH_SCORE_KEY_LEGACY);
    return 0;
  }
  // 전체 기준(업적 등): normal/hard/chaos 중 최대값
  return Math.max(getHighScore('normal'), getHighScore('hard'), getHighScore('chaos'));
}

function trySaveHighScore(value, mode) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return;
  const m = mode === 'hard' ? 'hard' : mode === 'chaos' ? 'chaos' : 'normal';
  const key = highScoreKeyForMode(m);
  const prev = readHighScoreFromKey(key);
  if (n > prev) {
    try {
      localStorage.setItem(key, String(n));
    } catch (_) {}
  }
}

function migrateLegacyHighScoreIfNeeded() {
  // 예전 단일 최고기록 키가 있으면 normal로 이관(표시/업적 기준 유지)
  const legacy = readHighScoreFromKey(HIGH_SCORE_KEY_LEGACY);
  if (!(legacy > 0)) return;
  const normal = readHighScoreFromKey(HIGH_SCORE_KEY_NORMAL);
  if (normal <= 0) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY_NORMAL, String(legacy));
    } catch (_) {}
  }
  // 모드별 플레이 카운트가 없으면 표시가 0으로 나오는 걸 방지
  if (getModePlayCount('normal') <= 0) {
    try {
      localStorage.setItem(PLAY_COUNT_KEY_NORMAL, '1');
    } catch (_) {}
  }
}

const ACHIEVEMENTS_KEY = 'snakombo_achievements_v1';
const PRACTICE_PLAY_MS_KEY = 'snakombo_practice_play_ms_v1';
const PLAY_COUNT_KEY = 'snakombo_play_count';
const PLAY_COUNT_KEY_NORMAL = 'snakombo_play_count_normal_v1';
const PLAY_COUNT_KEY_HARD = 'snakombo_play_count_hard_v1';
const PLAY_COUNT_KEY_CHAOS = 'snakombo_play_count_chaos_v1';
const SELF_DEATH_COUNT_KEY = 'snakombo_self_death_count_v1';

function getSelfDeathCount() {
  try {
    const v = localStorage.getItem(SELF_DEATH_COUNT_KEY);
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function incrementSelfDeathCount() {
  const n = getSelfDeathCount() + 1;
  try {
    localStorage.setItem(SELF_DEATH_COUNT_KEY, String(n));
  } catch (_) {}
  return n;
}

function getPlayCount() {
  try {
    const v = localStorage.getItem(PLAY_COUNT_KEY);
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function getModePlayCount(mode) {
  const key =
    mode === 'hard'
      ? PLAY_COUNT_KEY_HARD
      : mode === 'chaos'
        ? PLAY_COUNT_KEY_CHAOS
        : PLAY_COUNT_KEY_NORMAL;
  try {
    const v = localStorage.getItem(key);
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function incrementPlayCount() {
  const n = getPlayCount() + 1;
  try {
    localStorage.setItem(PLAY_COUNT_KEY, String(n));
  } catch (_) {}
  return n;
}

function incrementModePlayCount(mode) {
  const m = mode === 'hard' ? 'hard' : mode === 'chaos' ? 'chaos' : 'normal';
  const key =
    m === 'hard' ? PLAY_COUNT_KEY_HARD : m === 'chaos' ? PLAY_COUNT_KEY_CHAOS : PLAY_COUNT_KEY_NORMAL;
  const n = getModePlayCount(m) + 1;
  try {
    localStorage.setItem(key, String(n));
  } catch (_) {}
  return n;
}

function getAchievementsUnlockedList() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAchievementsUnlockedList(ids) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(ids));
  } catch (_) {}
}

function syncAchievementCardDom(id) {
  const el = document.querySelector('[data-achievement-id="' + id + '"]');
  if (!el) return;
  el.classList.add('achievement-done');
  const reveal = el.getAttribute('data-reveal-desc');
  if (reveal) {
    const desc = el.querySelector('.achievement-desc');
    if (desc) {
      desc.textContent = reveal;
      desc.classList.remove('achievement-desc-hidden');
    }
  }
}

function showAchievementToastFromCardId(id) {
  const root = document.getElementById('achievement-toast-root');
  if (!root) return;
  const card = document.querySelector('[data-achievement-id="' + id + '"]');
  if (!card) return;

  // 업적 패널 카드 DOM을 그대로 복제해서 "완전히 동일"하게 표시
  const toast = card.cloneNode(true);
  toast.classList.add('achievement-toast');
  if (toast.classList.contains('achievement-hidden')) toast.classList.add('toast-hidden');
  else toast.classList.add('toast-normal');
  toast.setAttribute('role', 'status');
  toast.removeAttribute('tabindex');

  root.appendChild(toast);

  // 애니메이션 종료 후 제거
  setTimeout(() => {
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  }, 2600);
}

function reorderAchievementCards() {
  const container = document.querySelector('#achievements-panel .achievements-scroll');
  if (!container) return;
  const cards = Array.from(container.querySelectorAll('.achievement-card'));
  if (cards.length <= 1) return;
  const done = cards.filter(function (c) {
    return c.classList.contains('achievement-done');
  });
  const todo = cards.filter(function (c) {
    return !c.classList.contains('achievement-done');
  });
  const frag = document.createDocumentFragment();
  done.concat(todo).forEach(function (el) {
    frag.appendChild(el);
  });
  container.appendChild(frag);
}

function updateAchievementsProgressUi() {
  const el = document.getElementById('achievements-progress');
  if (!el) return;
  const cards = Array.from(document.querySelectorAll('#achievements-panel .achievement-card'));
  const total = cards.length;
  if (total <= 0) {
    el.textContent = '0%';
    return;
  }
  const done = cards.filter(c => c.classList.contains('achievement-done')).length;
  const pct = Math.round((done / total) * 100);
  el.textContent = '달성률 ' + String(pct) + '%';
}

function unlockAchievement(id) {
  // 연습 모드 중에는 업적 반영 금지
  if (
    isPracticeRun &&
    isPracticeRun() &&
    id !== 'practice_20min' &&
    id !== 'hidden_practice_500'
  ) {
    return false;
  }
  const set = new Set(getAchievementsUnlockedList());
  if (set.has(id)) return false;
  set.add(id);
  saveAchievementsUnlockedList([...set]);
  syncAchievementCardDom(id);
  showAchievementToastFromCardId(id);
  reorderAchievementCards();
  updateAchievementsProgressUi();
  return true;
}

function refreshAchievementsFromStorage() {
  for (const id of getAchievementsUnlockedList()) {
    syncAchievementCardDom(id);
  }
  reorderAchievementCards();
  updateAchievementsProgressUi();
}

/** 본편 최종 점수가 0보다 크고 완전제곱수(1,4,9,16,…)인지 — 부동소수 오차 허용 */
function isPerfectSquareFinalScore(fs) {
  if (!Number.isFinite(fs) || fs <= 0) return false;
  const root = Math.sqrt(fs);
  const k = Math.round(root);
  return k >= 1 && Math.abs(k * k - fs) < 1e-3;
}

/** 제제곱수 업적: 5를 넘는 완전제곱수(9,16,25,…) */
function isSquareScoreAboveFive(fs) {
  return isPerfectSquareFinalScore(fs) && fs > 5;
}

/** 본편 게임 오버 시 호출 (튜토리얼 제외) */
function checkAchievementsAfterRun(finalScore, maxCombo, comboBonusTotal) {
  const fs = typeof finalScore === 'number' ? finalScore : 0;
  const mc = typeof maxCombo === 'number' ? maxCombo : 0;
  const cb =
    typeof comboBonusTotal === 'number' && Number.isFinite(comboBonusTotal)
      ? comboBonusTotal
      : 0;
  if (fs >= 35 && gameMode === 'normal') unlockAchievement('score_35');
  if (mc >= 10) unlockAchievement('combo_10');
  if (mc < 5 && cb >= 25) unlockAchievement('tikkeul_taesan');
  {
    const h = new Date().getHours();
    if (h >= 7 && h < 8 && fs >= 15) unlockAchievement('hidden_early_bird');
  }
  if (getHighScore('normal') >= 85) unlockAchievement('high_60');
  {
    const rounded = Math.round(fs * 10) / 10;
    const isExactlySeven = Number.isFinite(fs) && rounded === 7;
    if (isExactlySeven) {
      consecutiveExactSevenGames += 1;
      if (consecutiveExactSevenGames >= 2) unlockAchievement('lucky_7_streak');
    } else {
      consecutiveExactSevenGames = 0;
    }
  }
  if (isSquareScoreAboveFive(fs)) {
    consecutiveSquareScoreGames += 1;
    if (consecutiveSquareScoreGames >= 3) unlockAchievement('square_streak_3');
  } else {
    consecutiveSquareScoreGames = 0;
  }
  if (
    fs >= 25 &&
    halfLaneLock !== null &&
    wrongHalfAccumMs <= ACHIEVEMENT_HALF_LANE_GRACE_MS
  ) {
    if (gameMode === 'normal') unlockAchievement('lane_forbidden_25');
  }
  if (fs >= 25 && !mainRunSteerDUsed) unlockAchievement('hidden_ace_a_only');
  if (gameMode === 'chaos' && Number.isFinite(fs) && fs >= 99) unlockAchievement('chaos_99');
  {
    const r44 = Math.round(fs * 10) / 10;
    if (gameMode === 'normal' && Number.isFinite(fs) && r44 === 44) unlockAchievement('devil_44');
    if (gameMode === 'hard' && Number.isFinite(fs) && r44 === 44) unlockAchievement('archdevil_44_hard');
  }
}

function formatScoreForMenu(n) {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(/\.0$/, '');
}

function updateMenuHighScoreDisplay() {
  const el = document.getElementById('menu-high-score');
  if (!el) return;
  if (gameMode === 'practice' || gameMode === 'multi') {
    el.textContent = '최고 기록 0점';
    el.classList.add('invisible');
    return;
  }
  el.classList.remove('invisible');
  if (gameMode === 'hard') {
    el.textContent =
      '최고 기록 ' +
      formatScoreForMenu(getModePlayCount('hard') > 0 ? getHighScore('hard') : 0) +
      '점';
    return;
  }
  if (gameMode === 'chaos') {
    el.textContent =
      '최고 기록 ' +
      formatScoreForMenu(getModePlayCount('chaos') > 0 ? getHighScore('chaos') : 0) +
      '점';
    return;
  }
  el.textContent =
    '최고 기록 ' +
    formatScoreForMenu(getModePlayCount('normal') > 0 ? getHighScore('normal') : 0) +
    '점';
}

function getStartLockRequirementText() {
  if (gameMode === 'hard') {
    if (getHighScore('normal') < 50) {
      return '<span class="mode-normal">일반</span> 최고기록 50점 이상 필요';
    }
  } else if (gameMode === 'chaos') {
    if (getHighScore('hard') < 40) {
      return '<span class="mode-hard">하드</span> 최고기록 40점 이상 필요';
    }
  }
  return '';
}

function syncMenuStartLockState() {
  const req = getStartLockRequirementText();
  const locked = !!req;
  if (menuStart) {
    menuStart.classList.toggle('is-disabled', locked);
    menuStart.setAttribute('aria-disabled', locked ? 'true' : 'false');
    menuStart.tabIndex = 0;
  }
  if (menuTitle) {
    menuTitle.classList.toggle('menu-title-locked', locked);
  }
  if (menuStartRequire) {
    if (locked) {
      menuStartRequire.innerHTML = req;
      menuStartRequire.classList.remove('hidden');
    } else {
      menuStartRequire.textContent = '';
      menuStartRequire.classList.add('hidden');
    }
  }
}

function resetSnake() {
  const cx = snakeStartCenterX();
  const midY = canvas.height / 2;
  const offY = localPlayEnabled ? 70 : 0;
  spreadSnakeAtCenter(cx, midY - offY, 0);
  if (localPlayEnabled) {
    ensureLocalGraySnakePoints();
    localSnakeGray.angle = 0;
    spreadSnakePointsAtCenter(localSnakeGray.points, cx, midY + offY, 0);
  } else {
    localSnakeGray.points = [];
    localSnakeGray.angle = 0;
  }
  currentSpeed = BASE_SPEED;
  scoreStart = performance.now();
  score = 0;
  localScoreGrayValue = 0;
  localWinner = null;
  localWinReason = '';
  localWinTimeSec = null;
  gameOver = false;
  paused = false;
  spawnTimer = 0;
  staticObs = [];
  floatingTexts = [];
  combo = 0;
  lastScoreTime = 0;
  localComboGrayValue = 0;
  localLastScoreTimeGray = 0;
  maxComboThisRun = 0;
  comboBonusPointsThisRun = 0;
  consecutiveMovingObsPasses = 0;
  halfLaneLock = null;
  wrongHalfAccumMs = 0;
  mainRunSteerDUsed = false;
  zeroScoreHoldMs = 0;
  animateLastFrameTime = 0;
}

function initTutorialStep1Intro() {
  tutorialMode = true;
  tutorialStep = 1;
  tutorialSnakeActive = true;
  tutorialStep1State = 'await_keys';
  tutorialStep2State = 'intro';
  tutorialS2_introUntil = 0;
  tutorialS2_passCount = 0;
  tutorialStep3State = 'intro';
  tutorialS3_introUntil = 0;
  tutorialS1_text1FadeStart = 0;
  tutorialS1_challengeEnd = 0;
  tutorialS1_challengeAppearStart = 0;
  tutorialS1_successFadeStart = 0;
  spreadSnakeAtCenter(snakeStartCenterX(), canvas.height / 2, 0);
  angle = 0;
  currentSpeed = TUTORIAL_SNAKE_SPEED;
  score = 0;
  gameOver = false;
  paused = false;
  spawnTimer = 0;
  staticObs = [];
  floatingTexts = [];
  combo = 0;
  lastScoreTime = 0;
  scoreStart = performance.now();
  maxComboThisRun = 0;
  comboBonusPointsThisRun = 0;
  halfLaneLock = null;
  wrongHalfAccumMs = 0;
  mainRunSteerDUsed = false;
  zeroScoreHoldMs = 0;
  animateLastFrameTime = 0;
}

resize();
spreadSnakeAtCenter(snakeStartCenterX(), canvas.height / 2, 0);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  resize();
  setTimeout(resize, 250);
});

document.addEventListener('keydown', e => {
  // Online client: forward input to host
  if (onlineRole === 'client' && gameRunning && !gameOver) {
    if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const isLeft = e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft';
      const isRight = e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight';
      if (isLeft) keys.left = true;
      if (isRight) keys.right = true;
      onlineSendInput({ l: keys.left, r: keys.right });
      return;
    }
  }

  if (e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.key === 'd' || e.key === 'D') {
    keys.d = true;
    const waitingGameStartDelay =
      gameStartDelayUntil > 0 && performance.now() < gameStartDelayUntil;
    if (
      gameRunning &&
      !tutorialMode &&
      gameMode !== 'practice' &&
      !gameOver &&
      !waitingGameStartDelay
    ) {
      mainRunSteerDUsed = true;
    }
  }
  if (e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.key === ' ') {
    if (gameOver) {
      if (isOnlineMode()) {
        // Online: both must press Space to restart
        if (onlineRole === 'host' && !onlineRestartHostReady) {
          onlineRestartHostReady = true;
          onlineSendSignal('restart_ready');
          if (onlineRestartClientReady) {
            setTimeout(() => { onlineSendSignal('restart'); onlineDoRestart(); }, 200);
          }
        } else if (onlineRole === 'client' && !onlineRestartClientReady) {
          onlineRestartClientReady = true;
          onlineSendSignal('restart_ready');
        }
        return;
      }
      // 재시작: 혼돈이면 디버프 재추첨 + 3초 표시
      pickChaosDebuffsForRun();
      runSegmentDist = SEGMENT_DIST;
      chaosTurnVel = 0;
      chaosTurnHoldMs = 0;
      chaosIntroStartMs = gameMode === 'chaos' ? performance.now() : 0;
      chaosIntroUntil = gameMode === 'chaos' ? (chaosIntroStartMs + 3000) : 0;
      chaosIntroWasActive = gameMode === 'chaos' && chaosIntroUntil > 0;
      resetSnake();
    } else if (
      gameRunning &&
      paused &&
      !gameOver &&
      tutorialModal.classList.contains('hidden')
    ) {
      e.preventDefault();
      paused = false;
      escMenuHoldStart = 0;
    }
  }
});
document.addEventListener('keyup', e => {
  if (onlineRole === 'client' && gameRunning) {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { keys.left = false; onlineSendInput({ l: keys.left, r: keys.right }); return; }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { keys.right = false; onlineSendInput({ l: keys.left, r: keys.right }); return; }
  }
  if (e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.key === 'd' || e.key === 'D') keys.d = false;
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === 'Escape') escMenuHoldStart = 0;
});

// PC: pause/gameover 화면의 안내 문구를 마우스로 클릭해도 동작하게
if (canvas) {
  canvas.addEventListener('click', (e) => {
    if (!gameRunning) return;
    if (!paused && !gameOver) return;
    if (tutorialModal && !tutorialModal.classList.contains('hidden')) return;

    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;

    const cx = canvas.width * 0.5;
    const baseY = canvas.height * 0.5;

    function hitText(str, fontPx, ty) {
      ctx.save();
      ctx.font = `700 ${fontPx}px Nunito, sans-serif`;
      const w = ctx.measureText(str).width;
      ctx.restore();
      const padX = 18;
      const padY = 12;
      const x1 = cx - w / 2 - padX;
      const x2 = cx + w / 2 + padX;
      const y1 = ty - padY;
      const y2 = ty + padY;
      return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }

    if (gameOver) {
      if (isOnlineMode()) return; // Online: only Space key restarts
      const restartStr = 'SPACE를 눌러 재시작';
      const mainStr = 'ESC로 메인 화면';
      const restartY = baseY + px(45);
      const mainY = baseY + px(78);
      if (hitText(restartStr, px(15), restartY)) {
        playMenuUiSound('primary');
        pickChaosDebuffsForRun();
        runSegmentDist = SEGMENT_DIST;
        chaosTurnVel = 0;
        chaosTurnHoldMs = 0;
        chaosIntroStartMs = gameMode === 'chaos' ? performance.now() : 0;
        chaosIntroUntil = gameMode === 'chaos' ? (chaosIntroStartMs + 3000) : 0;
        chaosIntroWasActive = gameMode === 'chaos' && chaosIntroUntil > 0;
        resetSnake();
        return;
      }
      if (hitText(mainStr, px(15), mainY)) {
        playMenuUiSound('soft');
        returnToMainMenu();
        return;
      }
      return;
    }

    // paused
    const contStr = 'SPACE로 계속하기';
    const contY = baseY + px(12);
    const mainStr = 'ESC키를 꾹 눌러 메인화면';
    const mainY = baseY + px(44);
    if (hitText(contStr, px(16), contY)) {
      playMenuUiSound('primary');
      paused = false;
      escMenuHoldStart = 0;
      return;
    }
    if (hitText(mainStr, px(15), mainY)) {
      playMenuUiSound('soft');
      returnToMainMenu();
      return;
    }
  }, { passive: true });
}

if (IS_MOBILE && canvas) {
  const activeTouches = new Map();
  let leftActive = false;
  let rightActive = false;
  let bothPrev = false;

  function recomputeSides() {
    leftActive = false;
    rightActive = false;
    activeTouches.forEach((side) => {
      if (side === 'left') leftActive = true;
      else if (side === 'right') rightActive = true;
    });
  }

  function syncTouchKeys() {
    const both = leftActive && rightActive;
    const playable = gameRunning && !gameOver && !paused;
    if (playable && !both) {
      keys.a = leftActive;
      keys.d = rightActive;
      // "A"ce 업적용 플래그: 오른쪽(=d) 조향 사용 여부를 키보드 keydown과 동일하게 추적
      if (rightActive) {
        const waitingGameStartDelay =
          gameStartDelayUntil > 0 && performance.now() < gameStartDelayUntil;
        if (!tutorialMode && gameMode !== 'practice' && !waitingGameStartDelay) {
          mainRunSteerDUsed = true;
        }
      }
      if (onlineRole === 'client') {
        keys.left = leftActive;
        keys.right = rightActive;
        onlineSendInput({ l: keys.left, r: keys.right });
      }
    } else {
      if (keys.a || keys.d || keys.left || keys.right) {
        keys.a = false; keys.d = false; keys.left = false; keys.right = false;
        if (onlineRole === 'client') onlineSendInput({ l: false, r: false });
      }
    }
  }

  canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const side = (x < rect.width / 2) ? 'left' : 'right';
      activeTouches.set(t.identifier, side);
    }
    recomputeSides();
    const bothNow = leftActive && rightActive;

    if (bothNow && !bothPrev && gameRunning && !gameOver && !isOnlineMode()) {
      paused = !paused;
    }
    bothPrev = bothNow;

    syncTouchKeys();

    const playable = gameRunning && !gameOver && !paused;
    if (playable || bothNow) e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (gameRunning) e.preventDefault();
  }, { passive: false });

  function handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      activeTouches.delete(e.changedTouches[i].identifier);
    }
    recomputeSides();
    bothPrev = leftActive && rightActive;
    syncTouchKeys();
  }
  canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true });
}

function animate() {
  if (!gameRunning) return;

  const _frameNow = performance.now();
  if (animateLastFrameTime <= 0) animateLastFrameTime = _frameNow;
  const frameDeltaMs = Math.min(Math.max(0, _frameNow - animateLastFrameTime), 120);
  animateLastFrameTime = _frameNow;
  // 60fps 기준으로 설계된 "프레임당" 수치들을 시간 기반으로 보정
  // (고주사율 모니터에서 게임이 빨라지는 문제 방지)
  const frameFactor = frameDeltaMs / (1000 / 60);

  if (
    paused &&
    escMenuHoldStart > 0 &&
    performance.now() - escMenuHoldStart >= 1000
  ) {
    escMenuHoldStart = 0;
    returnToMainMenu();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let tutorialS3_pendingComboRestart = false;

  // Online client: skip all physics, only render (state comes from host)
  const _isOnlineClient = (typeof onlineRole !== 'undefined' && onlineRole === 'client');

  let playing = false; // hoisted out of physics block for rendering access

  if (!_isOnlineClient) {
  // === begin physics block (skipped for online client) ===

  if (tutorialMode && tutorialStep === 1) {
    if (tutorialStep1State === 'await_keys') {
      if (keys.a || keys.d) {
        tutorialStep1State = 'text1_fading';
        tutorialS1_text1FadeStart = performance.now();
        scoreStart = performance.now();
        spawnTimer = 0;
      }
    } else if (tutorialStep1State === 'text1_fading') {
      if (performance.now() >= tutorialS1_text1FadeStart + TUTORIAL_S1_TEXT1_MS) {
        tutorialStep1State = 'challenge';
        const tNow = performance.now();
        tutorialS1_challengeAppearStart = tNow;
        tutorialS1_challengeEnd = tNow + TUTORIAL_S1_CHALLENGE_MS;
      }
    } else if (tutorialStep1State === 'challenge') {
      if (performance.now() >= tutorialS1_challengeEnd) {
        tutorialStep1State = 'success_fade';
        tutorialS1_successFadeStart = performance.now();
      }
    } else if (tutorialStep1State === 'success_fade') {
      if (performance.now() >= tutorialS1_successFadeStart + TUTORIAL_S1_SUCCESS_MS) {
        tutorialStep1State = 'step1_done';
        tutorialStep = 2;
        tutorialStep2State = 'intro';
        tutorialS2_introUntil = performance.now() + TUTORIAL_S2_S3_INTRO_MS;
        tutorialS2_passCount = 0;
        staticObs = [];
        spawnTimer = 0;
        scoreStart = performance.now();
      }
    }
  }

  if (tutorialMode && tutorialStep === 2) {
    if (tutorialStep2State === 'intro') {
      if (performance.now() >= tutorialS2_introUntil) {
        tutorialStep2State = 'play';
        ensureTutorialStep2Obstacles(TUTORIAL_S2_TARGET);
      }
    } else if (tutorialStep2State === 'play') {
      if (tutorialS2_passCount >= TUTORIAL_S2_TARGET) {
        tutorialStep = 3;
        tutorialStep3State = 'intro';
        tutorialS3_introUntil = performance.now() + TUTORIAL_S2_S3_INTRO_MS;
        staticObs = [];
        spawnTimer = 0;
        combo = 0;
        lastScoreTime = 0;
        scoreStart = performance.now();
        score = 0;
        floatingTexts = [];
      }
    }
  }

  if (tutorialMode && tutorialStep === 3) {
    if (tutorialStep3State === 'intro') {
      if (performance.now() >= tutorialS3_introUntil) {
        tutorialStep3State = 'play';
        ensureTutorialStep2Obstacles(TUTORIAL_S3_TARGET);
      }
    } else if (tutorialStep3State === 'play') {
      if (combo >= TUTORIAL_S3_TARGET) {
        tutorialStep3State = 'complete';
        unlockAchievement('tutorial_done');
      }
    }
  }

  if (gameStartDelayUntil > 0 && performance.now() >= gameStartDelayUntil) {
    gameStartDelayUntil = 0;
    scoreStart = performance.now();
    spawnTimer = 0;
  }

  const waitingGameStart =
    !tutorialMode && gameStartDelayUntil > 0 && performance.now() < gameStartDelayUntil;
  let tutorialFreeze = false;
  if (tutorialMode && tutorialStep === 1) {
    if (tutorialStep1State === 'await_keys') {
      tutorialFreeze = true;
    }
  }
  if (tutorialMode && tutorialStep === 2 && tutorialStep2State === 'intro') {
    tutorialFreeze = true;
  }
  if (tutorialMode && tutorialStep === 3 && tutorialStep3State === 'intro') {
    tutorialFreeze = true;
  }
  const chaosIntroActive =
    !tutorialMode && gameMode === 'chaos' && chaosIntroUntil > 0 && performance.now() < chaosIntroUntil;
  if (chaosIntroWasActive && !chaosIntroActive) {
    // 인트로(3초) 종료 시점부터 본격 시간 측정 시작
    scoreStart = performance.now();
    spawnTimer = 0;
  }
  chaosIntroWasActive = chaosIntroActive;
  playing =
    !gameOver &&
    !paused &&
    (!tutorialMode || tutorialSnakeActive) &&
    !waitingGameStart &&
    !tutorialFreeze &&
    !chaosIntroActive;

  // 연습 모드 누적 플레이 시간(전체 누적) — 업적: 연습이 완벽을 만든다(20분)
  if (playing && !tutorialMode && gameMode === 'practice') {
    practicePlayMsSession += frameDeltaMs;
    const now = performance.now();
    if (practicePlayMsLastSaveAt <= 0 || now - practicePlayMsLastSaveAt >= 1200) {
      practicePlayMsLastSaveAt = now;
      let stored = 0;
      try {
        const v = localStorage.getItem(PRACTICE_PLAY_MS_KEY);
        const n = parseInt(v, 10);
        stored = Number.isFinite(n) && n >= 0 ? n : 0;
      } catch (_) {}
      const total = stored + practicePlayMsSession;
      practicePlayMsSession = 0;
      try {
        localStorage.setItem(PRACTICE_PLAY_MS_KEY, String(Math.floor(total)));
      } catch (_) {}
      if (total >= 20 * 60 * 1000) unlockAchievement('practice_20min');
    }
  }

  if (playing) {
    updateMovingObstacles(frameFactor);

    // Move head forward, speed increases over time (튜토리얼에서는 일정 속도)
    currentSpeed = tutorialMode
      ? TUTORIAL_SNAKE_SPEED
      : getRunBaseSpeed() +
        ((performance.now() - scoreStart) / 1000) * getRunSpeedIncrement();
    if (chaosHasDebuff('speed_flux')) {
      currentSpeed *= chaosSpeedMultiplier(performance.now());
    }
    const speedRatio =
      currentSpeed / (tutorialMode ? TUTORIAL_SNAKE_SPEED : getRunBaseSpeed());
    const currentTurn =
      TURN_SPEED *
      (gameMode === 'practice'
        ? practiceSettings.turnMult
        : (1 + (speedRatio - 1) * TURN_SPEED_RAMP) *
          (gameMode === 'hard' ? 1.35 : 1) *
          (gameMode === 'chaos' ? CHAOS_MODE_MULT : 1) *
          (gameMode === 'normal' ? NORMAL_MODE_MULT : 1) *
          (localPlayEnabled ? LOCAL_TURN_MULT : 1));
    const turnStep = currentTurn * frameFactor;

    // Turn with A/D keys (scales with speed)
    const steerLeft = keys.a;
    const steerRight = keys.d;
    const whiteLeftKey = steerLeft;
    const whiteRightKey = steerRight;
    if (chaosHasDebuff('turn_inertia')) {
      // 처음엔 둔하게 → 누르고 있을수록 정상 회전으로 복귀
      const holding = whiteLeftKey || whiteRightKey;
      chaosTurnHoldMs = clamp(
        chaosTurnHoldMs + (holding ? frameDeltaMs : -frameDeltaMs * 2.2),
        0,
        520
      );
      const ramp = easeOutCubic(chaosTurnHoldMs / 520); // 0→1
      const turnScale = 0.28 + 0.72 * ramp; // 처음엔 28%, 끝엔 100%
      const target =
        (whiteLeftKey ? -turnStep : whiteRightKey ? turnStep : 0) * turnScale;
      chaosTurnVel += (target - chaosTurnVel) * 0.34;
      angle += chaosTurnVel;
    } else {
      if (whiteLeftKey) angle -= turnStep;
      if (whiteRightKey) angle += turnStep;
    }
    const moveStep = currentSpeed * frameFactor;
    points[0].x += Math.cos(angle) * moveStep;
    points[0].y += Math.sin(angle) * moveStep;

    // Local gray snake (local mode second snake)
    if (localPlayEnabled && localSnakeGray.points && localSnakeGray.points.length >= getRunSegmentCount()) {
      let gLeft = keys.left;
      let gRight = keys.right;
      if (gLeft) localSnakeGray.angle -= turnStep;
      if (gRight) localSnakeGray.angle += turnStep;
      localSnakeGray.points[0].x += Math.cos(localSnakeGray.angle) * moveStep;
      localSnakeGray.points[0].y += Math.sin(localSnakeGray.angle) * moveStep;
      for (let i = 1; i < getRunSegmentCount(); i++) {
        const prev = localSnakeGray.points[i - 1];
        const curr = localSnakeGray.points[i];
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > runSegmentDist) {
          const ratio = runSegmentDist / dist;
          curr.x = prev.x - dx * ratio;
          curr.y = prev.y - dy * ratio;
        }
      }
    }

    // Wall collision - game over if out of bounds (연습 무적: 화면 반대편으로 워프)
    if (
      points[0].x < 0 ||
      points[0].x > canvas.width ||
      points[0].y < 0 ||
      points[0].y > canvas.height
    ) {
      if (gameMode === 'practice' && practiceSettings.invincible) {
        respawnPracticeRun();
      } else {
        if (localPlayEnabled) triggerLocalDeath('white');
        else triggerGameOver();
      }
    }
    if (
      localPlayEnabled &&
      localSnakeGray.points &&
      localSnakeGray.points.length >= getRunSegmentCount() &&
      (localSnakeGray.points[0].x < 0 ||
        localSnakeGray.points[0].x > canvas.width ||
        localSnakeGray.points[0].y < 0 ||
        localSnakeGray.points[0].y > canvas.height)
    ) {
      triggerLocalDeath('gray');
    }

    // Each segment follows the one before it
    for (let i = 1; i < getRunSegmentCount(); i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > runSegmentDist) {
        const ratio = runSegmentDist / dist;
        curr.x = prev.x - dx * ratio;
        curr.y = prev.y - dy * ratio;
      }
    }

    if (!tutorialMode && gameMode === 'normal' && halfLaneLock) {
      const midX = canvas.width * 0.5;
      const onLeft = points[0].x < midX;
      const onWrongHalf =
        halfLaneLock === 'left' ? !onLeft : onLeft;
      if (onWrongHalf) wrongHalfAccumMs += frameDeltaMs;
    }

    // Check collision with static obstacles
    if (!gameOver) {
      let hitFound = false;
      for (const obs of staticObs) {
        if (obs.fadeOut) continue;
        for (const c of obs.circles) {
          if (checkCollision(points[0].x, points[0].y, obs.x + c.ox, obs.y + c.oy, c.r)) {
            if (gameMode === 'practice' && practiceSettings.invincible) {
              if (performance.now() < practiceRespawnInvulnUntil) continue;
              respawnPracticeRun();
              hitFound = true;
              break;
            }
            if (obs.isGolden) unlockAchievement('hidden_golden_death');
            if (localPlayEnabled) triggerLocalDeath('white');
            else triggerGameOver();
            hitFound = true;
            break;
          }
        }
        if (hitFound) break;
      }
    }

    // Gray snake collision with static obstacles (local mode)
    if (
      localPlayEnabled &&
      !gameOver &&
      localSnakeGray.points &&
      localSnakeGray.points.length >= getRunSegmentCount()
    ) {
      let hitFound = false;
      for (const obs of staticObs) {
        if (obs.fadeOut) continue;
        for (const c of obs.circles) {
          if (
            checkCollision(
              localSnakeGray.points[0].x,
              localSnakeGray.points[0].y,
              obs.x + c.ox,
              obs.y + c.oy,
              c.r
            )
          ) {
            triggerLocalDeath('gray');
            hitFound = true;
            break;
          }
        }
        if (hitFound) break;
      }
    }

    // Proximity scoring (white + gray separated in local mode)
    if (!gameOver) {
      const nowMs = performance.now();
      const comboLimitMs = tutorialMode
        ? TUTORIAL_COMBO_TIMEOUT_MS
        : gameMode === 'practice'
          ? COMBO_TIMEOUT_MS * practiceSettings.comboHoldMult
          : chaosHasDebuff('combo_short')
            ? 1250
            : COMBO_TIMEOUT_MS;

      function minEdgeDistForHead(obs, hx, hy) {
        let m = Infinity;
        for (const c of obs.circles) {
          const dx = hx - (obs.x + c.ox);
          const dy = hy - (obs.y + c.oy);
          const edgeDist = Math.sqrt(dx * dx + dy * dy) - c.r;
          m = Math.min(m, edgeDist);
        }
        return m;
      }

      function basePtsFromMinEdge(minEdgeDist) {
        const ratio = minEdgeDist / HEAD_WIDTH;
        const elapsed = gameMode === 'practice' ? 0 : (nowMs - scoreStart) / 1000;
        let base, bonus;
        if (ratio >= 3) {
          if (chaosHasDebuff('no_half_point')) { base = 1; bonus = 0.5 * Math.floor(elapsed / 15); }
          else { base = 0.5; bonus = 0.5 * Math.floor(elapsed / 30); }
        } else if (ratio >= 2) { base = 1; bonus = 0.5 * Math.floor(elapsed / 15); }
        else if (ratio >= 1) { base = 2; bonus = 0.5 * Math.floor(elapsed / 15); }
        else { base = 4; bonus = 0.5 * Math.floor(elapsed / 15); }
        return base + bonus;
      }

      function processSnakeScore(kind, hx, hy) {
        const nearKey = kind === 'gray' ? '_nearStart_g' : '_nearStart';
        const bestKey = kind === 'gray' ? '_bestScore_g' : '_bestScore';
        const isGray = kind === 'gray';
        for (let oi = 0; oi < staticObs.length; oi++) {
          const obs = staticObs[oi];
          if (obs.fadeOut) continue;

          const minEdgeDist = minEdgeDistForHead(obs, hx, hy);
          if (minEdgeDist <= HEAD_WIDTH * 4) {
            const pts0 = basePtsFromMinEdge(minEdgeDist);
            if (!obs[nearKey]) obs[nearKey] = nowMs;
            obs[bestKey] = Math.max(obs[bestKey] || 0, pts0);
          } else {
            if (obs[nearKey] && (nowMs - obs[nearKey]) >= 150) {
              if (!obs.fadeOut) {
                // tutorial step2 uses a single counter regardless of snake
                if (tutorialMode && tutorialStep === 2) {
                  tutorialS2_passCount++;
                  obs.fadeOut = 36;
                } else {
                  const lastT = isGray ? localLastScoreTimeGray : lastScoreTime;
                  const timedOut = lastT > 0 && (nowMs - lastT) > comboLimitMs;

                  if (
                    tutorialMode &&
                    tutorialStep === 3 &&
                    tutorialStep3State === 'play' &&
                    timedOut
                  ) {
                    tutorialS3_pendingComboRestart = true;
                  } else {
                    if (isGray) {
                      if (timedOut) localComboGrayValue = 0;
                      localComboGrayValue++;
                      localLastScoreTimeGray = nowMs;
                      const comboBonus = localComboGrayValue >= 2 ? (localComboGrayValue - 1) * 0.5 : 0;
                      const pts = (obs[bestKey] || (chaosHasDebuff('no_half_point') ? 1 : 0.5)) + comboBonus;
                      if (!(tutorialMode && tutorialStep === 3)) {
                        localScoreGrayValue += pts;
                        if (
                          localPlayEnabled &&
                          !localWinner &&
                          localScoreGrayValue >= LOCAL_WIN_SCORE &&
                          score < LOCAL_WIN_SCORE
                        ) {
                          triggerLocalWin('gray', 'score');
                        }
                        floatingTexts.push({
                          x: hx, y: hy - 20,
                          text: '+' + pts,
                          life: 60,
                          color: [120, 120, 120]
                        });
                      }
                    } else {
                      if (timedOut) combo = 0;
                      combo++;
                      playComboStackSound(combo);
                      if (!tutorialMode && runCountsForRecords()) {
                        maxComboThisRun = Math.max(maxComboThisRun, combo);
                      }
                      lastScoreTime = nowMs;
                      const comboBonus = combo >= 2 ? (combo - 1) * 0.5 : 0;
                      const pts = (obs[bestKey] || (chaosHasDebuff('no_half_point') ? 1 : 0.5)) + comboBonus;
                      if (!(tutorialMode && tutorialStep === 3)) {
                        const scoreBefore = score;
                        score += pts;
                        if (
                          localPlayEnabled &&
                          !localWinner &&
                          score >= LOCAL_WIN_SCORE &&
                          localScoreGrayValue < LOCAL_WIN_SCORE
                        ) {
                          triggerLocalWin('white', 'score');
                        }
                        if (!tutorialMode && gameMode === 'practice' && score >= 500) {
                          unlockAchievement('hidden_practice_500');
                        }
                        if (
                          !localPlayEnabled &&
                          !tutorialMode &&
                          gameMode === 'normal' &&
                          scoreBefore === 0 &&
                          score > 0
                        ) {
                          halfLaneLock =
                            points[0].x < canvas.width * 0.5 ? 'left' : 'right';
                        }
                        if (!tutorialMode && runCountsForRecords()) {
                          comboBonusPointsThisRun += comboBonus;
                        }
                        if (!tutorialMode && gameMode !== 'practice' && gameMode !== 'multi') {
                          if (obs.isMoving) {
                            consecutiveMovingObsPasses++;
                            if (consecutiveMovingObsPasses >= 2) {
                              unlockAchievement('movement');
                            }
                          } else {
                            consecutiveMovingObsPasses = 0;
                          }
                        }
                        floatingTexts.push({
                          x: hx, y: hy - 20,
                          text: '+' + pts,
                          life: 60
                        });
                      }
                    }
                    obs.fadeOut = 36;
                  }
                }
              }
            }
            obs[nearKey] = null;
            obs[bestKey] = 0;
          }
        }
      }

      processSnakeScore('white', points[0].x, points[0].y);
      if (localPlayEnabled && localSnakeGray.points && localSnakeGray.points.length >= getRunSegmentCount()) {
        processSnakeScore('gray', localSnakeGray.points[0].x, localSnakeGray.points[0].y);
      }
    }

    if (tutorialS3_pendingComboRestart) {
      restartTutorialStep3Challenge();
    }

    // Gradually spawn obstacles (튜토리얼에서는 생성 안 함)
    if (!tutorialMode) {
      const elapsedGameSec = (performance.now() - scoreStart) / 1000;
      const sp = getSpawnParamsForMode();
      const spawnEvery = Math.max(
        sp.min,
        sp.start - elapsedGameSec * sp.ramp
      );
      const spawnEveryAdjusted =
        gameMode === 'practice'
          ? Math.max(6, Math.round(spawnEvery / practiceSettings.spawnRateMult))
          : localPlayEnabled
            ? Math.max(6, Math.round(spawnEvery / LOCAL_SPAWN_RATE_MULT))
            : spawnEvery;
      spawnTimer += frameFactor;
      if (spawnTimer >= spawnEveryAdjusted) {
        spawnTimer = 0;
        trySpawnObstacle();
      }
    }

    // Self-collision: check head against body segments from index 20 onward
    // Skip for first 3 seconds while segments spread out
    if (!gameOver && (performance.now() - scoreStart) > 3000) {
      for (let i = 20; i < getRunSegmentCount(); i++) {
        const dx = points[0].x - points[i].x;
        const dy = points[0].y - points[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < 6) {
          if (gameMode === 'practice' && practiceSettings.invincible) {
            if (performance.now() < practiceRespawnInvulnUntil) break;
            respawnPracticeRun();
          } else {
            if (localPlayEnabled) triggerLocalDeath('white', 'self');
            else triggerGameOver('self');
          }
          break;
        }
      }
    }

    // Gray snake self-collision (local mode)
    if (
      localPlayEnabled &&
      !gameOver &&
      localSnakeGray.points &&
      localSnakeGray.points.length >= getRunSegmentCount() &&
      (performance.now() - scoreStart) > 3000
    ) {
      for (let i = 20; i < getRunSegmentCount(); i++) {
        const dx = localSnakeGray.points[0].x - localSnakeGray.points[i].x;
        const dy = localSnakeGray.points[0].y - localSnakeGray.points[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < 6) {
          triggerLocalDeath('gray', 'self');
          break;
        }
      }
    }

    if (!tutorialMode && playing && score === 0) {
      zeroScoreHoldMs += frameDeltaMs;
      if (zeroScoreHoldMs >= 15000) unlockAchievement('hidden_beginner');
    } else if (!tutorialMode && score > 0) {
      zeroScoreHoldMs = 0;
    }
  }

  // === end physics block ===
  } else {
    // Online client: derive playing state for rendering
    playing = !gameOver && !paused;
  }

  // Draw gray snake behind obstacles (local mode)
  if (
    localPlayEnabled &&
    (!tutorialMode || tutorialSnakeActive) &&
    localSnakeGray.points &&
    localSnakeGray.points.length >= getRunSegmentCount()
  ) {
    const maxWidth = 15.5;
    const minWidth = 1;
    const segN = getRunSegmentCount();
    for (let i = 0; i < segN - 1; i++) {
      const t = i / (segN - 1);
      const width = maxWidth * (1 - t * t) + minWidth;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = width;
      const alpha = 1 - t * 0.6;
      ctx.strokeStyle = `rgba(95, 95, 95, ${alpha})`;
      if (i === 0) {
        ctx.moveTo(localSnakeGray.points[i].x, localSnakeGray.points[i].y);
        ctx.lineTo(localSnakeGray.points[i + 1].x, localSnakeGray.points[i + 1].y);
      } else {
        const midX = (localSnakeGray.points[i].x + localSnakeGray.points[i + 1].x) / 2;
        const midY = (localSnakeGray.points[i].y + localSnakeGray.points[i + 1].y) / 2;
        ctx.moveTo(
          (localSnakeGray.points[i - 1].x + localSnakeGray.points[i].x) / 2,
          (localSnakeGray.points[i - 1].y + localSnakeGray.points[i].y) / 2
        );
        ctx.quadraticCurveTo(localSnakeGray.points[i].x, localSnakeGray.points[i].y, midX, midY);
      }
      ctx.stroke();
    }
  }

  // Draw obstacles (cached metaball blobs) with fade-in/out
  // Golden / moving obstacles are drawn later (above the player).
  for (let i = staticObs.length - 1; i >= 0; i--) {
    const obs = staticObs[i];
    if (obs && (obs.isGolden || obs.isMoving)) continue;
    if (obs.fadeOut > 0) {
      ctx.globalAlpha = obs.fadeOut / 36;
      if (playing) {
        obs.fadeOut--;
        if (obs.fadeOut <= 0) {
          staticObs.splice(i, 1);
          continue;
        }
      }
    } else if (obs.fadeIn > 0) {
      ctx.globalAlpha = 1 - (obs.fadeIn / 36);
      if (playing) obs.fadeIn--;
    } else {
      ctx.globalAlpha = 1;
    }
    if (chaosHasDebuff('obs_glitch') && obs._chaosGlitchTarget) {
      const tick = ((performance.now() / 90) | 0) * 9973;
      const r = chaosHash01((obs._gid || 0) + tick);
      if (r < 1 / 7) {
        const dir = chaosHash01((obs._gid || 0) + tick + 17) * Math.PI * 2;
        const amp =
          (2.2 + chaosHash01((obs._gid || 0) + tick + 31) * 3.2) * 5 * CHAOS_GLITCH_STRENGTH;
        ctx.save();
        ctx.translate(Math.cos(dir) * amp, Math.sin(dir) * amp);
        drawMetaballObstacle(obs);
        ctx.restore();
      } else {
        drawMetaballObstacle(obs);
      }
    } else {
      drawMetaballObstacle(obs);
    }
    ctx.globalAlpha = 1;
  }

  // Draw snake body using quadratic curves for smoothness
  if (!tutorialMode || tutorialSnakeActive) {
  const maxWidth = 15.5;
  const minWidth = 1;

  function drawSnakeBody(pts, rgb) {
    const segN = getRunSegmentCount();
    for (let i = 0; i < segN - 1; i++) {
      const t = i / (segN - 1);
      const width = maxWidth * (1 - t * t) + minWidth;

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = width;

      const alpha = 1 - t * 0.6;
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

      if (i === 0) {
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      } else {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.moveTo(
          (pts[i - 1].x + pts[i].x) / 2,
          (pts[i - 1].y + pts[i].y) / 2
        );
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }

      ctx.stroke();
    }
  }

  // White snake above obstacles
  drawSnakeBody(points, [255, 255, 255]);
  // 뱀 머리 장신구(꾸미기)
  drawSnakeAccessory(points[0], points[1]);

  // Draw golden obstacles above the player (z-order).
  for (let i = staticObs.length - 1; i >= 0; i--) {
    const obs = staticObs[i];
    if (!obs || !obs.isGolden) continue;
    if (obs.fadeOut > 0) {
      ctx.globalAlpha = obs.fadeOut / 36;
      if (playing) {
        obs.fadeOut--;
        if (obs.fadeOut <= 0) {
          staticObs.splice(i, 1);
          continue;
        }
      }
    } else if (obs.fadeIn > 0) {
      ctx.globalAlpha = 1 - (obs.fadeIn / 36);
      if (playing) obs.fadeIn--;
    } else {
      ctx.globalAlpha = 1;
    }
    // no special glitch handling for golden: keep it stable/clear
    drawMetaballObstacle(obs);
    ctx.globalAlpha = 1;
  }

  // Draw moving obstacles above the player (z-order).
  for (let i = staticObs.length - 1; i >= 0; i--) {
    const obs = staticObs[i];
    if (!obs || !obs.isMoving || obs.isGolden) continue;
    if (obs.fadeOut > 0) {
      ctx.globalAlpha = obs.fadeOut / 36;
      if (playing) {
        obs.fadeOut--;
        if (obs.fadeOut <= 0) {
          staticObs.splice(i, 1);
          continue;
        }
      }
    } else if (obs.fadeIn > 0) {
      ctx.globalAlpha = 1 - (obs.fadeIn / 36);
      if (playing) obs.fadeIn--;
    } else {
      ctx.globalAlpha = 1;
    }
    drawMetaballObstacle(obs);
    ctx.globalAlpha = 1;
  }

  // 혼돈 디버프 HUD: 시작 3초는 중앙→좌상단 이동, 이후에도 좌상단 고정 표시
  if (!tutorialMode && gameMode === 'chaos' && chaosDebuffsPicked && chaosDebuffsPicked.length >= 2) {
    const now = performance.now();
    if (chaosIntroUntil > 0 && now < chaosIntroUntil) {
      drawChaosDebuffHud(ctx, now, { dimBackground: true });
    } else if (!gameOver) {
      drawChaosDebuffHud(ctx, now, { dimBackground: false });
    }
  }
  }

  // 튜토리얼 1단계 안내 글자 (뱀 위에 표시, 등장·퇴장 시 위로 이동)
  if (tutorialMode && tutorialStep === 1 && tutorialStep1State !== 'step1_done') {
    const tx = Math.min(canvas.width / 2 + 285, canvas.width - 24);
    const ty = canvas.height / 2 - 28;
    const now = performance.now();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 19px Nunito, sans-serif';
    if (tutorialStep1State === 'await_keys') {
      ctx.fillStyle = 'rgba(212, 212, 212, 0.96)';
      ctx.fillText('a, d키로 움직이세요', tx, ty);
    } else if (tutorialStep1State === 'text1_fading') {
      const p = Math.min(1, (now - tutorialS1_text1FadeStart) / TUTORIAL_S1_TEXT1_MS);
      const a = (1 - p) * 0.96;
      const y = ty - 24 * p;
      ctx.fillStyle = `rgba(212, 212, 212, ${a})`;
      ctx.fillText('a, d키로 움직이세요', tx, y);
    } else if (tutorialStep1State === 'challenge') {
      const el = tutorialS1_challengeAppearStart
        ? now - tutorialS1_challengeAppearStart
        : 0;
      const e = Math.min(1, el / TUTORIAL_S1_CHALLENGE_ENTER_MS);
      const ease = 1 - (1 - e) * (1 - e);
      const y = ty + (1 - ease) * 30;
      ctx.fillStyle = 'rgba(130, 130, 130, 0.96)';
      ctx.fillText('7초동안 벽,자기자신에게 닿지 마세요', tx, y);
    } else if (tutorialStep1State === 'success_fade') {
      const el = now - tutorialS1_successFadeStart;
      const f = Math.min(1, el / TUTORIAL_S1_SUCCESS_MS);
      const a = 0.95 * (1 - f);
      ctx.fillStyle = `rgba(60, 185, 115, ${a})`;
      ctx.fillText('7초동안 벽,자기자신에게 닿지 마세요', tx, ty);
    }
    ctx.restore();
  }

  // 튜토리얼 2단계: 3초 설명 후 사라짐 → 근접 통과 카운트 (점수 HUD 없음)
  if (tutorialMode && tutorialStep === 2) {
    const tx = Math.min(canvas.width / 2 + 285, canvas.width - 24);
    const baseY = canvas.height / 2 - 28;
    ctx.save();
    ctx.textAlign = 'center';
    if (tutorialStep2State === 'intro') {
      ctx.font = '700 18px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(130, 130, 130, 0.96)';
      ctx.fillText('장애물에 닿으면 죽습니다', tx, baseY - 12);
      ctx.fillText('하지만 장애물을 근접해서 지나갈수록 점수를 더 많이 줍니다', tx, baseY + 14);
    } else {
      const done = tutorialS2_passCount >= TUTORIAL_S2_TARGET;
      ctx.font = '700 19px Nunito, sans-serif';
      ctx.fillStyle = done
        ? 'rgba(60, 185, 115, 0.98)'
        : 'rgba(130, 130, 130, 0.96)';
      ctx.fillText(
        `4개의 장애물을 지나가세요 ${tutorialS2_passCount}/${TUTORIAL_S2_TARGET}`,
        tx,
        baseY
      );
    }
    ctx.restore();
  }

  // 튜토리얼 3단계: 3초 설명 후 사라짐 → 장애물 5개 · 5콤보
  if (tutorialMode && tutorialStep === 3) {
    const tx = Math.min(canvas.width / 2 + 285, canvas.width - 24);
    const baseY = canvas.height / 2 - 28;
    ctx.save();
    ctx.textAlign = 'center';
    if (tutorialStep3State === 'intro') {
      ctx.font = '700 18px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(130, 130, 130, 0.96)';
      ctx.fillText('연속으로 장애물을 근접해서 지나가면', tx, baseY - 12);
      ctx.fillText('콤보가 올라갑니다', tx, baseY + 14);
    } else {
      const n = Math.min(combo, TUTORIAL_S3_TARGET);
      const done = combo >= TUTORIAL_S3_TARGET;
      ctx.font = '700 19px Nunito, sans-serif';
      ctx.fillStyle = done
        ? 'rgba(60, 185, 115, 0.98)'
        : 'rgba(130, 130, 130, 0.96)';
      ctx.fillText(
        `5콤보를 달성하세요 ${n}/${TUTORIAL_S3_TARGET}`,
        tx,
        baseY
      );
    }
    ctx.restore();
  }

  // Draw floating score texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    if (playing) {
      ft.y -= 1;
      ft.life--;
    }
    ctx.font = '700 16px Nunito, sans-serif';
    const a = ft.life / 60;
    const c = ft.color;
    if (c && c.length === 3) ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    else ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText(ft.text, ft.x, ft.y);
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // Combo timeout check (튜토리얼 3단계: 이미 콤보가 쌓인 뒤 끊기면 챌린지 재시작)
  const comboLimitMsFrame = tutorialMode
    ? TUTORIAL_COMBO_TIMEOUT_MS
    : gameMode === 'practice'
      ? COMBO_TIMEOUT_MS * practiceSettings.comboHoldMult
      : chaosHasDebuff('combo_short')
        ? 1250
        : COMBO_TIMEOUT_MS;
  if (
    playing &&
    combo > 0 &&
    lastScoreTime > 0 &&
    (performance.now() - lastScoreTime) > comboLimitMsFrame
  ) {
    if (
      tutorialMode &&
      tutorialStep === 3 &&
      tutorialStep3State === 'play'
    ) {
      restartTutorialStep3Challenge();
    } else {
      combo = 0;
    }
  }
  if (
    localPlayEnabled &&
    playing &&
    localComboGrayValue > 0 &&
    localLastScoreTimeGray > 0 &&
    (performance.now() - localLastScoreTimeGray) > comboLimitMsFrame
  ) {
    localComboGrayValue = 0;
  }

  const showScoreHud =
    (!tutorialMode || tutorialStep !== 1 || tutorialStep1State === 'step1_done') &&
    !(tutorialMode && tutorialStep === 2) &&
    !(tutorialMode && tutorialStep === 3);
  if (showScoreHud) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const scoreY = 48;
  if (localPlayEnabled) {
    const midX = canvas.width / 2;
    const gap = 34;

    // White (left) — 스킨 적용
    ctx.font = window.Skins ? Skins.getScoreFont(40) : '900 40px Nunito, sans-serif';
    const wScoreText = '' + score;
    const wScoreW = ctx.measureText(wScoreText).width;
    ctx.font = window.Skins ? Skins.getUnitFont(18) : '700 18px Nunito, sans-serif';
    const ptW = ctx.measureText('점').width;
    const wTotal = wScoreW + ptW + 4;
    const wEndX = midX - gap;
    const wStartX = wEndX - wTotal;

    if (window.Skins) {
      Skins.setScorePos({ x: wStartX, y: scoreY, w: wScoreW, h: 40 });
      if (combo >= 1) {
        ctx.font = Skins.getComboFont(18);
        const wComboW = ctx.measureText('x' + combo).width;
        Skins.setComboPos({ x: wEndX + 10, y: scoreY, w: wComboW, h: 18 });
      }
      Skins.syncEvents(score, combo);
      Skins.drawScore(ctx, wScoreText, wStartX, scoreY, { size: 40, alpha: 0.85 });
      Skins.drawScoreUnit(ctx, '점', wStartX + wScoreW + 4, scoreY, { size: 18, alpha: 0.5 });
    } else {
      ctx.font = '900 40px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(wScoreText, wStartX, scoreY);
      ctx.font = '700 18px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('점', wStartX + wScoreW + 4, scoreY);
    }
    if (combo >= 1) {
      const comboStr = 'x' + combo;
      const comboPx = wEndX + 10;
      const comboPy = scoreY;
      if (!tutorialMode) {
        if (window.Skins) {
          Skins.drawCombo(ctx, comboStr, comboPx, comboPy, combo, 18);
        } else {
          drawComboHudText(ctx, comboStr, comboPx, comboPy, combo, '900 18px Nunito, sans-serif');
        }
      } else {
        ctx.font = '900 18px Nunito, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.fillText(comboStr, comboPx, comboPy);
      }
    }

    // Gray (right) — 스킨 미적용 (상대편 시각 구분)
    ctx.font = '900 40px Nunito, sans-serif';
    const gScoreText = '' + localScoreGrayValue;
    const gScoreW = ctx.measureText(gScoreText).width;
    ctx.font = '700 18px Nunito, sans-serif';
    const gPtW = ctx.measureText('점').width;
    const gTotal = gScoreW + gPtW + 4;
    const gStartX = midX + gap;
    ctx.font = '900 40px Nunito, sans-serif';
    ctx.fillStyle = 'rgba(160,160,160,0.9)';
    ctx.fillText(gScoreText, gStartX, scoreY);
    ctx.font = '700 18px Nunito, sans-serif';
    ctx.fillStyle = 'rgba(160,160,160,0.55)';
    ctx.fillText('점', gStartX + gScoreW + 4, scoreY);
    if (localComboGrayValue >= 1) {
      const comboStr = 'x' + localComboGrayValue;
      const comboPx = gStartX + gTotal + 10;
      const comboPy = scoreY;
      ctx.font = '900 18px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(160, 160, 160, 0.82)';
      ctx.fillText(comboStr, comboPx, comboPy);
    }
  } else {
    // Score display - centered top (single) — 스킨 적용
    ctx.font = window.Skins ? Skins.getScoreFont(40) : '900 40px Nunito, sans-serif';
    const scoreText = '' + score;
    const scoreW = ctx.measureText(scoreText).width;
    ctx.font = window.Skins ? Skins.getUnitFont(18) : '700 18px Nunito, sans-serif';
    const ptW = ctx.measureText('점').width;
    const totalW = scoreW + ptW + 4;
    const startX = (canvas.width - totalW) / 2;

    if (window.Skins) {
      Skins.setScorePos({ x: startX, y: scoreY, w: scoreW, h: 40 });
      if (combo >= 1) {
        ctx.font = Skins.getComboFont(18);
        const comboW = ctx.measureText('x' + combo).width;
        Skins.setComboPos({ x: startX + totalW + 10, y: scoreY, w: comboW, h: 18 });
      }
      Skins.syncEvents(score, combo);
      Skins.drawScore(ctx, scoreText, startX, scoreY, { size: 40, alpha: 0.85 });
      Skins.drawScoreUnit(ctx, '점', startX + scoreW + 4, scoreY, { size: 18, alpha: 0.5 });
    } else {
      ctx.font = '900 40px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(scoreText, startX, scoreY);
      ctx.font = '700 18px Nunito, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('점', startX + scoreW + 4, scoreY);
    }

    if (combo >= 1) {
      const comboStr = 'x' + combo;
      const comboPx = startX + totalW + 10;
      const comboPy = scoreY;
      if (!tutorialMode) {
        if (window.Skins) {
          Skins.drawCombo(ctx, comboStr, comboPx, comboPy, combo, 18);
        } else {
          drawComboHudText(ctx, comboStr, comboPx, comboPy, combo, '900 18px Nunito, sans-serif');
        }
      } else {
        ctx.font = '900 18px Nunito, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.fillText(comboStr, comboPx, comboPy);
      }
    }
  }
  if (window.Skins) Skins.drawParticles(ctx);
  if (!tutorialMode) {
    ctx.font = '700 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    if (gameMode === 'hard') ctx.fillStyle = 'rgba(248, 113, 113, 0.88)';
    else if (gameMode === 'chaos') ctx.fillStyle = 'rgba(167, 139, 250, 0.92)';
    else if (gameMode === 'multi') ctx.fillStyle = 'rgba(96, 165, 250, 0.90)';
    else if (gameMode === 'practice') ctx.fillStyle = 'rgba(74, 222, 128, 0.88)';
    else ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.fillText(
      gameMode === 'practice'
        ? '연습'
        : gameMode === 'hard'
          ? '하드'
          : gameMode === 'chaos'
            ? '혼돈'
            : gameMode === 'multi'
              ? '멀티'
            : '일반',
      canvas.width / 2,
      68
    );
  }
  ctx.restore();
  }

  // 튜토리얼 3단계: 상단에 점수 없이 콤보만 (본편과 달리 단색)
  if (
    tutorialMode &&
    tutorialStep === 3 &&
    tutorialStep3State !== 'intro' &&
    combo >= 1
  ) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 40px Nunito, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('x' + combo, canvas.width / 2, 48);
    ctx.restore();
  }

  // Game over screen
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';

    ctx.font = '900 40px Nunito, sans-serif';
    if (localPlayEnabled && localWinner) {
      const title =
        localWinner === 'white'
          ? '화이트 승리'
          : localWinner === 'gray'
            ? '그레이 승리'
            : '그레이 승리';
      ctx.fillStyle =
        localWinner === 'gray'
          ? 'rgba(160,160,160,0.92)'
          : 'rgba(255,255,255,0.92)';
      ctx.fillText(title, canvas.width / 2, canvas.height / 2 - px(34));

      ctx.font = `700 ${px(18)}px Nunito, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      const reason =
        localWinReason === 'score'
          ? '50점 달성'
          : localWinReason === 'death'
            ? '상대 게임오버'
            : '';
      if (reason) ctx.fillText(reason, canvas.width / 2, canvas.height / 2 + px(2));

      // (time display removed by request)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('게임 오버', canvas.width / 2, canvas.height / 2 - px(30));

      ctx.font = `700 ${px(22)}px Nunito, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(score + '점', canvas.width / 2, canvas.height / 2 + px(10));
    }

    ctx.font = `700 ${px(15)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    if (isOnlineMode()) {
      const readyCount = (onlineRestartHostReady ? 1 : 0) + (onlineRestartClientReady ? 1 : 0);
      ctx.fillText('SPACE를 눌러 재시작 (' + readyCount + '/2)', canvas.width / 2, canvas.height / 2 + px(45));

      ctx.font = `700 ${px(15)}px Nunito, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('ESC로 메인 화면', canvas.width / 2, canvas.height / 2 + px(78));
    } else {
      ctx.fillText('SPACE를 눌러 재시작', canvas.width / 2, canvas.height / 2 + px(45));

      ctx.font = `700 ${px(15)}px Nunito, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('ESC로 메인 화면', canvas.width / 2, canvas.height / 2 + px(78));
    }

    ctx.textAlign = 'left';
  }

  const hidePauseOverlayForPracticePanel =
    isPracticeRun && isPracticeRun() && !practicePanelCollapsed;
  if (paused && !gameOver && !hidePauseOverlayForPracticePanel) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';

    ctx.font = `900 ${px(40)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('일시정지', canvas.width / 2, canvas.height / 2 - px(24));

    ctx.font = `700 ${px(16)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('SPACE로 계속하기', canvas.width / 2, canvas.height / 2 + px(12));

    ctx.font = `700 ${px(15)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('ESC키를 꾹 눌러 메인화면', canvas.width / 2, canvas.height / 2 + px(44));

    // Hold-to-main gauge (ESC 1초)
    if (escMenuHoldStart > 0) {
      const p = Math.max(
        0,
        Math.min(1, (performance.now() - escMenuHoldStart) / 1000)
      );
      const gw = px(127);
      const gh = px(6);
      const gx = canvas.width / 2 - gw / 2;
      const gy = canvas.height / 2 + px(54);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(gx, gy, gw * p, gh);
    }

    ctx.textAlign = 'left';
  }

  if (tutorialMode && tutorialStep === 3 && tutorialStep3State === 'complete') {
    returnToMainMenu();
    return;
  }

  // Online: host sends game state to client
  if (onlineRole === 'host' && onlineConnected) {
    onlineSendState({
      w: { pts: onlineCompressPoints(points), s: score, c: combo, a: angle },
      g: { pts: onlineCompressPoints(localSnakeGray.points), s: localScoreGrayValue, c: localComboGrayValue, a: localSnakeGray.angle },
      obs: onlineCompressObstacles(staticObs),
      go: gameOver,
      win: localWinner,
      wr: localWinReason,
      t: (performance.now() - scoreStart) / 1000,
      p: paused,
      ft: onlineCompressFloatingTexts(floatingTexts),
      rh: onlineRestartHostReady ? 1 : 0,
      rc: onlineRestartClientReady ? 1 : 0
    });
  }

  // Online: client applies received state with interpolation
  if (onlineRole === 'client') {
    const st = onlineGetLatestState();
    if (st && st._t === 'state') {
      const t = onlineClientGetInterpolation();

      // White snake: interpolate between previous and current positions
      if (st.w && st.w.pts) {
        const currPts = onlineCatmullRomReconstruct(st.w.pts, getRunSegmentCount());
        if (t < 1 && onlineClientGetPrevState() && onlineClientGetPrevState().w && onlineClientGetPrevState().w.pts) {
          const prevPts = onlineCatmullRomReconstruct(onlineClientGetPrevState().w.pts, getRunSegmentCount());
          const lerped = onlineLerpPoints(prevPts, currPts, t);
          for (let i = 0; i < Math.min(lerped.length, points.length); i++) {
            points[i].x = lerped[i].x;
            points[i].y = lerped[i].y;
          }
        } else {
          for (let i = 0; i < Math.min(currPts.length, points.length); i++) {
            points[i].x = currPts[i].x;
            points[i].y = currPts[i].y;
          }
        }
        score = st.w.s || 0;
        combo = st.w.c || 0;
        if (typeof st.w.a === 'number') angle = st.w.a;
      }

      // Gray snake: interpolate
      if (st.g && st.g.pts && localSnakeGray.points) {
        const currPtsG = onlineCatmullRomReconstruct(st.g.pts, getRunSegmentCount());
        if (t < 1 && onlineClientGetPrevState() && onlineClientGetPrevState().g && onlineClientGetPrevState().g.pts) {
          const prevPtsG = onlineCatmullRomReconstruct(onlineClientGetPrevState().g.pts, getRunSegmentCount());
          const lerpedG = onlineLerpPoints(prevPtsG, currPtsG, t);
          for (let i = 0; i < Math.min(lerpedG.length, localSnakeGray.points.length); i++) {
            localSnakeGray.points[i].x = lerpedG[i].x;
            localSnakeGray.points[i].y = lerpedG[i].y;
          }
        } else {
          for (let i = 0; i < Math.min(currPtsG.length, localSnakeGray.points.length); i++) {
            localSnakeGray.points[i].x = currPtsG[i].x;
            localSnakeGray.points[i].y = currPtsG[i].y;
          }
        }
        localScoreGrayValue = st.g.s || 0;
        localComboGrayValue = st.g.c || 0;
        if (typeof st.g.a === 'number') localSnakeGray.angle = st.g.a;
      }

      // Obstacles: update positions, preserve _cache
      if (st.obs) {
        const incoming = st.obs;
        if (incoming.length !== staticObs.length) {
          staticObs = incoming.map(o => ({
            x: o.x, y: o.y,
            circles: (o.c || []).map(c => ({ ox: c.x, oy: c.y, r: c.r })),
            isGolden: !!o.g,
            fadeIn: o.fi || 0,
            fadeOut: 0
          }));
        } else {
          for (let _oi = 0; _oi < incoming.length; _oi++) {
            const o = incoming[_oi];
            const existing = staticObs[_oi];
            existing.x = o.x;
            existing.y = o.y;
            existing.isGolden = !!o.g;
            existing.fadeIn = o.fi || 0;
            existing.fadeOut = 0;
            const newCircleCount = (o.c || []).length;
            if (!existing.circles || existing.circles.length !== newCircleCount) {
              existing.circles = (o.c || []).map(c => ({ ox: c.x, oy: c.y, r: c.r }));
              existing._cache = null;
            }
          }
        }
      }
      gameOver = !!st.go;
      if (st.win) { localWinner = st.win; localWinReason = st.wr || ''; }
      onlineRestartHostReady = !!st.rh;
      onlineRestartClientReady = !!st.rc;
      if (st.ft) {
        floatingTexts = st.ft.map(f => ({
          x: f.x, y: f.y, text: f.t, life: f.l,
          color: f.c || [255, 255, 255]
        }));
      }
    }
  }

  requestAnimationFrame(animate);
}

// —— Main menu (does not modify game logic) ——
const menuScreen = document.getElementById('menu-screen');
const tutorialModal = document.getElementById('tutorial-modal');
const menuStart = document.getElementById('menu-start');
const menuStartChoices = document.getElementById('menu-start-choices');
const menuStartLocal = document.getElementById('menu-start-local');
const menuStartOnline = document.getElementById('menu-start-online');
const menuStartRequire = document.getElementById('menu-start-require');
const menuTutorial = document.getElementById('menu-tutorial');
const tutorialClose = document.getElementById('tutorial-close');
const achievementsWrap = document.getElementById('achievements-wrap');
const achievementsToggle = document.getElementById('achievements-toggle');
const achievementsPanel = document.getElementById('achievements-panel');
const menuInfoToggle = document.getElementById('menu-info-toggle');
const menuInfoPanel = document.getElementById('menu-info-panel');
const menuInfoWrap = document.getElementById('menu-info-wrap');
const menuInfoClose = document.getElementById('menu-info-close');
const menuInfoTabScore = document.getElementById('menu-info-tab-score');
const menuInfoTabModes = document.getElementById('menu-info-tab-modes');
const menuInfoTabPatchnotes = document.getElementById('menu-info-tab-patchnotes');
const menuInfoPaneScore = document.getElementById('menu-info-score');
const menuInfoPaneModes = document.getElementById('menu-info-modes');
const menuInfoPanePatchnotes = document.getElementById('menu-info-patchnotes');

function setMenuInfoTab(which) {
  const tabs = [
    { id: 'score', tab: menuInfoTabScore, pane: menuInfoPaneScore },
    { id: 'modes', tab: menuInfoTabModes, pane: menuInfoPaneModes },
    { id: 'patchnotes', tab: menuInfoTabPatchnotes, pane: menuInfoPanePatchnotes }
  ];
  for (const { id, tab, pane } of tabs) {
    const active = which === id;
    if (tab) {
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (pane) {
      pane.classList.toggle('is-active', active);
      pane.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
  }
}

function hideLoadingScreenSoon() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  const root = document.documentElement;
  if (root && root.dataset && root.dataset.loading !== '1') {
    // 새로고침 등: 로딩 화면을 쓰지 않음
    try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
    return;
  }
  startLoadingProgressLoop();
  // 폰트 로딩까지 기다리면 제목 측정/캔버스 초기 프레임이 안정적임
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady
    .catch(() => {})
    .then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    .then(() => {
      const elapsed = performance.now() - loadingShownAtMs;
      const waitMs = Math.max(0, LOADING_MIN_MS - elapsed);
      return new Promise(r => setTimeout(r, waitMs));
    })
    .then(() => {
      loadingReady = true;
      loadingDoneAtMs = performance.now();
      setLoadingProgress(1);
      el.classList.add('is-hidden');
      el.setAttribute('aria-hidden', 'true');
      // 메뉴의 pointer-events 잠금(html[data-loading="1"] #menu-screen)을 해제
      if (root && root.dataset) root.dataset.loading = '0';
      // 모바일은 menu-animate 애니메이션의 forwards opacity:1 효과를 못 받으므로 inline으로 보장
      const ms = document.getElementById('menu-screen');
      if (ms) {
        ms.style.setProperty('opacity', '1', 'important');
        ms.style.setProperty('pointer-events', 'auto', 'important');
      }
      setTimeout(() => {
        // 완전히 제거해서 클릭/탭 포커스에 영향 0
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 360);
    });
}
const menuTitle = document.getElementById('menu-title');
const menuTitleWrap = document.getElementById('menu-title-wrap');
const menuTitleFlameCanvas = document.getElementById('menu-title-flame-canvas');
const menuTitleTooltipMode = document.getElementById('menu-title-tooltip-mode');
const menuTitleTooltipHint = document.querySelector('#menu-title-tooltip .menu-title-tooltip-hint');
const practicePanelWrap = document.getElementById('practice-panel-wrap');
const practicePanelDim = document.getElementById('practice-panel-dim');
const practicePanelToggle = document.getElementById('practice-panel-toggle');
const practicePanelBody = document.getElementById('practice-panel-body');
const practiceSpeed = document.getElementById('practice-speed');
const practiceTurn = document.getElementById('practice-turn');
const practiceSpawn = document.getElementById('practice-spawn');
const practiceCombo = document.getElementById('practice-combo');
const practiceInvincible = document.getElementById('practice-invincible');
const practiceSpeedVal = document.getElementById('practice-speed-val');
const practiceTurnVal = document.getElementById('practice-turn-val');
const practiceSpawnVal = document.getElementById('practice-spawn-val');
const practiceComboVal = document.getElementById('practice-combo-val');

const GAME_MODE_CYCLE = ['normal', 'hard', 'chaos', 'multi', 'practice'];
const GAME_MODE_LABELS = { normal: '일반', hard: '하드', chaos: '혼돈', multi: '멀티플레이', practice: '연습' };
const GAME_MODE_TITLE_COLORS = {
  normal: '#ffffff',
  hard: '#f87171',
  chaos: '#a78bfa',
  multi: '#60a5fa',
  practice: '#4ade80'
};

let menuTitleFlameRafId = null;
const MENU_TITLE_FLAME_PAD_TOP = 44;
let menuTitleChaosGlitchTimerId = null;
let menuTitleChaosLastPulseMs = 0;
let menuTitleModeSpamTimes = [];
let menuTitleModeLockUntil = 0;
let menuTitleTooltipOverrideUntil = 0;
/** 모드 연타 업적: 이 시간 안에 10번 이상 */
const MENU_TITLE_MODE_SPAM_WINDOW_MS = 2000;
/** 연타 후 툴팁 문구·모드 전환 잠금 유지 시간 */
const MENU_TITLE_DIZZY_COOLDOWN_MS = 3000;

function setMenuTitleTooltipOverride(text, untilMs) {
  if (menuTitleTooltipHint) menuTitleTooltipHint.textContent = text;
  if (menuTitleTooltipMode) menuTitleTooltipMode.textContent = '';
  menuTitleTooltipOverrideUntil = untilMs;
}

function clearMenuTitleTooltipOverrideIfNeeded(nowMs) {
  if (menuTitleTooltipOverrideUntil > 0 && nowMs >= menuTitleTooltipOverrideUntil) {
    menuTitleTooltipOverrideUntil = 0;
    if (menuTitleTooltipHint) menuTitleTooltipHint.textContent = '글자를 클릭해 모드를 고르세요';
    // 모드 라벨/색 복구
    if (menuTitleTooltipMode) menuTitleTooltipMode.textContent = GAME_MODE_LABELS[gameMode] || '';
    if (menuTitleTooltipMode) {
      menuTitleTooltipMode.classList.remove(
        'menu-title-tooltip-mode-normal',
        'menu-title-tooltip-mode-hard',
        'menu-title-tooltip-mode-chaos',
        'menu-title-tooltip-mode-multi',
        'menu-title-tooltip-mode-practice'
      );
      if (gameMode === 'normal') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-normal');
      else if (gameMode === 'hard') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-hard');
      else if (gameMode === 'chaos') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-chaos');
      else if (gameMode === 'multi') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-multi');
      else menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-practice');
    }
  }
}

function stopMenuTitleChaosGlitchLoop() {
  if (menuTitleChaosGlitchTimerId !== null) {
    clearTimeout(menuTitleChaosGlitchTimerId);
    menuTitleChaosGlitchTimerId = null;
  }
  menuTitleChaosLastPulseMs = 0;
  if (menuTitle) {
    menuTitle.classList.remove('menu-title-blur-pulse');
    menuTitle.style.removeProperty('--mt-b1');
    menuTitle.style.removeProperty('--mt-b2');
    menuTitle.style.removeProperty('--mt-b3');
    menuTitle.style.removeProperty('--mt-o1');
    menuTitle.style.removeProperty('--mt-o2');
    menuTitle.style.removeProperty('--mt-o3');
    menuTitle.style.removeProperty('--mt-jx');
    menuTitle.style.removeProperty('--mt-jy');
  }
}

function startMenuTitleChaosGlitchLoop() {
  stopMenuTitleChaosGlitchLoop();
  if (!menuTitle) return;
  if (gameMode !== 'chaos') return;
  const rand = (a, b) => a + Math.random() * (b - a);
  const CHAOS_PULSE_FORCE_MS = 2500; // 강제 발동 간격만 2.5초
  const CHAOS_PULSE_CHANCE = 0.38;
  const CHAOS_PULSE_NEXT_MIN_MS = 520;
  const CHAOS_PULSE_NEXT_RAND_MS = 1200;
  function fireBlurPulse() {
    if (!menuTitle) return;
    // 모드가 잠겨있을 때는(타이틀이 어두워진 상태) 혼돈 흔들림/블러 펄스를
    // 적용하면 CSS filter가 덮여서 잠깐 밝아져 보일 수 있어 스킵한다.
    if (menuTitle.classList.contains('menu-title-locked')) return;
    stopMenuTitleJiggle();
    const b1 = rand(1.85, 4.15);
    const b2 = rand(2.45, 4.95);
    const b3 = rand(1.45, 3.80);
    const bMax = Math.max(b1, b2, b3);
    const jAmp = Math.min(1.2, 0.22 * bMax); // 강도에 비례한 미세 흔들림(px)
    const dir = rand(0, Math.PI * 2);
    menuTitle.style.setProperty('--mt-jx', (Math.cos(dir) * jAmp).toFixed(2) + 'px');
    menuTitle.style.setProperty('--mt-jy', (Math.sin(dir) * jAmp).toFixed(2) + 'px');
    menuTitle.style.setProperty('--mt-b1', b1.toFixed(2) + 'px');
    menuTitle.style.setProperty('--mt-b2', b2.toFixed(2) + 'px');
    menuTitle.style.setProperty('--mt-b3', b3.toFixed(2) + 'px');
    menuTitle.style.setProperty('--mt-o1', rand(0.72, 0.90).toFixed(2));
    menuTitle.style.setProperty('--mt-o2', rand(0.68, 0.86).toFixed(2));
    menuTitle.style.setProperty('--mt-o3', rand(0.76, 0.92).toFixed(2));
    menuTitle.classList.remove('menu-title-blur-pulse');
    void menuTitle.offsetWidth;
    menuTitle.classList.add('menu-title-blur-pulse');
    menuTitleChaosLastPulseMs = performance.now();
    setTimeout(() => {
      if (menuTitle) menuTitle.classList.remove('menu-title-blur-pulse');
    }, 600);
  }
  function tick() {
    if (!menuTitle || gameMode !== 'chaos' || (menuScreen && menuScreen.classList.contains('hidden'))) {
      stopMenuTitleChaosGlitchLoop();
      return;
    }
    const now = performance.now();
    // 일정 시간 동안 한 번도 안 나왔으면 강제 1회
    if (menuTitleChaosLastPulseMs <= 0 || now - menuTitleChaosLastPulseMs >= CHAOS_PULSE_FORCE_MS) {
      fireBlurPulse();
    } else if (Math.random() < CHAOS_PULSE_CHANCE) {
      fireBlurPulse();
    }
    const nextMs = CHAOS_PULSE_NEXT_MIN_MS + Math.random() * CHAOS_PULSE_NEXT_RAND_MS;
    menuTitleChaosGlitchTimerId = setTimeout(tick, nextMs);
  }
  menuTitleChaosGlitchTimerId = setTimeout(tick, 520 + Math.random() * 900);
}

function resizeMenuTitleFlameCanvas() {
  if (!menuTitleWrap || !menuTitleFlameCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, menuTitleWrap.offsetWidth);
  const h = Math.max(1, menuTitleWrap.offsetHeight + MENU_TITLE_FLAME_PAD_TOP);
  menuTitleFlameCanvas.style.width = w + 'px';
  menuTitleFlameCanvas.style.height = h + 'px';
  menuTitleFlameCanvas.width = Math.floor(w * dpr);
  menuTitleFlameCanvas.height = Math.floor(h * dpr);
}

function stopMenuTitleFlameLoop() {
  if (menuTitleFlameRafId !== null) {
    cancelAnimationFrame(menuTitleFlameRafId);
    menuTitleFlameRafId = null;
  }
  if (menuTitleFlameCanvas && menuTitleFlameCanvas.width > 0) {
    const ctx = menuTitleFlameCanvas.getContext('2d');
    ctx.clearRect(0, 0, menuTitleFlameCanvas.width, menuTitleFlameCanvas.height);
  }
}

function drawMenuTitleFlameFrame() {
  if (!menuTitleWrap || !menuTitleFlameCanvas || !menuTitle) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = menuTitleFlameCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, menuTitleFlameCanvas.width, menuTitleFlameCanvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cs = window.getComputedStyle(menuTitle);
  const font = cs.font;
  const fontSize = parseFloat(cs.fontSize) || 48;
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const text = menuTitle.textContent.trim();
  const tw = ctx.measureText(text).width;
  const now = performance.now();
  const x = (menuTitleWrap.offsetWidth - tw) / 2;
  const baselineY = MENU_TITLE_FLAME_PAD_TOP + menuTitleWrap.offsetHeight * 0.79;
  drawMenuTitleRisingParticles(ctx, x, baselineY, tw, fontSize, now);
  ctx.globalAlpha = 1;
}

function tickMenuTitleFlame() {
  if (gameMode !== 'hard' || (menuScreen && menuScreen.classList.contains('hidden'))) {
    stopMenuTitleFlameLoop();
    return;
  }
  drawMenuTitleFlameFrame();
  menuTitleFlameRafId = requestAnimationFrame(tickMenuTitleFlame);
}

function startMenuTitleFlameLoop() {
  stopMenuTitleFlameLoop();
  if (gameMode !== 'hard') return;
  resizeMenuTitleFlameCanvas();
  menuTitleFlameRafId = requestAnimationFrame(tickMenuTitleFlame);
}

function syncMenuTitleColorFromGameMode() {
  if (!menuTitle) return;
  const c = GAME_MODE_TITLE_COLORS[gameMode];
  if (c) menuTitle.style.color = c;
  menuTitle.classList.toggle('menu-title-glow-practice', gameMode === 'practice');
  menuTitle.classList.toggle('menu-title-glow-multi', gameMode === 'multi');
  if (gameMode === 'hard') startMenuTitleFlameLoop();
  else stopMenuTitleFlameLoop();
  if (gameMode === 'chaos') startMenuTitleChaosGlitchLoop();
  else stopMenuTitleChaosGlitchLoop();
  clearMenuTitleTooltipOverrideIfNeeded(performance.now());
  if (menuTitleTooltipMode) {
    if (menuTitleTooltipOverrideUntil > 0 && performance.now() < menuTitleTooltipOverrideUntil) {
      syncMenuStartLockState();
      return;
    }
    menuTitleTooltipMode.textContent = GAME_MODE_LABELS[gameMode] || '';
    menuTitleTooltipMode.classList.remove(
      'menu-title-tooltip-mode-normal',
      'menu-title-tooltip-mode-hard',
      'menu-title-tooltip-mode-chaos',
      'menu-title-tooltip-mode-multi',
      'menu-title-tooltip-mode-practice'
    );
    if (gameMode === 'normal') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-normal');
    else if (gameMode === 'hard') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-hard');
    else if (gameMode === 'chaos') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-chaos');
    else if (gameMode === 'multi') menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-multi');
    else menuTitleTooltipMode.classList.add('menu-title-tooltip-mode-practice');
  }
  syncMenuStartLockState();
}

function runMenuTitleJiggle() {
  if (!menuTitle) return;
  const rand = (a, b) => a + Math.random() * (b - a);
  const sx = rand(-2.2, 2.2);
  const sy = rand(-2.0, 2.0);
  const r = rand(-1.8, 1.8);
  menuTitle.style.setProperty('--mt-x1', sx.toFixed(2) + 'px');
  menuTitle.style.setProperty('--mt-y1', sy.toFixed(2) + 'px');
  menuTitle.style.setProperty('--mt-r1', r.toFixed(2) + 'deg');
  menuTitle.style.setProperty('--mt-x2', (-sx * rand(0.75, 1.05)).toFixed(2) + 'px');
  menuTitle.style.setProperty('--mt-y2', (-sy * rand(0.75, 1.05)).toFixed(2) + 'px');
  menuTitle.style.setProperty('--mt-r2', (-r * rand(0.75, 1.05)).toFixed(2) + 'deg');
  menuTitle.classList.remove('menu-title-jiggle');
  void menuTitle.offsetWidth;
  menuTitle.classList.add('menu-title-jiggle');
}

function stopMenuTitleJiggle() {
  if (!menuTitle) return;
  menuTitle.classList.remove('menu-title-jiggle');
  menuTitle.style.removeProperty('--mt-x1');
  menuTitle.style.removeProperty('--mt-y1');
  menuTitle.style.removeProperty('--mt-r1');
  menuTitle.style.removeProperty('--mt-x2');
  menuTitle.style.removeProperty('--mt-y2');
  menuTitle.style.removeProperty('--mt-r2');
}

function cycleGameModeFromTitleClick() {
  if (menuScreen && menuScreen.classList.contains('hidden')) return;
  const now = performance.now();
  if (menuTitleModeLockUntil > 0 && now < menuTitleModeLockUntil) {
    playMenuDenySound();
    return;
  }
  // If the Local/Online picker or online panel is open, close when changing modes.
  if (menuStartStage === 'choose' || menuStartStage === 'online') {
    setMenuStartStage('start');
    const row = menuStart ? menuStart.closest('.menu-start-row') : null;
    if (row) row.classList.remove('t1-forward', 't1-back', 't2-forward', 't2-back', 't0-back');
    nextRunIsLocal = false;
    localPlayEnabled = false;
  }
  // Close online overlay if open
  const _olPanel = document.getElementById('menu-start-online-panel');
  if (_olPanel && !_olPanel.classList.contains('hidden')) {
    _olPanel.classList.add('hidden');
    onlineCloseAll();
  }
  runMenuTitleJiggle();
  const i = GAME_MODE_CYCLE.indexOf(gameMode);
  const nextIdx = (i < 0 ? 0 : i + 1) % GAME_MODE_CYCLE.length;
  gameMode = GAME_MODE_CYCLE[nextIdx];
  saveSelectedMode();
  {
    menuTitleModeSpamTimes.push(now);
    const cutoff = now - MENU_TITLE_MODE_SPAM_WINDOW_MS;
    while (menuTitleModeSpamTimes.length && menuTitleModeSpamTimes[0] < cutoff) {
      menuTitleModeSpamTimes.shift();
    }
    if (menuTitleModeSpamTimes.length >= 10) {
      unlockAchievement('hidden_dizzy_mode_switch');
      const until = now + MENU_TITLE_DIZZY_COOLDOWN_MS;
      menuTitleModeLockUntil = until;
      setMenuTitleTooltipOverride('어지러우니 잠시만 쉬죠', until);
      setTimeout(() => {
        clearMenuTitleTooltipOverrideIfNeeded(performance.now());
      }, MENU_TITLE_DIZZY_COOLDOWN_MS + 50);
    }
  }
  syncMenuTitleColorFromGameMode();
  updateMenuHighScoreDisplay();
  playMenuUiSound('soft');
  updatePracticePanelVisibility();
}

// ===== 메뉴 허브 (업적 / 꾸미기 / 퀘스트 / 상세정보 2x2) =====
const menuHubWrap = document.getElementById('menu-hub-wrap');
const menuHubToggle = document.getElementById('menu-hub-toggle');
const menuHubPanel = document.getElementById('menu-hub-panel');
const menuCustomizePanel = document.getElementById('menu-customize-panel');
const menuQuestPanel = document.getElementById('menu-quest-panel');

// 상세정보는 좌상단으로 분리(허브 아님). 뽑기가 허브 그리드에 들어옴.
const menuGachaPanel = document.getElementById('menu-gacha-panel');

// 모바일: 허브 패널들 + 상세정보 패널을 body 직속으로(메뉴 transform:scale 영향권 밖). 토글은 메뉴에 유지.
if (IS_MOBILE) {
  [menuHubPanel, achievementsPanel, menuCustomizePanel, menuQuestPanel, menuGachaPanel, menuInfoPanel].forEach(p => {
    if (p && p.parentElement !== document.body) document.body.appendChild(p);
  });
}

const hubPanels = {
  grid: menuHubPanel,
  achievements: achievementsPanel,
  customize: menuCustomizePanel,
  quest: menuQuestPanel,
  gacha: menuGachaPanel
};
let hubView = null;
function setHubView(view) {
  hubView = view;
  for (const key in hubPanels) {
    const p = hubPanels[key];
    if (!p) continue;
    const on = key === view;
    p.classList.toggle('is-open', on);
    p.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  if (menuHubToggle) {
    const open = view !== null;
    menuHubToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuHubToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  }
}
function isHubOpen() { return hubView !== null; }

if (menuHubToggle) {
  menuHubToggle.addEventListener('click', e => {
    e.stopPropagation();
    playMenuUiSound('soft');
    setMenuInfoOpen(false); // 상세정보 열려있으면 닫기
    setHubView(hubView === null ? 'grid' : null);
  });
}
if (menuHubPanel) {
  menuHubPanel.querySelectorAll('.menu-hub-item').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      playMenuUiSound('primary');
      setHubView(btn.getAttribute('data-hub'));
    });
  });
}
// 각 패널의 뒤로가기(←) → 그리드로 복귀
document.querySelectorAll('[data-hub-back]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    playMenuUiSound('soft');
    setHubView('grid');
  });
});

// ===== 상세정보(좌상단, 허브와 별개) =====
function setMenuInfoOpen(open) {
  if (!menuInfoPanel || !menuInfoToggle) return;
  menuInfoPanel.classList.toggle('is-open', open);
  menuInfoToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuInfoToggle.setAttribute('aria-label', open ? '상세정보 닫기' : '상세정보 열기');
  menuInfoPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
}
if (menuInfoToggle && menuInfoPanel) {
  menuInfoToggle.addEventListener('click', e => {
    e.stopPropagation();
    playMenuUiSound('soft');
    const next = !menuInfoPanel.classList.contains('is-open');
    setHubView(null); // 허브 열려있으면 닫기
    if (next) setMenuInfoTab('score');
    setMenuInfoOpen(next);
  });
}
if (menuInfoClose) {
  menuInfoClose.addEventListener('click', e => {
    e.stopPropagation();
    playMenuUiSound('soft');
    setMenuInfoOpen(false);
  });
}
[[menuInfoTabScore, 'score'], [menuInfoTabModes, 'modes'], [menuInfoTabPatchnotes, 'patchnotes']].forEach(([tab, id]) => {
  if (!tab) return;
  tab.addEventListener('click', e => {
    e.stopPropagation();
    playMenuUiSound('soft');
    setMenuInfoTab(id);
  });
});

// 바깥 클릭 시 허브 닫기 (모바일: 패널이 body로 이동돼 있으므로 각 패널도 함께 검사)
document.addEventListener('click', e => {
  const startRow = menuStart ? menuStart.closest('.menu-start-row') : null;
  const inStartUi =
    (startRow && startRow.contains(e.target)) ||
    (menuStart && menuStart.contains(e.target)) ||
    (menuStartChoices && menuStartChoices.contains(e.target));
  if (!inStartUi && menuStartStage === 'choose') {
    closeMenuStartToStart();
  }
  // 상세정보(좌상단) 바깥 클릭 시 닫기
  if (menuInfoPanel && menuInfoPanel.classList.contains('is-open')) {
    const inInfo = (menuInfoWrap && menuInfoWrap.contains(e.target)) || menuInfoPanel.contains(e.target);
    if (!inInfo) {
      playMenuUiSound('soft');
      setMenuInfoOpen(false);
    }
  }
  // 허브 바깥 클릭 시 닫기
  if (!isHubOpen()) return;
  const inHub =
    (menuHubWrap && menuHubWrap.contains(e.target)) ||
    Object.keys(hubPanels).some(k => hubPanels[k] && hubPanels[k].contains(e.target));
  if (!inHub) {
    playMenuUiSound('soft');
    setHubView(null);
  }
});

// ============================================================
// 비늘(재화) & 꾸미기(뱀 머리 장신구)
// ============================================================
const SCALES_KEY = 'snakombo_scales_v1';
function getScales() {
  try {
    const v = parseInt(localStorage.getItem(SCALES_KEY), 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch (_) { return 0; }
}
function setScales(n) {
  const t = Math.max(0, Math.floor(n) || 0);
  try { localStorage.setItem(SCALES_KEY, String(t)); } catch (_) {}
  updateScalesUI();
  try { updateGachaUI(); } catch (_) {}
  return t;
}
function addScales(n) {
  n = Math.floor(n);
  if (!(n > 0)) return getScales();
  return setScales(getScales() + n);
}
function updateScalesUI() {
  const el = document.getElementById('scales-count');
  if (el) el.textContent = String(getScales());
}

// 장신구: SVG 에셋을 캔버스(뱀 머리)에 렌더 + 꾸미기/뽑기 목록.
const ACCESSORY_GRADES = {
  common:    { label: '일반', cls: 'grade-common' },
  limited:   { label: '한정판', cls: 'grade-limited' }
};

function emojiAssetSrc(codepoint) {
  return 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/' + codepoint + '.svg';
}

const ACCESSORIES = {
  none: { id: 'none', name: '없음', grade: null, desc: '장신구를 착용하지 않습니다.' },
  baseball_red: { id: 'baseball_red', name: '야구모자(빨강)', grade: 'common', desc: '빨간색 기본 야구모자.', src: emojiAssetSrc('1f9e2'), drawScale: 1.9 },
  baseball_blue: { id: 'baseball_blue', name: '야구모자(파랑)', grade: 'common', desc: '파란색 기본 야구모자.', src: emojiAssetSrc('1f9e2'), drawScale: 1.9 },
  baseball_yellow: { id: 'baseball_yellow', name: '야구모자(노랑)', grade: 'common', desc: '노란색 기본 야구모자.', src: emojiAssetSrc('1f9e2'), drawScale: 1.9 },
  mint_cap: { id: 'mint_cap', name: '실크햇', grade: 'common', desc: '깔끔한 검은색 실크햇.', src: emojiAssetSrc('1f3a9'), drawScale: 1.9 },
  pebble_crown: { id: 'pebble_crown', name: '하얀 꽃핀', grade: 'common', desc: '머리 위에 피어난 작은 꽃핀.', src: emojiAssetSrc('1f33c'), drawScale: 1.85 },
  ruby_crown: { id: 'ruby_crown', name: '졸업모', grade: 'limited', desc: '한정판 졸업모 장신구.', src: emojiAssetSrc('1f393'), drawScale: 1.92 }
};
const ACCESSORY_KEY = 'snakombo_accessory_v1';
const OWNED_ACCESSORIES_KEY = 'snakombo_owned_accessories_v1';
const GACHA_COST = 75;
const DUPLICATE_SCALE_REWARD = { common: 75, limited: 350 };
const ACCESSORY_IDS = Object.keys(ACCESSORIES).filter(id => id !== 'none');
const ACCESSORY_BY_GRADE = ACCESSORY_IDS.reduce((acc, id) => {
  const grade = ACCESSORIES[id].grade;
  if (!acc[grade]) acc[grade] = [];
  acc[grade].push(id);
  return acc;
}, {});
const accessoryImages = {};

function loadOwnedAccessories() {
  let ids = [];
  try {
    const raw = localStorage.getItem(OWNED_ACCESSORIES_KEY);
    if (raw) ids = JSON.parse(raw);
  } catch (_) {}
  if (!Array.isArray(ids)) ids = [];
  ids = ids.filter(id => ACCESSORIES[id]);
  if (!ids.includes('none')) ids.unshift('none');
  try {
    const saved = localStorage.getItem(ACCESSORY_KEY);
    if (saved && ACCESSORIES[saved] && !ids.includes(saved)) ids.push(saved);
  } catch (_) {}
  return Array.from(new Set(ids));
}
let ownedAccessories = loadOwnedAccessories();
function saveOwnedAccessories() {
  try { localStorage.setItem(OWNED_ACCESSORIES_KEY, JSON.stringify(ownedAccessories)); } catch (_) {}
}
function isAccessoryOwned(id) {
  return id === 'none' || ownedAccessories.includes(id);
}
function addOwnedAccessory(id) {
  if (!ACCESSORIES[id]) return false;
  if (isAccessoryOwned(id)) return false;
  ownedAccessories.push(id);
  saveOwnedAccessories();
  updateGachaUI();
  return true;
}

let equippedAccessory = 'none';
try {
  const _savedAcc = localStorage.getItem(ACCESSORY_KEY);
  if (_savedAcc && ACCESSORIES[_savedAcc]) equippedAccessory = _savedAcc;
} catch (_) {}

function preloadAccessories() {
  for (const k in ACCESSORIES) {
    const a = ACCESSORIES[k];
    if (!a.src) continue;
    const img = new Image();
    if (/^https?:\/\//.test(a.src)) img.crossOrigin = 'anonymous';
    img.src = a.src;
    accessoryImages[k] = img;
  }
}
function setAccessory(id) {
  if (!ACCESSORIES[id]) return;
  equippedAccessory = id;
  try { localStorage.setItem(ACCESSORY_KEY, id); } catch (_) {}
  updateCustomizeSelectionUI();
}
// 장신구 기울기(회전 관성) 상태 — 뱀이 꺾일 때 살짝 기울어짐(약하게)
let accSway = 0, accSwayVel = 0, accPrevHeading = null;
// 게임 캔버스: 모자를 머리 "위에"(크라운/정수리) 얹음 + 약한 기울기 스윙. 흰 뱀과 구분되게 옅은 그림자.
function drawSnakeAccessory(head, neck) {
  if (equippedAccessory === 'none' || !head) return;
  const img = accessoryImages[equippedAccessory];
  if (!img || !img.complete || !img.naturalWidth) return;

  // 앞쪽 끝이 아니라 진행 반대(뒤)로 살짝 이동해 크라운에 얹히게 + 기울기 스윙
  let ax = head.x, ay = head.y;
  if (neck) {
    const dx = head.x - neck.x, dy = head.y - neck.y;
    const len = Math.hypot(dx, dy) || 1;
    ax -= (dx / len) * HEAD_WIDTH * 0.5;
    ay -= (dy / len) * HEAD_WIDTH * 0.5;

    const heading = Math.atan2(dy, dx);
    let turn = 0;
    if (accPrevHeading !== null) {
      turn = heading - accPrevHeading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      turn = clamp(turn, -0.5, 0.5); // 리스폰 등 순간이동 스파이크 무시
    }
    accPrevHeading = heading;
    const target = -turn * 1.8;                       // 기울기 강도(기존 2.6 → 약하게)
    accSwayVel += (target - accSway) * 0.22;          // 스프링
    accSwayVel *= 0.82;                                // 감쇠
    accSway = clamp(accSway + accSwayVel, -0.42, 0.42); // 최대 기울기 축소(기존 0.6)
  }

  const accessory = ACCESSORIES[equippedAccessory] || {};
  const W = HEAD_WIDTH * (accessory.drawScale || 1.9);
  const H = W * (img.naturalHeight / img.naturalWidth);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.translate(ax, ay - HEAD_WIDTH * 0.62);
  ctx.rotate(-0.14 + accSway);
  ctx.drawImage(img, -W * 0.52, -H * 0.83, W, H);
  ctx.restore();
}

// 꾸미기 목록: 업적처럼 세로로 쌓이는 카드. 장신구 이미지만 표시. (등급은 grade로 확장)
function renderCustomizeList() {
  const list = document.getElementById('customize-list');
  if (!list) return;
  list.innerHTML = '';
  for (const k in ACCESSORIES) {
    const a = ACCESSORIES[k];
    const card = document.createElement('div');
    card.className = 'customize-card' + (a.id === equippedAccessory ? ' is-selected' : '');
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-accessory', a.id);
    if (a.grade) card.setAttribute('data-grade', a.grade);

    // 왼쪽: 장신구 이미지
    const thumb = document.createElement('div');
    thumb.className = 'customize-thumb';
    if (a.src) {
      const im = document.createElement('img');
      im.src = a.src;
      im.alt = a.name;
      thumb.appendChild(im);
    } else {
      thumb.classList.add('is-empty');
    }
    card.appendChild(thumb);

    // 오른쪽: 이름 + 등급 + 설명
    const info = document.createElement('div');
    info.className = 'customize-info';
    const titleRow = document.createElement('div');
    titleRow.className = 'customize-title-row';
    const name = document.createElement('span');
    name.className = 'customize-name';
    name.textContent = a.name;
    titleRow.appendChild(name);
    if (a.grade && ACCESSORY_GRADES[a.grade]) {
      const g = ACCESSORY_GRADES[a.grade];
      const kind = document.createElement('span');
      kind.className = 'customize-kind ' + g.cls;
      kind.textContent = g.label;
      titleRow.appendChild(kind);
    }
    info.appendChild(titleRow);
    if (a.desc) {
      const desc = document.createElement('p');
      desc.className = 'customize-desc';
      desc.textContent = a.desc;
      info.appendChild(desc);
    }
    card.appendChild(info);

    card.addEventListener('click', () => {
      playMenuUiSound('soft');
      setAccessory(a.id);
    });
    list.appendChild(card);
  }
}
function updateCustomizeSelectionUI() {
  document.querySelectorAll('.customize-card').forEach(card => {
    card.classList.toggle('is-selected', card.getAttribute('data-accessory') === equippedAccessory);
  });
}

const gachaDrawButton = document.getElementById('gacha-draw-button');
const gachaStage = document.getElementById('gacha-stage');
const gachaResultIcon = document.getElementById('gacha-result-icon');
const gachaResultKicker = document.getElementById('gacha-result-kicker');
const gachaResultTitle = document.getElementById('gacha-result-title');
const gachaResultDesc = document.getElementById('gacha-result-desc');
const gachaOwnedSummary = document.getElementById('gacha-owned-summary');
let gachaRolling = false;

const GACHA_TABLE = [
  { type: 'scales', amount: 30, weight: 30 },
  { type: 'scales', amount: 75, weight: 15 },
  { type: 'scales', amount: 300, weight: 5 },
  { type: 'accessory', grade: 'common', weight: 50 }
];

function updateGachaUI() {
  if (gachaDrawButton) gachaDrawButton.disabled = gachaRolling || getScales() < GACHA_COST;
  if (gachaOwnedSummary) {
    const ownedCount = ownedAccessories.filter(id => id !== 'none').length;
    gachaOwnedSummary.textContent = '보유 장신구 ' + ownedCount + '/' + ACCESSORY_IDS.length;
  }
}
function setGachaStage({ rarity, kicker, title, desc, src, symbol }) {
  if (gachaStage) {
    gachaStage.dataset.rarity = rarity || 'idle';
    gachaStage.classList.remove('is-reveal');
    void gachaStage.offsetWidth;
    if (rarity && rarity !== 'idle') gachaStage.classList.add('is-reveal');
  }
  if (gachaResultKicker) gachaResultKicker.textContent = kicker || '';
  if (gachaResultTitle) gachaResultTitle.textContent = title || '';
  if (gachaResultDesc) gachaResultDesc.textContent = desc || '';
  if (gachaResultIcon) {
    gachaResultIcon.innerHTML = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      gachaResultIcon.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.textContent = symbol || '?';
      gachaResultIcon.appendChild(span);
    }
  }
}
function pickGachaReward() {
  const total = GACHA_TABLE.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const reward of GACHA_TABLE) {
    roll -= reward.weight;
    if (roll < 0) return reward;
  }
  return GACHA_TABLE[GACHA_TABLE.length - 1];
}
function pickAccessoryIdByGrade(grade) {
  const ids = ACCESSORY_BY_GRADE[grade] || [];
  return ids[Math.floor(Math.random() * ids.length)] || null;
}
function gradeLabel(grade) {
  return ACCESSORY_GRADES[grade] ? ACCESSORY_GRADES[grade].label : '';
}
function revealGachaReward(reward) {
  if (reward.type === 'scales') {
    addScales(reward.amount);
    setGachaStage({
      rarity: 'scales',
      kicker: '비늘 보상',
      title: reward.amount + '비늘 획득',
      desc: '반짝이는 비늘이 지갑에 들어왔습니다.',
      symbol: '◆'
    });
    gachaRolling = false;
    updateGachaUI();
    playMenuUiSound('primary');
    return;
  }

  const id = pickAccessoryIdByGrade(reward.grade);
  const item = ACCESSORIES[id];
  if (!item) {
    gachaRolling = false;
    updateGachaUI();
    return;
  }
  const duplicate = isAccessoryOwned(id);
  setGachaStage({
    rarity: item.grade,
    kicker: gradeLabel(item.grade) + ' 장신구',
    title: item.name,
    desc: duplicate ? '이미 보유 중인 장신구입니다. 대체 보상으로 전환합니다.' : item.desc,
    src: item.src
  });
  playMenuUiSound(item.grade === 'limited' ? 'primary' : 'soft');

  if (!duplicate) {
    addOwnedAccessory(id);
    renderCustomizeList();
    gachaRolling = false;
    updateGachaUI();
    return;
  }

  setTimeout(() => {
    const refund = DUPLICATE_SCALE_REWARD[item.grade] || 0;
    addScales(refund);
    setGachaStage({
      rarity: 'scales',
      kicker: '중복 대체 보상',
      title: refund + '비늘 획득',
      desc: item.name + '이(가) 대체 보상으로 바뀌었습니다.',
      symbol: '◆'
    });
    gachaRolling = false;
    updateGachaUI();
  }, 900);
}
function startGachaDraw() {
  if (gachaRolling) return;
  if (getScales() < GACHA_COST) {
    playMenuDenySound();
    setGachaStage({
      rarity: 'idle',
      kicker: '비늘 부족',
      title: '75비늘이 필요합니다',
      desc: '게임을 플레이해서 비늘을 더 모아주세요.',
      symbol: '!'
    });
    return;
  }
  gachaRolling = true;
  setScales(getScales() - GACHA_COST);
  updateGachaUI();
  playMenuUiSound('primary');
  if (gachaStage) gachaStage.classList.add('is-rolling');
  setGachaStage({
    rarity: 'idle',
    kicker: '두근두근...',
    title: '뽑는 중',
    desc: '상자가 열리고 있습니다.',
    symbol: '?'
  });
  const reward = pickGachaReward();
  setTimeout(() => {
    if (gachaStage) gachaStage.classList.remove('is-rolling');
    revealGachaReward(reward);
  }, 720);
}
if (gachaDrawButton) {
  gachaDrawButton.addEventListener('click', e => {
    e.stopPropagation();
    startGachaDraw();
  });
}

preloadAccessories();
updateScalesUI();
renderCustomizeList();
saveOwnedAccessories();
updateGachaUI();

if (menuTitle) {
  menuTitle.addEventListener('click', e => {
    e.stopPropagation();
    cycleGameModeFromTitleClick();
  });
  menuTitle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cycleGameModeFromTitleClick();
    }
  });
}

function setPracticePanelCollapsed(collapsed) {
  practicePanelCollapsed = !!collapsed;
  if (practicePanelWrap) practicePanelWrap.classList.toggle('is-collapsed', practicePanelCollapsed);
  // body는 CSS 전환으로 접힘 처리
  if (practicePanelToggle) {
    const icon = document.getElementById('practice-panel-toggle-icon');
    if (icon) icon.textContent = practicePanelCollapsed ? '▸' : '▾';
    practicePanelToggle.setAttribute('aria-expanded', practicePanelCollapsed ? 'false' : 'true');
  }
  savePracticePanelUiState();
  applyPracticePanelPauseState();
}

function syncPracticePanelUI() {
  if (!practiceSpeed || !practiceTurn || !practiceSpawn || !practiceCombo || !practiceInvincible) return;
  practiceSpeed.value = String(practiceSettings.speedMult);
  practiceTurn.value = String(practiceSettings.turnMult);
  practiceSpawn.value = String(practiceSettings.spawnRateMult);
  practiceCombo.value = String(practiceSettings.comboHoldMult);
  practiceInvincible.checked = !!practiceSettings.invincible;
  if (practiceSpeedVal) practiceSpeedVal.textContent = practiceSettings.speedMult.toFixed(1) + '×';
  if (practiceTurnVal) practiceTurnVal.textContent = practiceSettings.turnMult.toFixed(1) + '×';
  if (practiceSpawnVal) practiceSpawnVal.textContent = practiceSettings.spawnRateMult.toFixed(1) + '×';
  if (practiceComboVal) practiceComboVal.textContent = practiceSettings.comboHoldMult.toFixed(1) + '×';
}

function updatePracticePanelVisibility() {
  if (!practicePanelWrap) return;
  const show = isPracticeRun();
  practicePanelWrap.classList.toggle('hidden', !show);
  practicePanelWrap.setAttribute('aria-hidden', show ? 'false' : 'true');
  applyPracticePanelPauseState();
}

function setupPracticePanelEvents() {
  if (practicePanelToggle) {
    practicePanelToggle.addEventListener('click', e => {
      e.stopPropagation();
      playMenuUiSound('soft');
      setPracticePanelCollapsed(!practicePanelCollapsed);
    });
  }
  const bindRange = (el, key, valEl) => {
    if (!el) return;
    el.addEventListener('input', () => {
      const n = clamp(parseFloat(el.value), 0.5, 3);
      practiceSettings[key] = n;
      if (valEl) valEl.textContent = n.toFixed(1) + '×';
      savePracticeSettings();
    });
  };
  bindRange(practiceSpeed, 'speedMult', practiceSpeedVal);
  bindRange(practiceTurn, 'turnMult', practiceTurnVal);
  bindRange(practiceSpawn, 'spawnRateMult', practiceSpawnVal);
  bindRange(practiceCombo, 'comboHoldMult', practiceComboVal);
  if (practiceInvincible) {
    practiceInvincible.addEventListener('change', () => {
      practiceSettings.invincible = !!practiceInvincible.checked;
      savePracticeSettings();
    });
  }
}

let practicePanelPausedGame = false;
function applyPracticePanelPauseState() {
  if (!isPracticeRun()) {
    if (practicePanelPausedGame) {
      practicePanelPausedGame = false;
      if (!gameOver) paused = false;
    }
    if (practicePanelDim) practicePanelDim.classList.add('hidden');
    return;
  }
  const shouldPause = !practicePanelCollapsed;
  if (practicePanelDim) practicePanelDim.classList.toggle('hidden', !shouldPause);
  if (shouldPause) {
    if (!paused) {
      paused = true;
      escMenuHoldStart = 0;
      practicePanelPausedGame = true;
    }
  } else {
    if (practicePanelPausedGame) {
      practicePanelPausedGame = false;
      if (!gameOver) paused = false;
    }
  }
}

function returnToMainMenu() {
  gameRunning = false;
  paused = false;
  escMenuHoldStart = 0;
  if (onlineStartTimer) { clearTimeout(onlineStartTimer); onlineStartTimer = null; }
  if (typeof onlineCloseAll === 'function') onlineCloseAll();
  // Hide online status indicator
  const _onlineStatusEl = document.getElementById('online-status');
  if (_onlineStatusEl) _onlineStatusEl.classList.add('hidden');
  // Clean up online panel
  const _onlinePanel = document.getElementById('menu-start-online-panel');
  if (_onlinePanel) _onlinePanel.classList.add('hidden');
  stopMenuTitleJiggle();
  setHubView(null);
  setMenuInfoOpen(false);
  tutorialMode = false;
  tutorialSnakeActive = true;
  tutorialStep = 0;
  tutorialStep1State = 'await_keys';
  tutorialStep2State = 'intro';
  tutorialS2_introUntil = 0;
  tutorialS2_passCount = 0;
  tutorialStep3State = 'intro';
  tutorialS3_introUntil = 0;
  tutorialS1_text1FadeStart = 0;
  tutorialS1_challengeEnd = 0;
  tutorialS1_challengeAppearStart = 0;
  tutorialS1_successFadeStart = 0;
  gameStartDelayUntil = 0;
  localPlayEnabled = false;
  nextRunIsLocal = false;
  resetSnake();
  canvas.classList.add('hidden');
  menuScreen.classList.remove('hidden');
  syncMenuTitleColorFromGameMode();
  updateMenuHighScoreDisplay();
  updatePracticePanelVisibility();
  applyMobileMenuScale();
  updatePortraitPrompt();
  maybeShowMainIntro();
}

// === 메인 화면 안내 오버레이 ===
// 튜토리얼 완료(tutorial_done 업적) 직후 메인 화면 복귀 시 1회만 표시.
const MAIN_INTRO_SEEN_KEY = 'snakombo_main_intro_seen';

function isMainIntroSeen() {
  try { return localStorage.getItem(MAIN_INTRO_SEEN_KEY) === '1'; } catch (e) { return true; }
}
function markMainIntroSeen() {
  try { localStorage.setItem(MAIN_INTRO_SEEN_KEY, '1'); } catch (e) {}
}
function positionMainIntroModeTip() {
  const titleEl = document.getElementById('menu-title');
  const tip = document.querySelector('.main-intro-tip-mode');
  if (!titleEl || !tip) return;
  const rect = titleEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const tipMaxWidth = 240;
  const gap = 60;
  // 기본: 제목의 오른쪽에 위치 (화살표는 왼쪽)
  let leftX = rect.right + gap;
  let placeRight = true;
  if (leftX + tipMaxWidth > vw - 16) {
    // 오른쪽으로는 안 들어가면 왼쪽에 배치 (화살표는 오른쪽)
    leftX = rect.left - tipMaxWidth - gap;
    placeRight = false;
    if (leftX < 16) leftX = 16; // 그래도 모자라면 화면 안에 강제 클램프
  }
  const topY = rect.top + rect.height / 2 + 20;
  tip.style.top = topY + 'px';
  tip.style.left = leftX + 'px';
  tip.style.transform = 'translateY(-50%)';
  tip.classList.toggle('is-right-of-title', placeRight);
  tip.classList.toggle('is-left-of-title', !placeRight);
  // 화살표 방향 문자 교체
  const arrow = tip.querySelector('.main-intro-tip-arrow');
  if (arrow) arrow.textContent = placeRight ? '←' : '→';
}
function showMainIntro() {
  const overlay = document.getElementById('main-intro-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('main-intro-open');
  // 모드 툴팁을 제목 옆에 정렬 — 메뉴 페이드인 끝난 뒤까지 재정렬
  positionMainIntroModeTip();
  requestAnimationFrame(positionMainIntroModeTip);
  setTimeout(positionMainIntroModeTip, 400);
  markMainIntroSeen();
}
function hideMainIntro() {
  const overlay = document.getElementById('main-intro-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('main-intro-open');
}
function maybeShowMainIntro() {
  if (isMainIntroSeen()) return;
  let unlocked = [];
  try { unlocked = getAchievementsUnlockedList() || []; } catch (e) {}
  if (!unlocked.includes('tutorial_done')) return;
  showMainIntro();
}
// X 버튼 + 리사이즈 + 메뉴 가시성 와이어업 (main.js 는 defer 라 DOM 파싱 후 실행됨)
(function wireMainIntroClose() {
  const btn = document.getElementById('main-intro-close');
  if (btn) btn.addEventListener('click', hideMainIntro);
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('main-intro-open')) {
      positionMainIntroModeTip();
    }
  });
  // 메뉴가 숨겨지면 (게임 시작/온라인 시작 등) 안내도 같이 숨김
  const menuEl = document.getElementById('menu-screen');
  if (menuEl) {
    const obs = new MutationObserver(() => {
      if (menuEl.classList.contains('hidden') && document.body.classList.contains('main-intro-open')) {
        hideMainIntro();
      }
    });
    obs.observe(menuEl, { attributes: true, attributeFilter: ['class'] });
  }
})();

function startGame() {
  if (gameRunning) return;
  setHubView(null);
  setMenuInfoOpen(false);
  tutorialMode = false;
  tutorialSnakeActive = false;
  tutorialStep = 0;
  gameRunning = true;
  paused = false;
  escMenuHoldStart = 0;
  saveSelectedMode();
  menuScreen.classList.add('hidden');
  canvas.classList.remove('hidden');
  resize();
  // Apply local flag only for this run.
  localPlayEnabled = !!nextRunIsLocal;
  nextRunIsLocal = false;
  pickChaosDebuffsForRun();
  runSegmentDist = SEGMENT_DIST;
  chaosTurnVel = 0;
  chaosTurnHoldMs = 0;
  chaosIntroStartMs = gameMode === 'chaos' ? performance.now() : 0;
  chaosIntroUntil = gameMode === 'chaos' ? (chaosIntroStartMs + 3000) : 0;
  chaosIntroWasActive = gameMode === 'chaos' && chaosIntroUntil > 0;
  resetSnake();
  gameStartDelayUntil = performance.now() + (gameMode === 'multi' ? 500 : 200);
  if (!tutorialMode && gameMode !== 'practice' && gameMode !== 'multi') {
    incrementModePlayCount(gameMode);
  }
  if (!tutorialMode && gameMode === 'normal') {
    const n = incrementPlayCount();
    unlockAchievement('first_play');
    if (n >= 20) unlockAchievement('games_20');
  }
  animate();
  updatePracticePanelVisibility();
}

function startTutorial() {
  if (gameRunning) return;
  setHubView(null);
  setMenuInfoOpen(false);
  gameStartDelayUntil = 0;
  gameRunning = true;
  paused = false;
  escMenuHoldStart = 0;
  localPlayEnabled = false;
  nextRunIsLocal = false;
  menuScreen.classList.add('hidden');
  canvas.classList.remove('hidden');
  resize();
  initTutorialStep1Intro();
  animate();
  updatePracticePanelVisibility();
}

function openTutorial() {
  tutorialModal.classList.remove('hidden');
}

function closeTutorial() {
  tutorialModal.classList.add('hidden');
}

let menuStartStage = 'start'; // 'start' | 'choose'
let menuStartTransitionTimerId = null;
let menuStartInTransition = false;
// Used to prevent "click swallowed" during stage transitions.
// e.g. click "온라인" while start->choose animation is running.
let menuStartPendingAction = null; // 'toStart'

const MENU_START_T1_FORWARD_MS = 440; // start -> choose (matches CSS 420ms)
const MENU_START_T1_BACK_MS = 560; // choose -> start (includes 180ms delay)

function menuStartRowEl() {
  return menuStart ? menuStart.closest('.menu-start-row') : null;
}

function clearMenuStartTransitionTimer() {
  if (menuStartTransitionTimerId !== null) {
    clearTimeout(menuStartTransitionTimerId);
    menuStartTransitionTimerId = null;
  }
}

function setMenuStartStage(next) {
  const row = menuStartRowEl();
  menuStartStage = next;
  if (row) row.dataset.startStage = next;
  if (menuStartChoices) menuStartChoices.setAttribute('aria-hidden', next === 'choose' ? 'false' : 'true');
}

function runMenuStartTransition(kind) {
  const row = menuStartRowEl();
  if (!row) return;
  if (menuStartInTransition) return;
  menuStartInTransition = true;
  clearMenuStartTransitionTimer();

  row.classList.remove('t1-forward', 't1-back');

  let ms = 0;
  if (kind === 't1-forward') {
    row.classList.add('t1-forward');
    // Keep aria visible for animation, then stabilize
    if (menuStartChoices) menuStartChoices.setAttribute('aria-hidden', 'false');
    ms = MENU_START_T1_FORWARD_MS;
    menuStartTransitionTimerId = setTimeout(() => {
      row.classList.remove('t1-forward');
      setMenuStartStage('choose');
      menuStartInTransition = false;
      menuStartTransitionTimerId = null;
      // Flush pending clicks that happened during the animation
      if (menuStartPendingAction === 'toStart') {
        menuStartPendingAction = null;
        closeMenuStartToStart();
      }
    }, ms);
    return;
  }
  if (kind === 't1-back') {
    row.classList.add('t1-back');
    if (menuStartChoices) menuStartChoices.setAttribute('aria-hidden', 'false');
    ms = MENU_START_T1_BACK_MS;
    menuStartTransitionTimerId = setTimeout(() => {
      row.classList.remove('t1-back');
      setMenuStartStage('start');
      menuStartInTransition = false;
      menuStartTransitionTimerId = null;
      menuStartPendingAction = null;
    }, ms);
    return;
  }

  // fallback
  menuStartInTransition = false;
}

function openMenuStartChoose() {
  if (menuStartStage !== 'start') return;
  runMenuStartTransition('t1-forward');
}

function closeMenuStartToStart() {
  if (menuStartInTransition) {
    menuStartPendingAction = 'toStart';
    return;
  }
  if (menuStartStage === 'choose') {
    runMenuStartTransition('t1-back');
  }
}
function startLocalFromMenu() {
  playMenuUiSound('primary');
  nextRunIsLocal = true;
  closeMenuStartToStart();
  startGame();
}

// Initialize start menu stage (enables pointer events via CSS)
setMenuStartStage(menuStartStage);

menuStart.addEventListener('click', e => {
  e.stopPropagation();
  if (getStartLockRequirementText()) {
    playMenuDenySound();
    return;
  }
  // Only show Local/Online picker in multiplayer mode.
  if (gameMode === 'multi') {
    playMenuUiSound('soft');
    openMenuStartChoose();
  } else {
    playMenuUiSound('primary');
    nextRunIsLocal = false;
    localPlayEnabled = false;
    startGame();
  }
});
menuTutorial.addEventListener('click', () => {
  playMenuUiSound('primary');
  startTutorial();
});
menuStart.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (getStartLockRequirementText()) {
      playMenuDenySound();
      return;
    }
    if (gameMode === 'multi') {
      playMenuUiSound('soft');
      openMenuStartChoose();
    } else {
      playMenuUiSound('primary');
      nextRunIsLocal = false;
      localPlayEnabled = false;
      startGame();
    }
  }
});
if (menuStartLocal) {
  menuStartLocal.addEventListener('click', e => {
    e.stopPropagation();
    startLocalFromMenu();
  });
  menuStartLocal.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startLocalFromMenu();
    }
  });
}
if (menuStartOnline) {
  menuStartOnline.addEventListener('click', e => {
    e.stopPropagation();
    playMenuUiSound('soft');
    openOnlinePanel();
  });
  menuStartOnline.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playMenuUiSound('soft');
      openOnlinePanel();
    }
  });
}
// ── Online multiplayer panel wiring ──
const onlineLobby = document.getElementById('online-lobby');
const onlineHostWaiting = document.getElementById('online-host-waiting');
const onlineClientJoining = document.getElementById('online-client-joining');
const onlineConnectedPanel = document.getElementById('online-connected');
const onlineErrorPanel = document.getElementById('online-error');
const onlineErrorText = document.getElementById('online-error-text');
const onlineRoomCodeDisplay = document.getElementById('online-room-code-display');
const onlineCreateBtn = document.getElementById('online-create-btn');
const onlineJoinBtn = document.getElementById('online-join-btn');
const onlineJoinInput = document.getElementById('online-join-input');
const onlineCopyBtn = document.getElementById('online-copy-btn');
const onlineCancelBtn = document.getElementById('online-cancel-btn');
const onlineCancelJoinBtn = document.getElementById('online-cancel-join-btn');
const onlineBackBtn = document.getElementById('online-back-btn');
const onlineErrorBackBtn = document.getElementById('online-error-back-btn');
const onlineStatusEl = document.getElementById('online-status');
const onlineStatusDot = document.getElementById('online-status-dot');
const onlineStatusText = document.getElementById('online-status-text');
const onlinePanel = document.getElementById('menu-start-online-panel');

function showOnlineSubPanel(panel) {
  [onlineLobby, onlineHostWaiting, onlineClientJoining, onlineConnectedPanel, onlineErrorPanel].forEach(p => {
    if (p) p.classList.toggle('hidden', p !== panel);
  });
}

function openOnlinePanel() {
  showOnlineSubPanel(onlineLobby);
  if (onlinePanel) onlinePanel.classList.remove('hidden');
}

function closeOnlinePanel() {
  if (onlinePanel) onlinePanel.classList.add('hidden');
  onlineCloseAll();
}

function showOnlineError(msg) {
  if (onlineErrorText) onlineErrorText.textContent = msg || '연결 실패';
  showOnlineSubPanel(onlineErrorPanel);
}

function showOnlineStatus(state) {
  if (!onlineStatusEl) return;
  if (state === 'hidden') { onlineStatusEl.classList.add('hidden'); return; }
  onlineStatusEl.classList.remove('hidden');
  if (onlineStatusDot) {
    onlineStatusDot.classList.remove('connecting', 'disconnected');
    if (state === 'connecting') onlineStatusDot.classList.add('connecting');
    if (state === 'disconnected') onlineStatusDot.classList.add('disconnected');
  }
  if (onlineStatusText) {
    onlineStatusText.textContent = state === 'connected' ? '연결됨' : state === 'connecting' ? '연결 중...' : '연결 끊김';
  }
}

let onlineStartTimer = null;
let onlineRestartHostReady = false;
let onlineRestartClientReady = false;

function onlineStartGameBoth() {
  // Host starts game for both
  gameMode = 'multi';
  nextRunIsLocal = true;
  localPlayEnabled = true;
  if (onlinePanel) onlinePanel.classList.add('hidden');
  // Blur any focused input so the text cursor doesn't stay on screen
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  startGame();
}

function onlineDoRestart() {
  onlineRestartHostReady = false;
  onlineRestartClientReady = false;
  resetSnake();
  gameStartDelayUntil = performance.now() + 500;
}

// Create room (host)
if (onlineCreateBtn) {
  onlineCreateBtn.addEventListener('click', () => {
    playMenuUiSound('soft');
    showOnlineSubPanel(onlineHostWaiting);
    if (onlineRoomCodeDisplay) onlineRoomCodeDisplay.textContent = '...';

    onlineCreateRoom({
      onPeerConnected: () => {
        showOnlineSubPanel(onlineConnectedPanel);
        // Send start signal after 1s
        onlineStartTimer = setTimeout(() => {
          onlineStartTimer = null;
          if (!onlineConnected) return;
          onlineSendSignal('start');
          onlineStartGameBoth();
        }, 1000);
      },
      onDisconnected: (reason) => {
        // Clear the start timer so a pending 1.5s countdown doesn't fire
        if (onlineStartTimer) { clearTimeout(onlineStartTimer); onlineStartTimer = null; }
        if (gameRunning) {
          // Mid-game disconnect
          showOnlineStatus('disconnected');
          if (!gameOver) {
            gameOver = true;
            paused = false;
          }
        } else {
          showOnlineError('상대와의 연결이 끊어졌습니다');
        }
      },
      onRestartReady: () => {
        // Client pressed Space
        onlineRestartClientReady = true;
        if (onlineRestartHostReady) {
          setTimeout(() => { onlineSendSignal('restart'); onlineDoRestart(); }, 200);
        }
      },
      onError: (msg) => {
        showOnlineError(msg);
      }
    }).then(code => {
      if (onlineRoomCodeDisplay) onlineRoomCodeDisplay.textContent = code;
    }).catch(err => {
      showOnlineError(err.message || '방 생성 실패');
    });
  });
}

// Join room (client)
if (onlineJoinBtn) {
  onlineJoinBtn.addEventListener('click', () => {
    const code = onlineJoinInput ? onlineJoinInput.value.toUpperCase().trim() : '';
    if (code.length !== 6) {
      if (onlineJoinInput) onlineJoinInput.focus();
      return;
    }
    playMenuUiSound('soft');
    showOnlineSubPanel(onlineClientJoining);

    onlineJoinRoom(code, {
      onConnected: () => {
        showOnlineSubPanel(onlineConnectedPanel);
        // Client waits for 'start' signal from host
      },
      onStartSignal: () => {
        gameMode = 'multi';
        nextRunIsLocal = true;
        localPlayEnabled = true;
        if (onlinePanel) onlinePanel.classList.add('hidden');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
              startGame();
      },
      onStateReceived: (state) => {
        onlineClientPushState(state);
      },
      onRestartReady: () => {
        // Host pressed Space
        onlineRestartHostReady = true;
        // If both ready, client waits for 'restart' signal
      },
      onRestart: () => {
        // Host confirmed both ready — restart
        onlineDoRestart();
      },
      onDisconnected: (reason) => {
        if (onlineStartTimer) { clearTimeout(onlineStartTimer); onlineStartTimer = null; }
        if (gameRunning) {
          showOnlineStatus('disconnected');
          if (!gameOver) {
            gameOver = true;
            paused = false;
          }
        } else {
          showOnlineError('호스트와의 연결이 끊어졌습니다');
        }
      },
      onError: (msg) => {
        showOnlineError(msg);
      }
    }).catch(err => {
      showOnlineError(err.message || '방 참가 실패');
    });
  });
}

// Join input: auto-uppercase, enter to join
if (onlineJoinInput) {
  onlineJoinInput.addEventListener('input', () => {
    onlineJoinInput.value = onlineJoinInput.value.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, '');
  });
  onlineJoinInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && onlineJoinBtn) onlineJoinBtn.click();
  });
}

// Copy room code
if (onlineCopyBtn) {
  onlineCopyBtn.addEventListener('click', () => {
    const code = onlineRoomCodeDisplay ? onlineRoomCodeDisplay.textContent : '';
    if (code && code !== '...' && code !== '----') {
      navigator.clipboard.writeText(code).then(() => {
        onlineCopyBtn.textContent = '복사됨!';
        setTimeout(() => { onlineCopyBtn.textContent = '복사'; }, 1500);
      }).catch(() => {});
    }
  });
}

// Cancel host
if (onlineCancelBtn) {
  onlineCancelBtn.addEventListener('click', () => {
    playMenuUiSound('soft');
    if (onlineStartTimer) { clearTimeout(onlineStartTimer); onlineStartTimer = null; }
    onlineCloseAll();
    showOnlineSubPanel(onlineLobby);
  });
}

// Cancel join
if (onlineCancelJoinBtn) {
  onlineCancelJoinBtn.addEventListener('click', () => {
    playMenuUiSound('soft');
    onlineCloseAll();
    showOnlineSubPanel(onlineLobby);
  });
}

// Back to choose
if (onlineBackBtn) {
  onlineBackBtn.addEventListener('click', () => {
    playMenuUiSound('soft');
    closeOnlinePanel();
  });
}

// Error back
if (onlineErrorBackBtn) {
  onlineErrorBackBtn.addEventListener('click', () => {
    playMenuUiSound('soft');
    onlineCloseAll();
    showOnlineSubPanel(onlineLobby);
  });
}

menuTutorial.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    playMenuUiSound('primary');
    startTutorial();
  }
});
tutorialClose.addEventListener('click', () => {
  playMenuUiSound('soft');
  closeTutorial();
});
tutorialModal.addEventListener('click', e => {
  if (e.target === tutorialModal) {
    playMenuUiSound('soft');
    closeTutorial();
  }
});

refreshAchievementsFromStorage();
loadSelectedMode();
syncMenuTitleColorFromGameMode();
loadPracticeSettings();
syncPracticePanelUI();
loadPracticePanelUiState();
setPracticePanelCollapsed(practicePanelCollapsed);
setupPracticePanelEvents();
updatePracticePanelVisibility();
migrateLegacyHighScoreIfNeeded();
updateMenuHighScoreDisplay();
syncMenuStartLockState();
hideLoadingScreenSoon();

// 테스트: 아무 업적 토스트 계속 띄우기
const ACHIEVEMENT_TOAST_TEST = false;
if (ACHIEVEMENT_TOAST_TEST) {
  const testIds = [
    'first_play',
    'combo_10',
    'devil_44',
    'practice_20min',
    'archdevil_44_hard',
    'hidden_dizzy_mode_switch'
  ];
  let i = 0;
  setInterval(() => {
    const id = testIds[i % testIds.length];
    i++;
    showAchievementToastFromCardId(id);
  }, 3000);
}

document.addEventListener('keydown', e => {
  if (!tutorialModal.classList.contains('hidden')) return;

  if (e.key === 'Escape' && !menuScreen.classList.contains('hidden')) {
    if (onlinePanel && !onlinePanel.classList.contains('hidden')) {
      e.preventDefault();
      playMenuUiSound('soft');
      closeOnlinePanel();
      return;
    }
    if (menuInfoPanel && menuInfoPanel.classList.contains('is-open')) {
      e.preventDefault();
      setMenuInfoOpen(false);
      return;
    }
    if (isHubOpen()) {
      e.preventDefault();
      setHubView(hubView === 'grid' ? null : 'grid');
      return;
    }
  }

  if (e.key === 'Escape') {
    if (!menuScreen.classList.contains('hidden')) return;
    if (!gameRunning) return;
    e.preventDefault();
    if (e.repeat) return;
    if (isOnlineMode()) {
      // Online: ESC always returns to menu (no pause support)
      showOnlineStatus('hidden');
      returnToMainMenu();
      return;
    }
    if (gameOver) {
      returnToMainMenu();
      return;
    }
    if (paused) {
      escMenuHoldStart = performance.now();
      return;
    }
    paused = true;
    return;
  }

  if (e.key === 'Enter' && !menuScreen.classList.contains('hidden')) {
    if (isHubOpen()) return;
    if (menuInfoPanel && menuInfoPanel.classList.contains('is-open')) return;
    if (onlinePanel && !onlinePanel.classList.contains('hidden')) return;
    e.preventDefault();
    playMenuUiSound('primary');
    startGame();
  }
});

window.addEventListener('resize', () => {
  if (menuTitleFlameRafId !== null) resizeMenuTitleFlameCanvas();
});