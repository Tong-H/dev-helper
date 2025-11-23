# 🔍 Monitor Tool

Playwright-based automated web page testing with error detection, authentication handling, and visual verification.

## 🚀 Quick Start

```bash
# Run verification
dev-playkit --urls='["https://example.com"]'
```

## ⚙️ Configuration

### Required Options
- `urls` - JSON array of URLs to test

### Browser Options
- `headless` (default: `false`) - whether use headless mode to run browser
- `viewport` (default: `null`) - Browser size (e.g., "1920x1080", or `null` for resizable window)
- `openDevtools` (default: `false`) - Open browser DevTools on start
- `timeout` (default: `5000ms`) - Page loading timeout before screenshot and close; set to `undefined` in debug mode
- `debug` (default: `false`) - Debug mode: infinite timeout, only monitors first URL, no auto-close, clears error log on page load

### Storage
- All files (screenshots, logs, cookies, settings) are stored in: {{cachePath}}

### Network Monitoring Options
- `networkFilterPatterns` (default: `[]`) - Array of regex patterns to filter and display specific network requests/responses in console

### Authentication Options
- `authWithoutHost` - Single auth account to apply to all auth sites (fallback when hostname-specific auth not found)
- `cookie` - Array of cookie objects or key-value pairs to apply to the first URL
- `authFilePath` - Path to JSON file containing auth data (auto-generated on first run)
- `authSites` - Array of hostnames recognized as authentication pages (loaded from `settings.json`)
- `cookiesShouldBeSaved` - Array of domains whose cookies should be persisted to cache (loaded from `settings.json`)

### Auth File Format (`auth.json`)

**Method 1: Hostname-specific credentials**
```json
{
  "sso.com": {
    "user": "username",
    "pwd": "password"
  },
  "example.com": {
    "user": "username",
    "pwd": "password"
  }
}
```

**Method 2: Universal credentials (using CLI)**
```bash
# Use same credentials for all auth sites
dev-playkit --urls='["https://example.com"]' \
  --authWithoutHost='{"user":"myusername","pwd":"mypassword"}'
```

**Priority:** If both hostname-specific and `authWithoutHost` credentials exist, hostname-specific takes precedence.

### Settings File Format (`settings.json`)
Automatically generated on first run. Edit to customize default behavior:

```json
{
  "networkFilterPatterns": {
    "description": "Array of regex patterns to filter network logs",
    "value": ["/^\/api\/.*$/"]
  },
  "cookiesShouldBeSaved": {
    "description": "Domains to persist cookies for",
    "value": ["example.com", ".example.com"]
  },
  "authSites": {
    "description": "Hostnames recognized as auth pages",
    "value": ["sso.com", "example.com"]
  },
  "authFilePath": {
    "description": "Path to auth credentials file",
    "value": "auth.json"
  }
}
```

## 📊 Output

### Console Logs
- **Green**: Info messages (page loaded, cookies applied, login success, screenshots saved)
- **Yellow**: Warnings (auth redirects, manual login required)
- **Red**: Errors (network failures, console errors, uncaught exceptions)
- Real-time network request/response monitoring (when `networkFilterPatterns` is set)
- Authentication flow progress tracking

### Generated Files in `cache dir`
On first run, the following files are automatically created:
- `settings.json` - Configurable defaults (authSites, cookiesShouldBeSaved, etc.)
- `auth.json` - Template for authentication credentials
- `customLoginAdaptors.js` - Template for custom authentication adaptors (users can add their own login logic here)
- `errors.log` - Timestamped errors with full stack traces (cleared on each run in debug mode)

During execution:
- `{url-encoded}.png` - Full-page screenshots (taken after timeout expires)
- `cookies.json` - Persisted authentication cookies (filtered by `cookiesShouldBeSaved`)

## 💡 Usage Examples

