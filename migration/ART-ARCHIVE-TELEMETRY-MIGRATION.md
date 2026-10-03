# ART ARCHIVE → NEXUS telemetry migration

## Final ownership

| File | Final repository | Reason |
|---|---|---|
| `automation-status.json` | `tom981105-web/art-archive` | Public ART ARCHIVE reads this file |
| `system-status.json` | `NEXUS-SYSTEM/systems/art-archive/` | SYSTEM-only telemetry |
| `system-events.json` | `NEXUS-SYSTEM/systems/art-archive/` | SYSTEM-only telemetry |
| `system-history.json` | `NEXUS-SYSTEM/systems/art-archive/` | SYSTEM-only telemetry |
| `system-usage.json` | `NEXUS-SYSTEM/systems/art-archive/` | SYSTEM-only telemetry |

## Migration rule

Do **not** move or delete `automation-status.json` from `art-archive`.

Add `apps-script-nexus-target.gs` to the existing Apps Script project **그림 자동화 관리자**, then replace the existing GitHub-write calls for the four SYSTEM-only files with the wrapper functions in that file.

Recommended replacements:

- runtime status → `writeSystemStatusToNexus_(payload)`
- operational event batch → `writeSystemEventsToNexus_(payload)`
- daily/history aggregation → `writeSystemHistoryToNexus_(payload)`
- usage/run analytics → `writeSystemUsageToNexus_(payload)`
- public automation summary → `writePublicAutomationStatus_(payload)`

The adapter reuses the GitHub token already stored in Script Properties and deliberately does not contain a token.

## Safe cutover

1. Add the adapter.
2. Run `testNexusArtSystemTarget()`.
3. Confirm `systems/art-archive/migration-test.json` appears in NEXUS.
4. Replace only the four SYSTEM writer calls.
5. Trigger `checkArtworkCompletion` once.
6. Confirm the four NEXUS JSON files receive newer `updatedAt` values.
7. Switch the NEXUS frontend from the legacy raw source to local JSON.
8. Only after verification, delete the four SYSTEM JSON files from `art-archive`.

The public ART ARCHIVE remains unaffected because it continues reading `automation-status.json` from its own repository.
