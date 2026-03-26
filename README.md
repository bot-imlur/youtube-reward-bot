# YouTube Reward Bot

A Discord bot that verifies YouTube comments and delivers game rewards through DM.

## What This System Does

- Generates one-time claim codes through Discord (`/generate`).
- Verifies user comments on game-specific YouTube videos.
- Validates and consumes codes safely (single-use, expiry-aware, game-aware).
- Delivers rewards through Discord DM (`/claim`) as a **30-minute expiry download link** unique to each user.
- Game files are hosted privately on **Cloudflare R2** and served through a **Cloudflare Worker** download gateway.
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
|   |-- r2Service.js
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
|-- worker/                        ← Cloudflare Worker (download gateway)
|   |-- src/
|   |   `-- index.js
|   `-- wrangler.toml
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

### Flow A: `/generate <game>`

1. Discord interaction arrives in `index.js`.
2. Global channel validation (`isGlobalChannelAllowed`) runs.
3. Game normalization/validation (`normalizeGame`, `isSupportedGame`) runs.
4. `codeService.createCode(userId, username, game)`:
   - Returns existing valid code, or
   - Creates a new unique code, or
   - Returns `ALREADY_USED` terminal state.
5. Code is sent via DM by `sendClaimCodeMessage`.
6. Ephemeral success/error response is sent to channel.

### Flow B: `/claim <game>`

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
5. On success, a time-limited **R2 download URL** is generated via `r2Service.generateDownloadUrl` and DMed through `sendRewardMessage`.
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
  "videoId": "YOUR_VIDEO_ID",
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
  - Interaction router for `/generate` and `/claim`.

### Claim Code Lifecycle

- `services/codeService.js`
  - `createCode(userId, username, game)` - generate/reuse/expire-aware code creation.

- `services/claimRewardService.js`
  - `validateCode(code, expectedGame)` - non-mutating validation.
  - `consumeCode(code)` - marks code as used.

### YouTube Processing

- `services/youtubeOnDemandRewardService.js`
  - `processYouTubeRewardCommand(client, userId, game)` - `/claim` flow coordinator.

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

### Reward Delivery

- `services/r2Service.js`
  - `generateDownloadUrl(objectKey, userId, expirySeconds)` — generates an HMAC-authenticated, time-limited URL routed through the Cloudflare Worker.

- `worker/src/index.js`
  - Cloudflare Worker that validates the HMAC token and streams the game file from R2 to the user's browser.

- `utils/commentParser.js`
  - `parseComment(text)` for `username:CODE`.

## Configuration

Set environment variables in `.env` (see `.env.example` for the full list):

```env
# Discord
BOT_TOKEN=
CLIENT_ID=
GUILD_ID=
YOUTUBE_API_KEY=
ADMIN_USER_ID=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Cloudflare Worker (download gateway)
WORKER_SECRET=         # shared secret — also set via: npx wrangler secret put WORKER_SECRET
WORKER_DOMAIN=files.imlur.com
```

Optional:

```env
CODES_FILE_PATH=data/codes.json
GLOBAL_ALLOWED_CHANNELS=1234567890,2345678901
```

### Cloudflare Worker Deployment

The Worker in `worker/` must be deployed once to Cloudflare before rewards can be delivered:

```bash
cd worker
npx wrangler login                          # one-time
npx wrangler secret put WORKER_SECRET       # paste your WORKER_SECRET value
npx wrangler deploy
```

To redeploy after changes:

```bash
npx wrangler deploy
```

## Continuous Deployment (CD)

This project includes a **GitHub Actions auto-deployment workflow** (`.github/workflows/deploy.yml`) designed to run on a local Ubuntu server via a self-hosted runner.

### How it works
1. Whenever a new **GitHub Release** is published, the workflow triggers.
2. The self-hosted runner fetches the new release tag and code.
3. The runner writes the release version to a `.version` file.
4. The deployment script gracefully tears down the old Docker container and rebuilds it.
5. The bot spins up, reads the `.version` file, and logs the running version in the terminal.