```bash
# Basic test (first run creates settings.json, auth.json, and customLoginAdaptors.js in cache directory)
dev-playkit --urls='["https://example.com"]'

# Multiple pages (opens in sequence, not parallel)
dev-playkit --urls='["https://site1.com","https://site2.com"]'

# Debug mode - interactive testing
# - Only monitors the first URL
# - No timeout (browser stays open indefinitely)
# - No auto-close or auto-screenshot
# - Clears error log on each page load
# - Other URLs still open but without monitoring
dev-playkit --urls='["https://example.com"]' --debug=true --openDevtools=true

# Headless with custom timeout
dev-playkit --urls='["https://example.com"]' --headless=true --timeout=10000

# Monitor specific API calls
dev-playkit --urls='["https://example.com"]' --networkFilterPatterns='["/api/user","/api/data"]'

# Custom viewport size
dev-playkit --urls='["https://example.com"]' --viewport="1920x1080"

# With universal auth (applies to all auth sites)
dev-playkit --urls='["https://example.com"]' --authWithoutHost='{"user":"admin","pwd":"pass"}'
```

## 🔍 How It Works

### Initialization
1. **Configuration**: Merges CLI args with `settings.json` from cache directory
2. **First Run Setup**: If no settings exist, creates `settings.json`, `auth.json`, and `customLoginAdaptors.js` templates
3. **Browser Launch**: Starts Chromium with remote debugging on port 9222
4. **Context Setup**: Applies stored cookies and creates browser context with custom viewport

### Normal Mode Workflow
1. **Sequential Page Opening**: Opens URLs one by one in sequence (not parallel)
2. **Monitoring Setup**: Attaches event listeners for console, network, errors, and dialogs
3. **Page Loading**: Navigates to URL and waits for dom content loaded
4. **Timeout Handler**: After configured timeout, takes full-page screenshot
5. **Auto-Close**: Closes page and proceeds to next URL
6. **Cookie Persistence**: When all pages close, saves cookies to cache

### Debug Mode (`--debug=true`)
1. **First URL Only**: Only the first URL gets full monitoring with event listeners
2. **No Timeout**: Browser stays open indefinitely (timeout is `undefined`)
3. **No Auto-Actions**: No automatic screenshot or page close
4. **Log Clearing**: Clears `errors.log` on each page load for fresh debugging
5. **Other URLs**: Remaining URLs open without monitoring (for reference)
6. **Manual Control**: Developer manually inspects, screenshots, and closes browser

### Authentication Flow
1. **Detection**: Monitors for redirects to hostnames in `authSites` array
2. **Redirect Handling**: 
   - Detects 301/302/303/307/308 redirects via response headers
   - Detects console errors with auth URLs
   - Triggers `jumpOut()` to pause normal monitoring
3. **Credential Resolution**: Searches for credentials in the following order:
   - Hostname-specific credentials from `auth` or `auth.json` (highest priority)
   - `authWithoutHost` credentials (fallback for all auth sites)
   - If neither found, prompts for manual login
4. **Auto-Login**: If credentials are found, uses matching login adaptor for the auth site
   - **Custom Adaptors**: First checks `customLoginAdaptors.js` in cache directory (users can define their own login logic here)
5. **Manual Login**: If no credentials or unsupported site, waits for user to login manually
6. **Re-entry**: After successful login (detected when leaving auth hostname):
   - Saves cookies to cache
   - Applies cookies to target URL's domain
   - Re-opens all URLs with same hostname to use new authentication

**Note:** `authWithoutHost` is particularly useful when you have one set of universal credentials that work across multiple authentication providers.

### Custom Login Adaptors

Users can create their own login adaptors by editing `customLoginAdaptors.js` in the cache directory. This file is automatically created on first run with an example template.

