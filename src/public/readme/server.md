# Page Debug Server

Express server providing HTTP APIs to control web pages programmatically for debugging and testing.

## Quick Start

```bash
# Start server (opens in new terminal window by default)
dev-playkit --urls='["https://example.com"]' --port=3000

# Test - take screenshot
curl "http://localhost:3000/screenshot"
```

## Configuration

### Command Line Options

- `--urls` - URLs to open on startup (default: `[]`)
- `--port` - Server port (default: `3000`)
- `--newWindow` - Open in new terminal window (default: `true`)
- `--debug` - Monitor debug mode (default: `true`)
- All monitor options from monitor.md also apply

### Default Behavior

- Opens in new terminal window (disable with `--newWindow=false`)
- Monitor runs in debug mode (infinite timeout, no auto-close)
- Starts with empty URLs array
- Auto-increments port if already in use
- Auto-cleanup old screenshots on startup
- Auto-exits when all browser pages closed

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/screenshot` | Take screenshots |
| `POST` | `/request/mock` | Mock API responses |
| `POST` | `/request/mock/cancel` | Cancel API mocking |
| `POST` | `/request/capture` | Capture API requests |
| `POST` | `/request/capture/cancel` | Cancel request capture |
| `GET` | `/screenshots/:filename` | View saved screenshots |

## Screenshots

Take screenshots via `GET /screenshot`

### Parameters

- `selector` - Element selector (optional)
- `clip` - Crop area: `{"x":0,"y":0,"width":100,"height":100}` (optional)

### Screenshot Examples

```bash
# Full page
curl "http://localhost:3000/screenshot"

# Element by text
curl "http://localhost:3000/screenshot?selector=Submit"

# Element by CSS
curl "http://localhost:3000/screenshot?selector=%23submit-button"

# Clipped area
curl "http://localhost:3000/screenshot?clip=%7B%22x%22:100,%22y%22:100,%22width%22:500,%22height%22:300%7D"
```

Response includes `screenshot` URL and `elementInfo` with position/size metadata for element screenshots.

## Request Mocking

Mock API responses via `POST /request/mock`

### Mock Request Body

```json
{
  "url": "/api/users",
  "response": {"status": "success", "data": [{"id": 1, "name": "John"}]},
  "status": 200
}
```

- `url` (required) - URL pattern (string)
- `response` (required) - JSON to return
- `status` (optional) - HTTP status (default: 200)

### Cancelling Mocks

```bash
curl -X POST http://localhost:3000/request/mock/cancel \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'
```

**Note:** URL pattern must exactly match the one used in setup.

### Mock Examples

```bash
# Mock endpoint
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users", "response": {"data": [{"id": 1, "name": "John"}]}}'

# Mock with regex
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/^\\/api\\/.*$/", "response": {"message": "Mocked"}}'
```

## Request Capture

Capture and log API requests via `POST /request/capture`

### Capture Request Body

```json
{
  "url": "/api/users"
}
```

Captured requests are logged to terminal with full response JSON.

### Cancelling Captures

```bash
curl -X POST http://localhost:3000/request/capture/cancel \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'
```

**Note:** URL pattern must exactly match the one used in setup.

### Capture Examples

```bash
# Capture endpoint
curl -X POST http://localhost:3000/request/capture \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'

# Capture with regex
curl -X POST http://localhost:3000/request/capture \
  -H "Content-Type: application/json" \
  -d '{"url": "/^\\/api\\/.*$/"}'
```

## Element Finding

Multiple strategies (in order):

1. **Text matching** - Exact text content
2. **CSS selectors** - `#id`, `.class`, `[attribute="value"]`
3. **Attributes** - `placeholder`, `aria-label`, `title`, `alt`

Priority: Form elements > Links > Containers > Images > Labels > ARIA roles

## Common Workflows

### API Testing

```bash
# Mock API
curl -X POST http://localhost:3000/request/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/data", "response": {"items": [1,2,3]}}'

# Cancel mock
curl -X POST http://localhost:3000/request/mock/cancel \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/data"}'
```

