# User Action Recorder

Record user interactions on web pages and replay them as automated tests. All recordings are saved as JSON files with coordinates and timing information.

## Features

- ✅ **Coordinate-based recording** - Records mouse clicks, movements, keyboard input using x,y positions
- ✅ **Duration tracking** - Captures timing between actions to handle side effects (network requests, animations)
- ✅ **JSON storage** - Saves recordings as JSON files in `cacheDir/recordings/`
- ✅ **Direct replay** - Executes tests directly from JSON without generating code
- ✅ **Speed control** - Replay at different speeds (0.5x, 1x, 2x, etc.)
- ✅ **AI-friendly API** - Simple REST endpoints designed for AI agents

## API Endpoints

### Start Recording
```bash
POST /recorder/start
Content-Type: application/json

{
  "name": "Optional test name"  # Optional
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "rec_1699876543210_abc123",
  "startTime": 1699876543210,
  "message": "Recording started. Interact with the page normally."
}
```

### Stop Recording
```bash
POST /recorder/stop
```

**Response:**
```json
{
  "success": true,
  "sessionId": "rec_1699876543210_abc123",
  "duration": 5000,
  "eventCount": 8,
  "filepath": "/path/to/cacheDir/recordings/rec_1699876543210_abc123.json",
  "message": "Recording saved. Use POST /recorder/replay/:id to run this test."
}
```

### Get Status
```bash
GET /recorder/status
```

**Response (while recording):**
```json
{
  "isRecording": true,
  "sessionId": "rec_1699876543210_abc123",
  "startTime": 1699876543210,
  "eventCount": 5,
  "elapsedTime": 2500
}
```

**Response (not recording):**
```json
{
  "isRecording": false
}
```

### List All Recordings
```bash
GET /recorder/sessions
```

**Response:**
```json
{
  "success": true,
  "recordings": [
    {
      "id": "rec_1699876543210_abc123",
      "name": "Login flow test",
      "startUrl": "http://localhost:3000/login",
      "startTime": 1699876543210,
      "duration": 5000,
      "eventCount": 8
    }
  ],
  "count": 1
}
```

### Get Recording Details
```bash
GET /recorder/session/:id
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "rec_1699876543210_abc123",
    "name": "Login flow test",
    "startUrl": "http://localhost:3000/login",
    "totalDuration": 5000,
    "eventCount": 8,
    "viewport": { "width": 1920, "height": 1080 },
    "events": [
      {
        "type": "click",
        "timestamp": 0,
        "duration": 0,
        "x": 100,
        "y": 200,
        "url": "http://localhost:3000/login",
        "viewport": { "width": 1920, "height": 1080 }
      },
      {
        "type": "input",
        "timestamp": 500,
        "duration": 500,
        "value": "username",
        "url": "http://localhost:3000/login",
        "viewport": { "width": 1920, "height": 1080 }
      }
    ]
  }
}
```

### Replay Recording
```bash
POST /recorder/replay/:id?speed=1.0&skipMouseMoves=false&screenshot=false
```

**Query Parameters:**
- `speed` (default: 1.0) - Speed multiplier (2.0 = 2x faster, 0.5 = half speed)
- `minDuration` (optional) - Minimum wait time between actions (ms)
- `maxDuration` (optional) - Maximum wait time between actions (ms)
- `skipMouseMoves` (default: false) - Skip mouse movement events
- `screenshot` (default: false) - Take screenshot after each action

**Response (success):**
```json
{
  "success": true,
  "sessionId": "rec_1699876543210_abc123",
  "eventsExecuted": 8,
  "eventsFailed": 0,
  "totalDuration": 5000,
  "actualDuration": 2500,
  "screenshots": [
    "http://localhost:3000/screenshots/screenshot_1699876543210.png"
  ],
  "message": "Replay completed successfully"
}
```

**Response (with errors):**
```json
{
  "success": false,
  "sessionId": "rec_1699876543210_abc123",
  "eventsExecuted": 5,
  "eventsFailed": 1,
  "errors": [
    {
      "eventIndex": 5,
      "event": { "type": "click", "x": 100, "y": 200 },
      "error": "Navigation timeout exceeded"
    }
  ],
  "message": "Replay completed with 1 error(s)"
}
```

### Delete Recording
```bash
DELETE /recorder/session/:id
```

**Response:**
```json
{
  "success": true,
  "sessionId": "rec_1699876543210_abc123",
  "message": "Recording deleted successfully"
}
```

### Update Recording Name
```bash
PUT /recorder/session/:id/name
Content-Type: application/json

{
  "name": "Updated test name"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "rec_1699876543210_abc123",
  "name": "Updated test name"
}
```

## Usage Examples

