# Media Feed — Frontend Take-Home Assignment

A mobile-first vertical video feed built with **React, TypeScript, Vite, TanStack Query, and Zustand**. This repository presents a standalone take-home assignment focused on playback lifecycle, discrete navigation, resource management, and documented engineering trade-offs.

The feed uses a local mock API and original synthetic demo videos. No backend, credentials, or external CDN are required after installing dependencies.

## Run locally

Use Node.js **22.16.0** from `.nvmrc` and npm 10+.

```bash
# With nvm installed
nvm install
nvm use

npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). To check the production build:

```bash
npm run build
npm run preview
```

Open [localhost:4173](http://localhost:4173). Vite prints the actual URL if the default port is occupied. `npm run typecheck` runs the TypeScript check separately; `build` already includes it.

## What the assignment demonstrates

- Vertical navigation using touch, wheel, and keyboard input.
- Muted autoplay, tap to pause, press and hold for 2× playback, and timeline seeking.
- Configurable automatic advance after one, two, or three plays, or continuous looping.
- Up to nine mounted cards and three attached video elements.
- Network-aware preload hints and a media adapter for MP4, native HLS, and hls.js.
- Cursor-style pagination over 45 mock records, with optimistic likes and a rollback handler.
- Separation of server state, shared UI settings, and local player state.
- Persistent viewed-video history and repeat preferences, plus an in-memory metrics log.

## Controls

| Action | Input |
|---|---|
| Previous / next video | Swipe down / up, mouse wheel, `↑` / `↓` |
| Pause / resume | Tap the video, playback button, or `Space` |
| Toggle mute | Sound button or `M` |
| Temporary 2× speed | Hold the video for more than 420 ms |
| Seek | Click or drag the timeline |
| Like | Heart button |
| Automatic advance | Repeat selector in the toolbar |

Keyboard shortcuts require focus inside the feed. Demo clips have no audio track; the sound control changes mute state, but audible playback requires a different source.

## Engineering documentation

Detailed documentation is currently in Russian. Start with the [documentation index](docs/README.md).

| Topic | Document |
|---|---|
| Development and troubleshooting | [Development](docs/DEVELOPMENT.md) |
| Components, data flow, and state ownership | [Architecture](docs/ARCHITECTURE.md) |
| Gestures, playback, and accessibility | [Interactions](docs/INTERACTIONS.md) |
| HLS, preloading, caching, and performance | [Media](docs/MEDIA.md) |
| Completed checks and manual test scenarios | [Testing](docs/TESTING.md) |
| Known limitations and code review findings | [Project review](docs/PROJECT_REVIEW.md) |
| Production extensions and trade-offs | [Roadmap](docs/ROADMAP.md) |
| Repository publishing and hosting notes | [Publishing](docs/PUBLISHING.md) |

## Project structure

```text
.github/workflows/   # TypeScript and production build checks
public/media/        # Original synthetic MP4 clips and WebP posters
scripts/             # Demo media generator (Python + FFmpeg)
src/
  components/        # Feed, video card, toolbar, and timeline
  hooks/             # Media source, network profile, reduced motion
  lib/               # Mock API, metrics, and viewed-video history
  store/             # Shared UI state
  types/             # Data contracts
  App.tsx
  main.tsx
  styles.css
docs/                # Architecture, verification, limitations, roadmap
```

## Scope and verification

This is a frontend prototype, not a production video platform. Six synthetic clips are reused across the mock catalog. Likes are in memory and reset on reload. HLS integration is prepared in code but has not been validated against a live stream. Accessibility attributes and keyboard controls are present; a full accessibility audit and real-device testing remain outstanding.

A clean dependency installation, TypeScript check, production build, local media delivery, and MP4 range requests have been verified. There is no unit/component/E2E test suite yet. The [project review](docs/PROJECT_REVIEW.md) records lifecycle and interaction issues to address next, and the [testing document](docs/TESTING.md) distinguishes completed checks from proposed scenarios.

GitHub Actions installs dependencies and builds the application. The [first hosted CI run](https://github.com/fesoo/media-feed-test-task/actions/runs/43820847036) passed successfully. The application has no hosted live demo yet.

## Demo assets and license

Demo clips and posters are generated from the palettes and fixed seeds in [generate_demo_media.py](scripts/generate_demo_media.py). Regeneration requires Python 3 and FFmpeg with libx264 and libwebp:

```bash
python3 scripts/generate_demo_media.py
```

FFmpeg is not required to run the application. No third-party footage is included. A project-wide reuse license has not been selected.
