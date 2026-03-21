# YouTube Reward Bot

A Discord bot that verifies YouTube comments and delivers game rewards through DM.

## What This System Does

- Generates one-time claim codes through Discord (`/claim`).
- Verifies user comments on game-specific YouTube videos.
- Validates and consumes codes safely (single-use, expiry-aware, game-aware).
- Delivers rewards through Discord DM (`/yt`).
- Persists state in JSON files with file-level locking for concurrency safety.

## High-Level Architecture

### Runtime Entry Points

- `index.js` - Discord bot runtime and command handling.
- `deploy-commands.js` - Slash command registration (`/claim`, `/yt`).

### Core Layers

- `config/` - constants, claim result enums, status enums, event names.
- `services/` - business logic and external integrations.
- `utils/` - shared helpers (parsing, validation, locking, storage access, logging).
- `data/` - persistent JSON state (`codes.json`, `youtube/*.json`).
- `logs/` - JSON line logs.
- `scripts/` and root `test-*.js` files - operational/manual validation scripts.

## Repository Structure

```text
.
|-- config/
|   |-- claimResult.js
|   |-- constants.js
|   |-- events.js
|   `-- status.js
|-- services/
|   |-- claimRewardService.js
|   |-- codeService.js
|   |-- discordService.js
|   |-- youtubeClaimProcessor.js
|   |-- youtubeCommentService.js
|   `-- youtubeOnDemandRewardService.js
|-- utils/
|   |-- codeReader.js
|   |-- commentParser.js
|   |-- commentStore.js
|   |-- dataLock.js
|   |-- expiryUtils.js
|   |-- fileUtils.js
|   |-- logger.js
|   |-- validationUtils.js
|   `-- youtubeLookup.js
|-- data/
|   |-- codes.json
|   `-- youtube/
|-- logs/
|   `-- app.log
|-- deploy-commands.js
|-- index.js
`-- README.md
```

## End-to-End Data Flow

### Flow A: `/claim <game>`

1. Discord interaction arrives in `index.js`.
2. Global channel validation (`isGlobalChannelAllowed`) runs.
3. Game normalization/validation (`normalizeGame`, `isSupportedGame`) runs.
4. `codeService.createCode(userId, username, game)`:
   - Returns existing valid code, or
   - Creates a new unique code, or
   - Returns `ALREADY_USED` terminal state.
5. Code is sent via DM by `sendClaimCodeMessage`.
6. Ephemeral success/error response is sent to channel.

### Flow B: `/yt <game>`

1. Discord interaction arrives in `index.js`.
2. Channel + game validation runs.
3. `processYouTubeRewardCommand(client, userId, game)` orchestrates:
   - Reads user code from `data/codes.json` via `getCodesReader`.
   - Rejects if missing, used, or expired.
   - Checks existing YouTube processing store via `findCodeInCommentStore`.
4. If needed, `processComments(game)` runs:
   - Fetches top-level YouTube comments (`fetchComments`).
   - Skips already processed comments (`isProcessed`).
   - Parses `username:CODE` (`parseComment`).
   - Validates code (`validateCode`) and consumes (`consumeCode`) if valid.
   - Persists per-comment lifecycle (`saveComment`).
5. On success, reward is DMed through `sendRewardMessage`.
6. Ephemeral channel response confirms completion or reports reason.

## Design Principles

### 1) One Game -> One Video

Every game in `GAME_CONFIG` maps to exactly one YouTube video (`videoId`), which keeps processing deterministic.

### 2) Validation-First Mutation

Codes are consumed only after all checks pass (exists, unused, unexpired, game match).

### 3) Config-Driven Behavior

Core behavior is centralized in config (`CODE_LENGTH`, `CODE_EXPIRY_MS`, `GAME_CONFIG`, status/reason enums).

### 4) File-Lock Concurrency Safety

Critical read-modify-write operations are wrapped with `withLock(...)` from `utils/dataLock.js`.

### 5) Persistent Auditability

State and outcomes are persisted as JSON files and append-only structured logs.

## Data Model

### `data/codes.json`

Object keyed by code:

```json
{
  "ABC123": {
    "userId": "123456789012345678",
    "username": "UserA",
    "game": "GTA-VC",
    "used": false,
    "createdAt": 1710000000000
  }
}
```

### `data/youtube/<videoId>.json`

Per-video comment processing store:

```json
{
  "videoId": "m0vT-8SA4tM",
  "videoName": "Example Video",
  "game": "GTA-VC",
  "meta": {
    "createdAt": 1710000000000,
    "lastFetchedAt": 1710001234000
  },
  "comments": {
    "COMMENT_ID": {
      "raw": "name:ABC123",
      "parsed": { "username": "name", "code": "ABC123" },
      "validation": { "success": true },
      "meta": { "processedAt": 1710001234000 }
    }
  }
}
```