### Example 1: Record and Replay
```bash
# 1. Start recording
curl -X POST http://localhost:3000/recorder/start \
  -H "Content-Type: application/json" \
  -d '{"name": "User login flow"}'

# Response: {"sessionId": "rec_123", ...}

# 2. Interact with the page in the browser
#    - Click login button
#    - Type username
#    - Type password
#    - Click submit

# 3. Stop recording
curl -X POST http://localhost:3000/recorder/stop

# Response: {"sessionId": "rec_123", "eventCount": 10, ...}

# 4. Replay the test
curl -X POST http://localhost:3000/recorder/replay/rec_123

# Response: {"success": true, "eventsExecuted": 10}
```

### Example 2: Replay with Speed Control
```bash
# Replay at 2x speed (all waits are halved)
curl -X POST 'http://localhost:3000/recorder/replay/rec_123?speed=2.0'

# Replay at half speed (all waits are doubled)
curl -X POST 'http://localhost:3000/recorder/replay/rec_123?speed=0.5'

# Replay with screenshots for debugging
curl -X POST 'http://localhost:3000/recorder/replay/rec_123?screenshot=true'
```

### Example 3: Manage Recordings
```bash
# List all recordings
curl http://localhost:3000/recorder/sessions

# Get specific recording details
curl http://localhost:3000/recorder/session/rec_123

# Update recording name
curl -X PUT http://localhost:3000/recorder/session/rec_123/name \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated login test"}'

# Delete old recording
curl -X DELETE http://localhost:3000/recorder/session/rec_old_456
```

### Example 4: Regression Testing
```bash
# AI workflow: Run all recorded tests after code changes

# 1. Get all recordings
curl http://localhost:3000/recorder/sessions

# 2. Replay each recording at 2x speed
for id in $(curl -s http://localhost:3000/recorder/sessions | jq -r '.recordings[].id'); do
  echo "Running test: $id"
  curl -X POST "http://localhost:3000/recorder/replay/$id?speed=2.0"
done
```

## Configuration

The recorder is **always enabled** with sensible defaults:

```typescript
const monitor = new Monitor({
  debug: true,
  urls: ['http://localhost:3000']
});

// Recorder is automatically initialized with these defaults:
// - recordMouseMoves: false (mouse movements are skipped)
// - mouseMoveThrottle: 100ms
// - minActionDuration: 0ms
// - maxActionDuration: 10000ms
// - storageDir: cacheDir/recordings
```

No additional configuration needed!

## Recording Format

Recordings are saved as JSON files in `cacheDir/recordings/` with the following structure:

```json
{
  "id": "rec_1699876543210_abc123",
  "name": "Login flow test",
  "startUrl": "http://localhost:3000/login",
  "startTime": 1699876543210,
  "endTime": 1699876548210,
  "totalDuration": 5000,
  "viewport": { "width": 1920, "height": 1080 },
  "events": [
    {
      "type": "click",
      "timestamp": 0,
      "duration": 0,
      "x": 450,
      "y": 320,
      "url": "http://localhost:3000/login",
      "viewport": { "width": 1920, "height": 1080 }
    },
    {
      "type": "input",
      "timestamp": 500,
      "duration": 500,
      "value": "username",
      "url": "http://localhost:3000/login",
      "viewport": { "width": 1920, "height": 1080 }
    },
    {
      "type": "keypress",
      "timestamp": 1000,
      "duration": 500,
      "key": "Tab",
      "url": "http://localhost:3000/login",
      "viewport": { "width": 1920, "height": 1080 }
    },
    {
      "type": "scroll",
      "timestamp": 1500,
      "duration": 500,
      "scrollX": 0,
      "scrollY": 200,
      "url": "http://localhost:3000/login",
      "viewport": { "width": 1920, "height": 1080 }
    }
  ],
  "metadata": {
    "eventCount": 4,
    "urlChanges": 0,
    "averageActionDuration": 375
  }
}
```

## Event Types

- **click** - Mouse click with x, y coordinates
- **mousemove** - Mouse movement with x, y coordinates (optional, can be disabled)
- **input** - Keyboard text input with value
- **keypress** - Single key press with key name
- **scroll** - Scroll event with scrollX, scrollY positions

## Duration Field

The `duration` field represents the wait time **before** executing this action:
- First action: `duration: 0` (execute immediately)
- Subsequent actions: `duration: <ms since last action>`

This captures the natural timing of user interactions and side effects like:
- Network requests
- Animations
- Page transitions
- Loading states

## Notes

- Recordings are viewport-specific - replay requires similar viewport size for accurate positioning
- Coordinate-based approach is simpler but sensitive to layout changes
- Use speed multiplier to speed up tests without losing timing relationships
- Screenshots during replay help debug failed tests
- All recordings stored in `cacheDir/recordings/` directory

