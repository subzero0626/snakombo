// tailwind CDN 스크립트 로딩 타이밍에 따라 전역이 없을 수 있어 안전하게 처리
if (typeof tailwind !== 'undefined') tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
};