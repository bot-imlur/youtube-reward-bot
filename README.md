# YouTube Comment Reward Bot (Full Documentation)

## Overview

A Discord-integrated system designed to: - Generate unique claim codes -
Drive engagement on YouTube videos - Validate user comments - Securely
distribute rewards

------------------------------------------------------------------------

## End-to-End Flow

/claim (Discord) → Generate code → User comments on YouTube:
username:CODE → System fetches comments → Parse → Validate → Consume →
Reward

------------------------------------------------------------------------

## Core Architecture Principles

### 1. One Game = One Video

Each game is mapped to exactly one YouTube video.

### 2. Validation-Driven System

No redundant action field. Everything is driven by: -
validation.success - validation.reason

### 3. No Premature State Mutation

Codes are consumed only after: - format valid - code valid - game match

### 4. Config-Driven

All constants live in config files: - CODE_LENGTH - GAME_CONFIG -
CLAIM_RESULT

------------------------------------------------------------------------

## Project Structure

config/ constants.js claimResult.js

services/ codeService.js claimRewardService.js youtubeCommentService.js
youtubeClaimProcessor.js discordService.js

utils/ fileUtils.js commentParser.js commentStore.js expiryUtils.js
validationUtils.js

data/ codes.json youtube/`<videoId>`{=html}.json

scripts/ readCodes.js

index.js

------------------------------------------------------------------------

## Claim Code Lifecycle

### Code Generation

Stored in codes.json

{ "ABC123": { "userId": "...", "username": "...", "game": "GTA-VC",
"used": false, "createdAt": 123456789 } }

------------------------------------------------------------------------

## Comment Format

username:CODE

Example: Jai:ABC123

------------------------------------------------------------------------

## Parser Rules

-   Split using first colon
-   Trim spaces
-   Normalize code to uppercase
-   Validate using CODE_LENGTH

------------------------------------------------------------------------

## Validation System

Defined in config/claimResult.js:

PARSE_FAILED INVALID_CODE ALREADY_USED EXPIRED GAME_MISMATCH

------------------------------------------------------------------------

## Processing Flow

1.  Fetch comments
2.  Skip duplicates
3.  Parse
4.  Validate + consume
5.  Store result
6.  Send reward

------------------------------------------------------------------------

## Comment Storage

data/youtube/`<videoId>`{=html}.json

{ "videoId": "...", "game": "...", "meta": {}, "comments": {
"commentId": { "raw": "...", "parsed": {}, "validation": {}, "meta": {}
} } }

------------------------------------------------------------------------

## Deduplication

-   Based on commentId
-   Prevents reprocessing

------------------------------------------------------------------------

## Store Behavior

-   Auto-create file
-   Reinitialize if corrupted
-   Maintain metadata

------------------------------------------------------------------------

## Reward Logic

Handled in claimRewardService:

-   Check existence
-   Check used
-   Check expiry
-   Check game match
-   Then consume

------------------------------------------------------------------------

## Logging

Logs include: - Invalid comment format - Missing comment ID - Invalid
codes - Processing summary

------------------------------------------------------------------------

## Running the App

node index.js

------------------------------------------------------------------------

## Key Guarantees

-   No reward leakage
-   No duplicate processing
-   No accidental code consumption
-   Fully traceable system

------------------------------------------------------------------------

## Future Enhancements

-   Scheduler
-   Retry logic
-   Analytics
-   Admin dashboard

------------------------------------------------------------------------

## System Status

Stable and production-ready.