### Setting up the CD Runner
1. On your Ubuntu server, go to your GitHub repository -> **Settings** -> **Actions** -> **Runners**.
2. Click **New self-hosted runner** (Select Linux, x64).
3. Run the provided installation commands in your bot's folder (e.g., `~/github-repo/youtube-reward-bot`).
4. Install the runner as a background service so it survives server reboots:
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```
5. From now on, simply **Draft a new release** on GitHub to automatically deploy your latest code!

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

## Onboarding a New Game

Adding a new game to the bot is entirely configuration-driven. Follow these precise steps:

**1. Upload the Reward to Cloudflare R2**
Upload your game download file (e.g., `Spiderman-ZIP.zip`) to your Cloudflare R2 bucket. Save the exact filename, as this will be your `reward` key.

**2. Publish your YouTube Video**
Upload the respective YouTube video outlining how to get the game, and grab the 11-character YouTube `videoId` from the URL.

**3. Update `config/constants.js`**
Open `config/constants.js` and add a new block to the `GAME_CONFIG` dictionary. 
Use a short, uppercase key (e.g., `SPIDERMAN`) representing your game.
```javascript
const GAME_CONFIG = {
  "GTA-VC": { ... },
  "SPIDERMAN": { 
    fullName: "Spider-Man Remastered",
    videoName: "Spider-Man Unlock Guide",
    videoId: "YOUR_11_CHAR_YOUTUBE_ID",
    reward: "Spiderman-ZIP.zip", 
    allowedChannelIds: ["123456789012345678"], // Specific text channels allowed for this game
    gameImage: "https://your-image-host.com/spiderman.jpg" // Optional thumbnail for DM
  }
};
```

**4. Deploy and Restart**
Commit your changes, push to GitHub, and let the CD pipeline restart the bot. (Because the `/claim` command asks for a generic text string, you **do not** need to re-run `deploy-commands.js`). 

Users can immediately start using `/generate game:SPIDERMAN`!

## Command Usage

### User Commands

#### `/generate game:<GAME_CODE>`
- Generates or returns an active claim code for that game.
- Sends the code via DM.
- If code is already used, user gets an error.

#### `/claim game:<GAME_CODE>`
- Verifies user comment from the mapped YouTube video.
- Valid comment format: `username:CODE` (example: `Jai:ABC123`).
- If valid and unconsumed, reward download link is sent by DM.

### Admin Commands
*(Restricted to `ADMIN_USER_ID` configured in `.env`)*

#### `/admin-overwrite user_id:<ID> game:<GAME_CODE>`
- Native override to forcibly generate an active claim code for a specific user.
- Automatically invalidates any previous unconsumed codes for that game.
- Delivers the new code via DM.

#### `/admin-reward user-id:<ID> game:<GAME_CODE>`
- Secure override to instantly deliver a final game download link.
- Automatically generates and instantly consumes a fresh code, entirely bypassing YouTube verification.
- Delivers the download link via DM.

#### `/admin-get-codes [game:<GAME_CODE>]`
- Pulls a categorized, tabular report of all active and historical claim codes.
- Sorts newest first and displays exact usage payload.
- Automatically paginates to a text file attachment if the table exceeds Discord's chat limits.

#### `/admin-get-games [game:<GAME_CODE>]`
- Fetches the live runtime configuration dictionary for your games.
- Displays dynamic metadata like active YouTube IDs, Cloudflare reward keys, enable statuses, and text channel restrictions.

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
- If command names/options were changed in config, redeploy commands and restart the bot:
  - `node deploy-commands.js`
  - `npm start`

### `/claim` or `/yt` says channel not allowed

- Check `GLOBAL_ALLOWED_CHANNELS` in `.env` or default in `config/constants.js`.
- Check per-game `allowedChannelIds` in `GAME_CONFIG`.
- Ensure game channels are a subset of global allowed channels.

### `/yt` says comment not found or failed validation

- Ensure comment format is exactly `username:CODE`.
- Ensure the code belongs to the same game/video.
- Ensure code has not expired and is not already used.
- Retry `/claim` after the comment is visible publicly on YouTube.

### JSON storage issues

- Confirm `data/codes.json` and `data/youtube/` are writable.
- If a store file becomes malformed, back it up and reinitialize.

## Infrastructure Costs (Cloudflare R2)

R2 has a permanent free tier. The only real cost is storage beyond 10 GB.

| Component | Free Tier | Overage |
|---|---|---|
| Storage | 10 GB / month | $0.015 / GB / month |
| Downloads (Class B ops) | 10M / month | $0.36 / million |
| Uploads (Class A ops) | 1M / month | $4.50 / million |
| Egress (bandwidth) | Unlimited | **$0.00** |
| Cloudflare Worker | 100K req / day | $5 / 10M requests |

**Storage cost by number of games (assuming ~10 GB per game):**

| Games | Total Storage | Monthly Cost |
|---|---|---|
| 1 | 10 GB | **$0.00** (free tier) |
| 2 | 20 GB | **$0.15** |
| 5 | 50 GB | **$0.60** |
| 10 | 100 GB | **$1.35** |
| 20 | 200 GB | **$2.85** |

Formula: `(games × 10 − 10) × $0.015 = $/month`

Downloads and Worker invocations are effectively free at any realistic Discord bot scale.

## Guarantees and Constraints

### Guarantees

- No duplicate code consumption (single-use enforcement).
- No reprocessing of already-seen comments (commentId dedupe).
- Game-specific verification path using `GAME_CONFIG`.

### Constraints

- JSON file storage (no database).
- Synchronous fs operations (adequate for low/moderate load).
- YouTube processing is currently on-demand (`/claim`) rather than scheduled.

## Security Notes

- Never commit real credentials or API keys.
- Rotate secrets immediately if exposed.
- `WORKER_SECRET` is the shared key between the bot and the Cloudflare Worker — rotate it via `npx wrangler secret put WORKER_SECRET` and update `.env` simultaneously.
- Restrict command channels using `GLOBAL_ALLOWED_CHANNELS` and per-game `allowedChannelIds`.

## Known Limitations

### Storage

- Storage is file-based JSON, not a database. Not suitable for high write concurrency or large datasets.
- File I/O operations are synchronous. Adequate for low/moderate load; becomes a bottleneck at scale.
- **TODO:** Migrate to a proper database (e.g. SQLite, PostgreSQL) when user volume grows significantly.

### YouTube API

- **Single-page fetch only (50 comments max per call).** The API is paginated but only page 1 is fetched. If more than 50 comments arrive between scheduler runs, older comments in that batch will not be processed until the next cycle.
  - **Future improvement:** Implement paginated fetching with a configurable `MAX_PAGES` cap and early exit when an entire page is already processed (all comments in it are in the comment store).

- **`order: time` assumption.** Comments are fetched newest-first. This is optimal for the reward flow but means older comments (e.g. from users who commented days ago but never ran `/claim`) will be pushed off page 1 over time.

- **No retry on transient failures.** A network error or YouTube 5xx during `fetchComments` causes the entire `/claim` to fail for that user. They must retry manually.
  - **Future improvement:** Add exponential backoff retry (e.g. `axios-retry`) for transient errors.

- **Deleted or spam-held comments are invisible.** If YouTube's spam filter holds a user's comment for review, the bot cannot see it. No mitigation is possible on the bot side.

- **YouTube API quota (free tier: 10,000 units/day).** Each `commentThreads.list` call costs 1 unit. At current traffic levels this is not a concern. Monitor via GCP Console if volume grows.

### Concurrency

- **Cold-store concurrent `/claim` calls fire redundant YouTube API requests.** If 10 users hit `/claim` simultaneously and none of their comments are in the store yet, all 10 trigger independent `processComments` calls — 10 API requests for the same video instead of 1. Correctness is preserved (locks prevent duplicate writes) but quota and CPU are wasted.
  - **Future improvement:** Add an in-flight deduplication guard in `processYouTubeRewardCommand` — if `processComments` is already running for a game, queue subsequent calls to await the same result.

- **`isProcessed` acquires a file lock per comment in the processing loop.** For 50 comments that is 50 sequential lock/read/release cycles on the same file within one `processComments` call.
  - **Future improvement:** Read the comment store once at the start of `processComments`, build a `Set` of already-processed comment IDs, and check membership in-memory. Only `saveComment` needs the lock.

### Operations

- **YouTube processing is on-demand (`/claim`), not scheduler-driven.** A scheduled background job would keep the comment store warm, reducing API calls and improving `/claim` response time.
  - **TODO:** Implement a scheduler (e.g. using `node-cron`) that calls `processComments` for each enabled game at a configurable interval (e.g. every 2 hours).

- **Test suite is script-based.** No automated CI test harness exists. Validation is manual via `scripts/` and `test-*.js` files.
  - **TODO:** Add a proper test framework (e.g. Jest) with unit tests for `codeService`, `claimRewardService`, and `youtubeClaimProcessor`.

### Security

- `/admin-overwrite` is registered as a public slash command (visible to all users in the server). Authorization is enforced at runtime via `ADMIN_USER_ID`, but the command is still discoverable.
  - **Note:** Discord does not currently support server-side command permission scoping for user IDs out of the box without using guild-level permission overrides.