**Adaptor Structure:**
```javascript
module.exports = [{
  pattern: /example\.com/,  // RegExp to match auth site hostname
  adaptor: async (account) => {
    // Custom login logic here
    // account contains: { user, pwd, phone }
    const inputting = (dom, text) => {
      if (!dom || !text) return;
      const simulateKeyEvent = (type, key) =>
        dom.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
      
      for (const char of text) {
        simulateKeyEvent('keydown', char);
        simulateKeyEvent('keypress', char);
        dom.value += char;
        dom.dispatchEvent(new Event('input', { bubbles: true }));
        dom.dispatchEvent(new Event('change', { bubbles: true }));
        simulateKeyEvent('keyup', char);
      }
    }
    
    inputting(document.querySelector('#username'), account.user);
    inputting(document.querySelector('#password'), account.pwd);
    document.querySelector('#login-button')?.click();
    return "success";  // Return value logged to console
  }
}];
```

**Key Points:**
- The adaptor function runs in browser context (has access to `document`, `window`, etc.)
- Custom adaptors are checked first, before built-in adaptors
- Multiple adaptors can be defined in the array
- The `pattern` field matches against the auth site's hostname
- Return value is logged to console for debugging

### Cookie Management
- **Loading**: Loads cookies from `cookies.json` and applies to first URL's hostname
- **Filtering**: Only saves cookies for domains listed in `cookiesShouldBeSaved`
- **Persistence**: Saves filtered cookies when all pages close
- **Domain Mapping**: Maps saved cookies to target URL's domain on re-open

### Event Monitoring
- **Console**: Captures errors, warnings, and logs (skips debug level)
- **Network**: 
  - Monitors all requests/responses by default
  - Filters display using `networkFilterPatterns` regex
  - Captures failed requests (connection errors, not 4xx/5xx)
  - Logs non-200 status codes as errors
- **Page Events**: Uncaught exceptions, dialogs (auto-dismissed), worker creation
- **Error Logging**: Appends all errors to `errors.log` with timestamp and full context

## 🔧 Troubleshooting

### Installation Issues

**Playwright not found:**
```bash
yarn add -D playwright
npx playwright install chromium
```

**Missing dependencies on Linux:**
```bash
npx playwright install-deps chromium
```

### Authentication Issues

**Login not working:**
1. Check if auth site is in `authSites` array in `settings.json`
2. Verify credentials in `auth.json` are correct (or use `--authWithoutHost` as fallback)
3. Check credential priority: hostname-specific auth takes precedence over `authWithoutHost`
4. Check if login adaptor exists for your auth site:
   - Custom adaptors: Edit `customLoginAdaptors.js` in cache directory to add your own login logic
   - Built-in adaptors: Check `loginAdaptors.js` for pre-configured sites
   - Priority: Custom adaptors are checked first, then built-in adaptors
5. Use `--debug=true --openDevtools=true` to manually login and inspect

**Cookies not persisting:**
1. Add the domain to `cookiesShouldBeSaved` in `settings.json`
2. Ensure domain starts with `.` for subdomain matching (e.g., `.example.com`)
3. Check that `cookies.json` has write permissions

**Redirect loops:**
- Auth redirect detected but credentials missing - add credentials to `auth.json` or use `--authWithoutHost`
- Auth site not recognized - add hostname to `authSites` in `settings.json`

**Using authWithoutHost:**
- Simplifies setup when same credentials work across all auth providers
- Pass via CLI: `--authWithoutHost='{"user":"username","pwd":"password"}'`
- Example use case: Corporate SSO where one account accesses test/staging/prod environments
- Hostname-specific credentials in `auth.json` will override `authWithoutHost` for that host

### Performance Issues

**Pages loading slowly:**
- Increase timeout: `--timeout=15000`
- Check network connectivity

**Too many logs:**
- Set `networkFilterPatterns` to only show specific URLs

**Memory issues with many pages:**
- Run pages in batches instead of all at once
- Use `--headless=true` for lower memory usage

### Screenshot Issues

**Screenshot failures:**
- Ensure cache directory is writable
- Verify browser window is not minimized (in headed mode)
- Check disk space availability

**Screenshots saved in wrong location:**
- Screenshots are saved to: {{cachePath}}

### Debug Mode Tips

**Debug mode not working as expected:**
- Debug mode only monitors the **first URL** in the array
- Timeout is automatically set to `undefined` (infinite)
- Other URLs open without monitoring
- Error log clears on each page load in debug mode