## Important Methods

### Command and Orchestration

- `index.js`
  - Interaction router for `/claim` and `/yt`.

### Claim Code Lifecycle

- `services/codeService.js`
  - `createCode(userId, username, game)` - generate/reuse/expire-aware code creation.

- `services/claimRewardService.js`
  - `validateCode(code, expectedGame)` - non-mutating validation.
  - `consumeCode(code)` - marks code as used.

### YouTube Processing

- `services/youtubeOnDemandRewardService.js`
  - `processYouTubeRewardCommand(client, userId, game)` - `/yt` flow coordinator.

- `services/youtubeClaimProcessor.js`
  - `processComments(game)` - fetch/parse/validate/consume/store pipeline.

- `services/youtubeCommentService.js`
  - `fetchComments(videoId)` - YouTube Data API fetch.

### Storage and Query Helpers

- `utils/commentStore.js`
  - `initStore(videoId, videoName, game)`
  - `isProcessed(videoId, commentId)`
  - `saveComment(videoId, commentId, data)`

- `utils/youtubeLookup.js`
  - `findCodeInCommentStore(videoId, code)` - latest processed result lookup.

- `utils/codeReader.js`
  - `getCodesReader(codesPath)` and reader methods (`findByUser`, `findByCode`).

### Validation and Parsing

- `utils/validationUtils.js`
  - `normalizeGame`, `isSupportedGame`, `isGlobalChannelAllowed`, `getRewardForGame`.

- `utils/commentParser.js`
  - `parseComment(text)` for `username:CODE`.

## Configuration

Set environment variables in `.env`:

```env
BOT_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
YOUTUBE_API_KEY=...
```

Optional:

```env
CODES_FILE_PATH=data/codes.json
GLOBAL_ALLOWED_CHANNELS=1234567890,2345678901
```

## Usage

### 1) Install Dependencies

```bash
npm install
```

### 2) Register Slash Commands

```bash
node deploy-commands.js
```

### 3) Start the Bot

```bash
npm start
```

## Command Usage

### `/claim game:<GAME_CODE>`

- Generates or returns an active claim code for that game.
- Sends the code to DM.
- If code is already used, user gets an error.

### `/yt game:<GAME_CODE>`

- Verifies user comment from the mapped YouTube video.
- Valid comment format: `username:CODE` (example: `Jai:ABC123`).
- If valid and unconsumed, reward is sent by DM.

## Logging and Operations

- Application logs are written to `logs/app.log` as one JSON object per line.
- Useful scripts:
  - `scripts/readCodes.js`
  - `scripts/readLogs.js`
  - `scripts/testYoutube.js`
  - `test-codes-lockfile.js`
  - `test-comments-lockfile.js`
  - `test-scalability.js`

## Troubleshooting

### Commands not visible in Discord

- Re-run command registration:
  - `node deploy-commands.js`
- Verify `.env` values:
  - `BOT_TOKEN`
  - `CLIENT_ID`
  - `GUILD_ID`

### `/claim` or `/yt` says channel not allowed

- Check `GLOBAL_ALLOWED_CHANNELS` in `.env` or default in `config/constants.js`.
- Check per-game `allowedChannelIds` in `GAME_CONFIG`.
- Ensure game channels are a subset of global allowed channels.

### `/yt` says comment not found or failed validation

- Ensure comment format is exactly `username:CODE`.
- Ensure the code belongs to the same game/video.
- Ensure code has not expired and is not already used.
- Retry `/yt` after the comment is visible publicly on YouTube.

### JSON storage issues

- Confirm `data/codes.json` and `data/youtube/` are writable.
- If a store file becomes malformed, back it up and reinitialize.

## Guarantees and Constraints

### Guarantees

- No duplicate code consumption (single-use enforcement).
- No reprocessing of already-seen comments (commentId dedupe).
- Game-specific verification path using `GAME_CONFIG`.

### Constraints

- JSON file storage (no database).
- Synchronous fs operations (adequate for low/moderate load).
- YouTube processing is currently on-demand (`/yt`) rather than scheduled.

## Security Notes

- Never commit real credentials or API keys.
- Rotate secrets immediately if exposed.
- Restrict command channels using `GLOBAL_ALLOWED_CHANNELS` and per-game `allowedChannelIds`.

## Known Limitations

- Storage is file-based JSON, not a database.
- File operations are synchronous and can become a bottleneck at higher scale.
- YouTube verification is on-demand (`/yt`), not scheduler-driven.
- Test suite is script-based; no automated CI test harness yet.
