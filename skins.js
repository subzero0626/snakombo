// ============================================================
// Skins — 점수 UI 스킨 (글씨체만 교체하는 심플 버전)
// 특수효과(글로우/외곽선/그라디언트/파티클) 없음. 폰트만 바꾼다.
// main.js 가 기대하는 window.Skins API 계약을 그대로 구현.
// ============================================================
(function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- 테마: 깔끔한 글씨체 + 은은한 색 (8종, 전부 다름) ----------
  const THEMES = {
    classic:  { name: '기본',   font: 'Nunito',    weight: '900', color: '#ffffff' },
    sky:      { name: '하늘',   font: 'Poppins',   weight: '700', color: '#8fd3ff' },
    mint:     { name: '민트',   font: 'Quicksand', weight: '700', color: '#7fe0c4' },
    coral:    { name: '코랄',   font: 'Fredoka',   weight: '600', color: '#ff9e80' },
    lemon:    { name: '레몬',   font: 'Baloo 2',   weight: '700', color: '#ffd95a' },
    lavender: { name: '라벤더', font: 'Comfortaa', weight: '700', color: '#c9b6ff' },
    ink:      { name: '고풍',   font: 'Cinzel',    weight: '700', color: '#e6d3a3' },
    hand:     { name: '한글',   font: 'Jua',       weight: '400', color: '#b6e39a' },
    // 용암: 글씨체 + 용암색 세로 그라디언트 (심플 버전)
    lava:     { name: '용암',   font: 'M PLUS Rounded 1c', weight: '900', color: '#ff7a1a',
                gradient: [[0, '#ffd93b'], [0.5, '#ff7a1a'], [1, '#d81a00']] }
  };

  let activeId = 'classic';
  const theme = () => THEMES[activeId] || THEMES.classic;

  function fontStr(t, size) {
    return t.weight + ' ' + Math.round(size) + 'px "' + t.font + '", Nunito, sans-serif';
  }

  // ---------- 공개 API ----------
  const Skins = {
    getScoreFont(size) { return fontStr(theme(), size); },
    getUnitFont(size) { return fontStr(theme(), size); },
    getComboFont(size) { return fontStr(theme(), size); },

    setScorePos() {},
    setComboPos() {},
    syncEvents() {},
    drawParticles() {},

    drawScore(ctx, text, x, y, opt) {
      opt = opt || {};
      const t = theme();
      const size = opt.size || 40;
      ctx.save();
      ctx.font = fontStr(t, size);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = opt.alpha == null ? 0.9 : Math.max(opt.alpha, 0.88);
      let fill = t.color || '#ffffff';
      if (t.gradient) {
        const g = ctx.createLinearGradient(0, y - size * 0.72, 0, y + size * 0.12);
        for (const stop of t.gradient) g.addColorStop(stop[0], stop[1]);
        fill = g;
      }
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
      ctx.restore();
    },

    drawScoreUnit(ctx, text, x, y, opt) {
      opt = opt || {};
      const t = theme();
      ctx.save();
      ctx.font = fontStr(t, opt.size || 18);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = opt.alpha == null ? 0.5 : opt.alpha;
      ctx.fillStyle = t.color || '#ffffff';
      ctx.fillText(text, x, y);
      ctx.restore();
    },

    drawCombo(ctx, str, x, y, combo, size) {
      size = size || 18;
      // 콤보: 하양 → 빨강 (콤보가 오를수록 붉어짐)
      const k = clamp((combo - 1) / 7, 0, 1);
      const g = Math.round(255 - 210 * k);
      const b = Math.round(255 - 244 * k);
      ctx.save();
      ctx.font = fontStr(theme(), size);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgb(255,' + g + ',' + b + ')';
      ctx.fillText(str, x, y);
      ctx.restore();
    },

    // ---------- 테마 관리 ----------
    list() { return Object.keys(THEMES).map(id => ({ id, name: THEMES[id].name })); },
    getTheme() { return activeId; },
    setTheme(id) {
      if (THEMES[id]) activeId = id;
      return activeId;
    },
    cycleTheme() {
      const ids = Object.keys(THEMES);
      const i = ids.indexOf(activeId);
      return this.setTheme(ids[(i + 1) % ids.length]);
    }
  };

  // 새로고침 시 항상 기본(classic)부터 시작 (저장/복원 없음)
  window.Skins = Skins;

  // S 키로 글씨체 순환 전환 (입력창 포커스 중에는 무시)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 's' && e.key !== 'S') return;
    const el = e.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    Skins.cycleTheme();
  });

  // 표시용 웹폰트 미리 로드(캔버스 렌더 시 폴백 튐 최소화)
  try {
    if (document.fonts && document.fonts.load) {
      ['Poppins', 'Quicksand', 'Fredoka', 'Baloo 2', 'Comfortaa', 'Cinzel', 'Jua', 'M PLUS Rounded 1c'].forEach(function (f) {
        document.fonts.load('900 40px "' + f + '"');
        document.fonts.load('700 40px "' + f + '"');
      });
    }
  } catch (_) {}
})();
