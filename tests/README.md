# Browser acceptance

The test tooling is a development dependency. The files in `dist/` need no install, build, server dependency, or network connection.

```sh
npm ci
npx playwright install chromium
npm test
```

The harness uses `/usr/bin/chromium` when available, otherwise the Playwright Chromium installation. Set `CHROMIUM_PATH` to another Chromium executable when needed. The HTTP server starts on a random local port and stops when testing finishes.

Tests cover the delivered payload, script order, six lazy scene builds, actual WebGL context allocation, viewport suspension checked against the actual section rectangle after every rendered frame, both navigation directions, node price drift and keyboard expansion, visible focus and Tab movement, pointer tilt, German counters, each terminal response, phases, gesture-activated audio, reduced motion including preference changes, recovery after both graphics contexts are lost and independently restored, boot recovery with progress intervals stopped, usable simulation controls while the graphics download is deliberately held, and runtime requests and console messages. The boot check measures its independent 4.2-second timer with reduced motion and stopped intervals, excluding browser setup and navigation time. Normal UI startup releases the overlay immediately. Reduced-motion cold starts must not request Three.js or scene scripts; enabling motion afterwards loads them once. The startup suite holds the Three.js request, operates simulation and phase controls, toggles motion preferences and verifies that late graphics receive those decisions without duplicate downloads. Its UI-ready timestamp is a local diagnostic, not a promised public network latency. Screenshots and `report.json` are written to the ignored `tests/artifacts/` directory.

The harness allows up to 30 seconds for deferred graphics startup, the two-context recovery setup and section reveals during software shader compilation; the functional assertions and dedicated 4.2-second deadline check are unchanged. The FPS sample waits for an actual subsequent renderframe rather than assuming the software GPU advances within a fixed 1.2-second window. Offscreen checks observe actual rendered frames and do not mistake delayed IntersectionObserver delivery for a render outside the viewport.

`npm test` runs ten pure model groups before browser acceptance. `npm run test:simulation` runs those model checks without Chromium. All suites run by default. To isolate a failure, set `ACCEPTANCE_SUITE` to a comma-separated selection of `desktop`, `mobile`, `reduced`, `simulation`, `recovery`, `gpu`, `boot`, and `startup`. The simulation suite verifies causal UI and terminal trades, quotes and fees, invalid-input atomicity, network bindings, phase costs, Vault conditions and yield, paused manual time, real history, reload persistence and confirmed reset. It also checks applied renderer diagnostics for all six scenes before and after actual decisions, recovery from corrupt saved JSON, and working trading/manual time when storage is unavailable. Set `CAPTURE_ALL_SECTIONS=1` to save every section screenshot; the default saves hero and reduced-motion views to limit expensive software GPU readback.

The GPU suite uses DPR 2, visits every scene in both directions, resizes to 1920 × 1080 and returns to cached scenes. It instruments native WebGL create/delete calls and render-target constructors: no per-frame target allocation, three targets per context, quarter-size bloom, the 950,000-pixel cap and the conservative 24.7 MB target budget. With all scenes offscreen, it verifies actual deletion of scene and target resources, including instancing buffers. Only renderer bootstrap resources and the fullscreen quad may remain. These resource counts and estimated target bytes are not a physical VRAM measurement.

The default uses SwiftShader for consistent software rendering. Its measured frame rate is diagnostic and does not establish performance on a physical GPU. Set `USE_SOFTWARE_GPU=0` to use the browser's normal graphics backend. Known Chromium `GPU stall due to ReadPixels` screenshot warnings are retained as `environmentWarnings` in the report; application warnings and errors fail the tests.

Both `file://` and HTTP are tested. If a managed Chromium policy blocks `file://` with `ERR_BLOCKED_BY_ADMINISTRATOR`, the report explicitly records the blocked runs and continues HTTP validation. The harness preserves that policy. Set `REQUIRE_FILE_TEST=1` to return a failing exit status when file navigation is blocked.
