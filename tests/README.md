# Browser acceptance

The test tooling is a development dependency. The files in `dist/` need no install, build, server dependency, or network connection.

```sh
npm ci
npx playwright install chromium
npm test
```

The harness uses `/usr/bin/chromium` when available, otherwise the Playwright Chromium installation. Set `CHROMIUM_PATH` to another Chromium executable when needed. The HTTP server starts on a random local port and stops when testing finishes.

Tests cover the delivered payload, script order, six lazy scene builds, actual WebGL context allocation, viewport suspension, both navigation directions, node price drift and keyboard expansion, visible focus and Tab movement, pointer tilt, German counters, each terminal response, phases, gesture-activated audio, reduced motion including preference changes, recovery after both graphics contexts are lost and independently restored, boot recovery with progress intervals stopped, and runtime requests and console messages. The boot check measures its 4.2-second timer from scheduling to release, excluding browser setup and navigation time. Screenshots and `report.json` are written to the ignored `tests/artifacts/` directory.

All suites run by default. To isolate a failure, set `ACCEPTANCE_SUITE` to a comma-separated selection of `desktop`, `mobile`, `reduced`, `simulation`, `recovery`, and `boot`. The simulation suite verifies causal UI and terminal trades, quotes and fees, invalid-input atomicity, network bindings, phase costs, Vault conditions and yield, paused manual time, real history, reload persistence and confirmed reset. It also checks applied renderer diagnostics for all six scenes before and after actual decisions, recovery from corrupt saved JSON, and working trading/manual time when storage is unavailable. Set `CAPTURE_ALL_SECTIONS=1` to save every section screenshot; the default saves hero and reduced-motion views to limit expensive software GPU readback.

The default uses SwiftShader for consistent software rendering. Its measured frame rate is diagnostic and does not establish performance on a physical GPU. Set `USE_SOFTWARE_GPU=0` to use the browser's normal graphics backend. Known Chromium `GPU stall due to ReadPixels` screenshot warnings are retained as `environmentWarnings` in the report; application warnings and errors fail the tests.

Both `file://` and HTTP are tested. If a managed Chromium policy blocks `file://` with `ERR_BLOCKED_BY_ADMINISTRATOR`, the report explicitly records the blocked runs and continues HTTP validation. The harness preserves that policy. Set `REQUIRE_FILE_TEST=1` to return a failing exit status when file navigation is blocked.
