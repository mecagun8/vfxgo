# Pixel VFX Editor

브라우저에서 픽셀아트 이펙트를 만들고 스프라이트 시트(PNG), JSON 프리셋, LÖVE2D Lua 로더로 내보내는 에디터입니다.
기본 프리셋 10종에 [pixelfx](https://github.com/mecagun8/pixelfx) 이펙트 244종이 더해져 있습니다.

**웹에서 바로 쓰기: https://mecagun8.github.io/vfxgo/**

## 로컬에서 쓰기

설치할 것은 없습니다. `index.html`을 브라우저로 열면 됩니다. `vendor/pixelfx.js`가 `index.html` 옆에 있어야
pixelfx 이펙트가 목록에 나타납니다.

## pixelfx 업데이트

```bash
git clone https://github.com/mecagun8/pixelfx ../pixelfx
(cd ../pixelfx && npm ci)
node tools/build-pixelfx.mjs ../pixelfx
```

## 배포

GitHub Pages가 `main` 브랜치의 루트를 그대로 서비스합니다(빌드 단계 없음). `.nojekyll`은 Jekyll 처리를 끄기 위한 빈 파일입니다.

## 라이선스

pixelfx는 MIT 라이선스이며 고지 전문은 `vendor/pixelfx.LICENSE`에 있습니다.
