# NEXUS SYSTEM

ART ARCHIVE와 PAPER LIBRARY를 상위에서 연결하는 통합 관제 시스템입니다.

## Current registry

### A1 · ART ARCHIVE SYSTEM — LIVE
- Operations: ./systems/art-archive/
- Public archive: https://tom981105-web.github.io/art-archive/
- NEXUS에서 `system-status.json`을 읽어 상태 요약을 표시합니다.

### P1 · PAPER LIBRARY SYSTEM — STANDBY
- 다음 구축 대상
- ART ARCHIVE SYSTEM과 동일한 관제 디자인/기능 계열로 연결 예정

## Files
- `index.html` — NEXUS 상위 관제 화면
- `css/style.css` — ART ARCHIVE SYSTEM 계열 UI
- `js/app.js` — 시계, 새로고침, ART ARCHIVE 상태 브리지

각 하위 시스템은 독립 저장소로 유지하고 NEXUS는 상위 관제/진입 레이어 역할을 합니다.


## Migration note
ART ARCHIVE operations UI/runtime is now hosted inside `systems/art-archive/`. The old `art-archive/system.html` is no longer the NEXUS control target.