### API Debugging

```bash
# Capture requests
curl -X POST http://localhost:3000/request/capture \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'

# Check terminal for captured logs when requests are made

# Cancel capture
curl -X POST http://localhost:3000/request/capture/cancel \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users"}'
```

## Troubleshooting

### Common Issues

**"Page not initialized"**

- Server starts with empty URLs by default
- Pass `--urls='["https://example.com"]'` on startup
- Or open pages manually in the browser

**Element not found**

- Check terminal output for selector attempts
- Test selectors in DevTools first
- Iframes not currently supported

**Mock/Capture not working**

- URL pattern must match exactly
- Set up mock before request is made
- Check terminal logs (blue = mock/capture, green = setup, yellow = cancelled)
- Use regex for flexible matching: `"/^\\/api\\/.*$/"`

**Cannot cancel mock/capture**

- URL must exactly match setup pattern
- Restart server to clear all

**Port in use**

```bash
lsof -i :3000 && kill -9 <PID>
# Or auto-increment: server detects and uses next available port
```

### Terminal Output

Monitor terminal for:

- ✅ `Executed JavaScript code: ...`
- ❌ `Element with "selector" not found`
- 🔵 `Request mock/capture: https://...`
- 🟢 `Request mock set up for URL pattern: ...`
- 🟡 `Request mock cancelled for URL pattern: ...`
- 🔴 Errors with stack traces

## Best Practices

- Use specific selectors: `"data-id=submit"` > `.button`
- Set adequate intervals: 500-1000ms for fills, 1000-2000ms for navigation
- Test selectors in DevTools first
- Take screenshots between critical steps
- Set up mocks before triggering requests
- Match URL patterns exactly when cancelling
- Use regex patterns for flexible matching

## Server Lifecycle

### Startup Sequence

1. Parse CLI arguments (merge with defaults)
2. Check `newWindow` flag - if true, spawn new terminal and exit
3. Create Express app
4. Create Monitor instance (`debug: true`, `urls: []`)
5. Setup middleware (JSON parser, static file server)
6. Register routes (7 endpoints)
7. **Start server loop:**
   - Check port availability
   - If taken, increment port and retry
   - Listen on available port
   - Clean up old screenshots
   - Log available endpoints
   - Initialize browser with Playwright
   - Register `onAllPagesClosed` callback

### During Operation

- Monitor tracks page events, console logs, network requests
- Screenshots saved to `{{cachePath}}/screenshot_*.png`
- Static files served at `/screenshots`
- All endpoints access `monitor.currentPage`
- Errors logged to console and `errors.log`

### Shutdown

- Auto-exits when all browser pages closed
- Saves cookies before exit
- Keep at least one page open to prevent exit

### Output Files

Directory: `{{cachePath}}`

- `screenshot_*.png` - Timestamped screenshots
- `errors.log` - Error logs
- `cookies.json` - Persisted cookies
- `settings.json` - Monitor settings
- `auth.json` - Authentication credentials

## Implementation Details

### Architecture

- **Express** - HTTP server
- **Monitor** - Browser lifecycle management (always in debug mode)
- **Playwright** - Browser automation
- **requestHandler** - Unified handler for mock/capture operations

### Request Interception

All mock/capture operations use a single `requestHandler`:

- URL patterns normalized: `**/*<url>*` glob format
- Mocks use `page.route()` + `route.fulfill()`
- Captures use `page.route()` + `route.fetch()` + console logging
- Cancellation uses `page.unroute()` with exact pattern match

### Configuration Priority

1. Command line arguments (highest)
2. Default values: `{port: 3000, newWindow: true}`
3. Monitor's `settings.json` (for Monitor-specific options)

## Related Files

- `server.ts` - Main Express server
- `endpoints/screenshot.ts` - Screenshot handler
- `endpoints/requestHandler.ts` - Mock/capture handler
- `monitor.ts` - Browser management
- `helpers/utils.ts` - Utilities (parseArgs, cleanupScreenshots, isPortAvailable, openInNewWindow)

See `monitor.md` for Monitor class documentation.