**Need to debug second/third URL:**
- Reorder `urls` array to put target URL first
- Or run separate command with only that URL

### Network Monitoring

**Network logs not showing:**
- Set `networkFilterPatterns` with regex to match URLs you want to see
- Check if URLs are being filtered out by patterns

**Too much network noise:**
- Add regex patterns to `networkFilterPatterns` to only show relevant requests
- Example: `["/api/.*", "/graphql"]` shows only API and GraphQL calls

### Configuration Issues

**Settings not applying:**
- CLI arguments override `settings.json` values
- Check `settings.json` format (each property has `description` and `value`)
- Delete `settings.json` to regenerate defaults

**Auth file not found:**
- First run auto-creates `auth.json` in cache directory
- Override path with `--authFilePath="./custom-auth.json"`

## 🎯 Best Practices

### For CI/CD Integration
```bash
# Headless mode with error exit
dev-playkit \
  --urls='["https://app.example.com"]' \
  --headless=true \
  --timeout=10000 \
  --exitOnError=true
```

### For Development
```bash
# Debug mode with devtools
dev-playkit \
  --urls='["https://localhost:3000"]' \
  --debug=true \
  --openDevtools=true \
  --viewport=null
```

### For Production Monitoring
```bash
# Monitor multiple production pages
dev-playkit \
  --urls='["https://app.com/page1","https://app.com/page2"]' \
  --timeout=15000
```

### Configuration Management

**Recommended `settings.json` structure:**
```json
{
  "networkFilterPatterns": {
    "description": "Only log specific API endpoints",
    "value": ["/api/critical/.*", "/api/auth/.*"]
  },
  "cookiesShouldBeSaved": {
    "description": "Production domains for stable auth",
    "value": [".example.com", "app.example.com"]
  },
  "authSites": {
    "description": "Known SSO/auth providers",
    "value": ["sso.example.com", "auth.example.com"]
  }
}
```

**Security tips:**
- Keep `auth.json` out of version control (add to `.gitignore`)
- Use environment variables for sensitive credentials
- Regularly rotate saved cookies for production accounts
- Use separate auth files for different environments

**Authentication strategy:**
- Use `authWithoutHost` for universal credentials that work across all your auth providers
- Use hostname-specific credentials in `auth.json` when different sites need different accounts
- CLI `--authWithoutHost` is useful for one-off testing without modifying auth files
- Hostname-specific credentials always override `authWithoutHost` for that specific host

## 📝 Key Implementation Details

### Class Structure
- **Constructor**: Initializes config, creates cache directory, applies settings
- **initializeBrowser()**: Launches Chromium with context and auth setup
- **openPages()**: Sequential page opening loop
- **initializePage()**: Creates page, sets up monitoring, handles lifecycle
- **setupMonitoring()**: Attaches all event listeners (console, network, errors)
- **jumpOut()**: Handles auth redirect detection and flow interruption
- **loginAdaptor()**: Manages automatic login with credential mapping
- **afterLogin()**: Resumes monitoring and re-opens pages with new cookies

### Event Listener Management
- Listeners attached in `setupMonitoring()`
- Removed via `removeAllListeners()` during auth flow
- Close listener preserved to trigger cookie saving
- Page load listener re-attached during auth flow

### Error Handling
- All errors logged to `errors.log` with timestamp
- Console errors filtered to exclude network errors (handled separately)
- Network errors logged for non-200 responses and request failures
- Page errors logged for uncaught exceptions
- Error messages include full context (URL, type, stack trace)

## 🔗 Related Files
- `customLoginAdaptors.js` - Custom authentication adaptors (user-defined, in cache directory)
- `loginAdaptors.js` - Built-in authentication adaptors for different SSO providers
- `utils.js` - Helper functions (parseArgs, getCacheDirectory, loadJSONData)
- `defaultSettings.json` - Default settings template
- `authExample.json` - Auth file template
