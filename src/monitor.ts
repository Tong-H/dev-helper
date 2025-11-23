#!/usr/bin/env node
import { chromium, Browser, BrowserContext, Page, Cookie } from 'playwright';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { parseArgs, getCacheDirectory, loadJSONData, toolName, generateDefaultSettings } from './helpers/utils';
import {
	MonitorConfig,
	AuthAccount,
	Settings,
	TempState,
	InitializeBrowserOptions,
	LoginAdaptor
} from './types/monitor';
import RecorderManager from './recorder/RecorderManager';

const red = chalk.bold.red;
const yellow = chalk.yellow;
const green = chalk.green;



const cacheDir = getCacheDirectory();
const customLoginAdaptors: LoginAdaptor[] = (() => {
	try {
		return require(path.resolve(cacheDir, "customLoginAdaptors.js"))
	} catch (error) {
		return [];
	}
})()

class Monitor {
	authPages: Page[];
	auth: Record<string, AuthAccount> | null;
	browser: Browser | null;
	context: BrowserContext | null;
	currentPage: Page | null;
	config: MonitorConfig;
	timeout: NodeJS.Timeout[];
	temp: TempState | null;
	recorder: RecorderManager | null;

	constructor(
		config: Partial<MonitorConfig> = {},
	) {
		this.authPages = [];
		this.auth = null;
		this.browser = null;
		this.context = null;
		this.currentPage = null;
		this.config = {
			headless: false,
			timeout: 1000 * 5,
			cacheDir: getCacheDirectory(),
			debug: false, // set debug to true to open debug mode
			// set viewport to null can disable Playwright's default fixed viewport. the browser window will behave like a regular desktop Chrome window (keep resizable, responsive to the window size),
			openDevtools: undefined,
			viewport: null,
			...config
		};
		this.timeout = [];
		this.temp = null;

		// Initialize recorder
		this.recorder = new RecorderManager(this.config.cacheDir);
		fs.writeFileSync(path.resolve(this.config.cacheDir, "errors.log"), "");
		console.log(green(`INFO:\nconfig: ${JSON.stringify(this.config, null, 2)}`));
		console.log(`INFO: cache file located at: ${this.config.cacheDir}`);
		this.applySettings();
	}

	// apply predefined settings to the config
	applySettings(): void {
		const settings = loadJSONData(path.resolve(this.config.cacheDir, "settings.json"));
		if (settings) {
			this.config = {
				...Object.entries(settings).reduce((a, [key, value]: [string, any]) => ({ ...a, [key]: value.value }), {}),
				...this.config,
			};
		} else {
			const _defaultSettings = generateDefaultSettings(this.config.cacheDir);
			this.config = {
				..._defaultSettings,
				...this.config,
			};
		}
		if ('networkFilterPatterns' in this.config && Array.isArray(this.config.networkFilterPatterns)) {
			this.config.networkFilterPatterns = this.config.networkFilterPatterns.map((i: any) =>
				typeof i === 'string' ? new RegExp(i) : i
			);
		}
	}

	async applyAuthToContext(config: MonitorConfig): Promise<void> {
		// load auth from cache
		const authData = config.authFilePath ? loadJSONData(config.authFilePath) : undefined;
		this.auth = {
			...(authData || {}),
			...(config.authWithoutHost ? { "authWithoutHost": config.authWithoutHost } : {}),
		};

		if (this.auth && Object.keys(this.auth).length) {
			console.log(green(`INFO: the following auth sites are loaded from cache: \n${JSON.stringify(Object.keys(this.auth), null, 2)}`));
		}

		// load cookies from cache
		const cookieFromLastTime = loadJSONData(path.resolve(this.config.cacheDir, "cookies.json"))
		let cookies: Cookie[] = [
			...(cookieFromLastTime || []),
			...("cookie" in config && config.cookie ? config.cookie : []),
		];
		if (cookies.length && this.context) {
			try {
				const hostname = new URL(this.config.urls![0]).hostname;
				await this.context.addCookies(cookies.map((item) => ({
					...item,
					domain: hostname,
					path: '/',
				})));
				console.log(green(`\nINFO: Cookies applied ${cookies.length} authentication`));
			} catch (error) {
				console.error(red(`\nERROR: Error applying cookies: ${(error as Error).message}`));
			}
		}
	}

	async initializeBrowser({ onAllPagesClosed }: InitializeBrowserOptions = {}): Promise<void> {
		try {
			const args = [];

			// Add window position if configured
			if (this.config.windowPosition) {
				args.push(`--window-position=${this.config.windowPosition}`);
			}

			this.browser = await chromium.launch({
				headless: this.config.headless,
				args: args,
				devtools: this.config.openDevtools,
			});
			this.context = await this.browser.newContext({
				// ...(devices['Desktop Chrome'] || {}),
				ignoreHTTPSErrors: true,
				viewport: (() => {
					if (typeof this.config.viewport === "string") {
						const viewport = this.config.viewport.split("x").map(Number)
						return { width: viewport[0] || 1920, height: viewport[1] || 1080 }
					}
					return this.config.viewport
				})()	
			});

			this.context.on('page', ((page: Page) => {
				page.on('close', async () => {
					if (this.context!.pages().length === 0) {
						await this.saveCookies();
						onAllPagesClosed && await onAllPagesClosed();
					}
				})
			}));
			// apply cookie or auth
			await this.applyAuthToContext(this.config);
			if (this.config.urls) {
				await this.openPages(this.config.urls);
			}
		} catch (error) {
			console.error(red("\nMonitor failed to start:", error));
		}
	}

	async openPages(urls: string[]): Promise<void> {
		for (let i = 0; i < urls.length; i++) {
			// login is encountered, stop the loop
			if (this.temp) return
			const page = await this.initializePage(urls[i]);
			if (!this.config.debug) {
				await this.autoClose(page, urls[i]);
			}
		}

		if (this.currentPage) {
			await this.currentPage.bringToFront();
		}
	}

	async screenshot(page: Page, name: string): Promise<void> {
		const filename = path.resolve(__dirname, `cache/${name}.png`)
		await page.screenshot({ path: filename, fullPage: true });
		console.log(green(`Success: Screenshot saved as ${filename}`));
	}
	// block the current page close event
	async blockPageClose(page: Page, url: string): Promise<void> {
		page.on('close', async () => {
			const newPage = await this.initializePage(url);
			newPage.evaluate(({ toolName }) => {
				window.alert(`${toolName}: the target page cannot be closed, the page is reopened`);
			}, { toolName });
		});
	}
	// close the page and take a screenshot
	async autoClose(page: Page, url: string): Promise<boolean> {
		return new Promise(async (resolve, reject) => {
			this.timeout.push(setTimeout(async () => {
				if (page.isClosed()) {
					resolve(true);
					return;
				};
				try {
					this.screenshot(page, encodeURI(url.replace(/https?:\/\//, "")))
				} catch (e) {
					console.error(red('\nERROR: Failed to take screenshot before exit:', (e as Error).message));
				} finally {
					page.close();
					resolve(true);
				}
			}, this.config.timeout || 1000 * 5))
		})
	}
	async initializePage(url: string): Promise<Page> {
		return new Promise(async (resolve, reject) => {
			console.log(`INFO: initialize page ${url}`);
			const page = await this.context!.newPage()

			// only controls the first page in debug mode
			if (this.config.debug) {
				if (this.config.urls && this.config.urls.indexOf(url) === 0) {
					// remove all listeners but not close the page, in case the login process is not completed
					this.removeAllListeners(this.currentPage);
					this.currentPage = page;
					// block the current page close event
					this.blockPageClose(page, url);
					this.setupMonitoring(page, url);
					// clear errors.log
					fs.writeFileSync(path.resolve(this.config.cacheDir, "errors.log"), "");
				}
				try {
					await page.goto(url);
					resolve(page);
				} catch (error) {
					console.error(red((error as Error).message));
				}
				return
			}

			this.setupMonitoring(page, url);
			this.currentPage = page;
			try {
				await page.goto(url);
				await page.waitForLoadState("domcontentloaded");

			} catch (error) {
				console.error(red((error as Error).message));
			}
			resolve(page);
		})
	}
	setupLoginMonitoring(page: Page, url: string): void {
		if (!page) return;

		page.on('load', () => {
			const _url = page.url();
			const _hostname = new URL(_url).hostname;
			if (this.config.authSites && this.config.authSites.includes(_hostname)) {
				this.jumpOut(url, page, _url)
				return
			}
			// Record page load event if recording is active
			if (this.recorder) {
				const viewport = page.viewportSize() || { width: 1280, height: 720 };
				this.recorder.recordPageLoad(_url, viewport);
			}
		});
	}
	setupMonitoring(page: Page, url: string): void {
		if (!page) return;
		this.setupLoginMonitoring(page, url);
		page.on('load', async () => {
			const _url = page.url();
			const serverPort = (this.config as any).port || 3000;
			console.log(`\n[INFO] Page loaded/refreshed: ${_url}\n`);
		});

		page.on('console', async (msg) => {
			const type = msg.type();
			const text = msg.text();
			if (["debug"].includes(type)) {
				return;
			}
			if (type === "error") {
				// Handle network-related errors differently based on configuration
				if (text.includes("404") || text.includes("Failed to load resource")) {
					this.handleError("Network Error", url, text);
					return
				}
				// this redirect error should be handled in the response handler
				const authUrl = this.config.authSites?.map(i => {
					if (new RegExp(`at 'https?://${i}`).test(text) && !url.includes(i)) {
						return text.match(/at '(.*?')/)?.[1].replace(/'/g, "");
					}
				}).find(i => typeof i === "string")
				if (authUrl) {
					return
				}
				this.handleError("Console Error", url, text);
				return;
			}
			console.log(`\n[Console ${type}]: ${text}`);
		});

		// Monitor page errors
		page.on('pageerror', (error: Error) => {
			this.handleError("Uncaught exception", url, error);
		});

		// Monitor workers
		page.on('worker', (worker) => {
			console.log(`\n[Worker Started] ${worker.url()}`);
			// Worker console monitoring is not straightforward in Playwright
			// Leaving this as a basic worker started log
		});

		// Monitor dialogs
		page.on('dialog', async (dialog) => {
			const type = dialog.type();
			const message = dialog.message();
			if (new RegExp(`^${toolName}`).test(message)) {
				return;
			}
			console.log(`\n[Dialog] ${type}: ${message}`);
			try {
				await dialog.dismiss();
			} catch (error) { }
		});

		const networkFilterPatterns: RegExp[] = this.config.networkFilterPatterns || [];
		page.on('request', (request) => {
			const _url = decodeURIComponent(request.url());
			const method = request.method();

			if (networkFilterPatterns.find(i => i.test(_url))) {
				console.log(`\n[Request] ${method} ${_url}`);
				return;
			}
		});
		// when the request could not reach the server or the connection was lost, not when the server responds with 4xx/5xx.
		page.on('requestfailed', request => {
			const _url = decodeURIComponent(request.url());
			const text = request.failure()?.errorText || 'Unknown error';
			this.handleError("Network Error", url, `Request failed\n${_url}: ${text}`);
		});
		page.on('response', async (response) => {
			const status = response.status();
			const _url = decodeURIComponent(response.url());
			try {
				if ([301, 302, 304, 303, 307, 308].includes(status)) {
					const headers = response.headers();
					const redirectLocation = headers['location'];
					const authHost = this.config.authSites?.find(i => new RegExp(`^https?://${i}`).test(redirectLocation))
					if (authHost) {
						console.log(yellow(`\nINFO: redirect to auth page: ${redirectLocation}`));
						this.jumpOut(url, page, redirectLocation)
						try {
							page.goto(redirectLocation)
						} catch (error) {
							console.error(red('\nERROR: Failed to redirect to auth page:', (error as Error).message));
						}
						return
					}
					if (networkFilterPatterns.find(i => i.test(_url))) {
						console.log(yellow(`\n[Response] ${_url}: redirect request, try to move to ${redirectLocation}`));
						return;
					}
					return;
				}

				if (status !== 200) {
					if (/^3/.test(String(status))) {
						this.handleError("Network Error", url, `${status} ${_url}`);
						return;
					}
					const text = await response.text()
					this.handleError("Network Error", url, `${status} ${_url}: ${text}`);
					return
				}
				if (networkFilterPatterns.find(i => i.test(_url))) {
					const text = await response.text()
					console.log(`\n[Response] ${_url}: ${text}`);
					return;
				}
			} catch (error) {
				console.log(red(`\n[Response] ${status} ${_url}: ${(error as Error).message}`));
			}
		});
	}
	// 3xx is captured, or redirect to auth page by server
	jumpOut(targetUrl: string, page: Page, authUrl: string): void {
		this.removeAllListeners(page);
		this.temp = {
			targetUrl,
		}
		this.timeout.map(i => clearTimeout(i));
		this.timeout = [];
		const authPage = new URL(authUrl).hostname;
		page.on('load', () => {
			const _url = page.url();
			const _hostname = new URL(_url).hostname;
			if (this.config.authSites && this.config.authSites.includes(_hostname)) {
				console.log(yellow(`INFO: waiting for login, stop at url:${targetUrl}`));
				this.removeAllListeners(page);
				this.loginAdaptor(page, authPage, 1)
				return
			} else {
				console.log(green(`INFO: The login page did not load. Try applying the available cookies to the target URL.`));
				this.removeAllListeners(page);
				this.afterLogin(targetUrl)
			}
		})
	}

	async loginAdaptor(page: Page, authPage: string, times: number): Promise<void> {
		console.log(yellow(`INFO: login page loaded, times: ${times}`));
		page.on('load', () => {
			const _url = page.url();
			const _hostname = new URL(_url).hostname;
			this.removeAllListeners(page);
			if (!this.config.authSites?.includes(_hostname)) {
				console.log(green(`INFO: ${authPage} login process completed`));
				this.temp && this.afterLogin(this.temp.targetUrl)
			} else {
				this.loginAdaptor(page, authPage, times + 1)
			}
		});
		if (!this.auth || (!this.auth[authPage] && !this.auth["authWithoutHost"])) {
			console.log(yellow(`INFO: ${authPage} auth account data not found, please login manually`));
			return;
		}
		const account = this.auth[authPage] || this.auth["authWithoutHost"]
		const customAdaptor = customLoginAdaptors.find(i => i.pattern.test(authPage))
		if (customAdaptor) {
			console.log(green(`INFO: login to ${authPage} with custom adaptor`));
			await page.evaluate(customAdaptor.adaptor as (account: AuthAccount) => Promise<string>, account);
			return;
		}
		try {
			const _loginAdaptors: LoginAdaptor[] = require('./public/static/loginAdaptors.js');
			const adaptor = _loginAdaptors.find(i => i.pattern.test(authPage))
			if (!adaptor) {
				console.log(yellow(`INFO: please login manually, no login adaptor is matched for ${authPage}`));
				return
			}
			console.log(green(`INFO: login to ${authPage} with account/phone: ${account.user || account.phone}`));
			await adaptor.adaptor(page, account);
		} catch (error) {

		}
	}

	async afterLogin(url: string): Promise<void> {
		this.temp = null;
		this.timeout.map(i => clearTimeout(i));
		const hostname = new URL(url).hostname;
		const cookies = await this.context!.cookies();
		await this.saveCookies();
		await this.context!.addCookies(cookies.map(i => ({
			...i,
			domain: hostname,
		})));
		// re-open pages with the same hostname since cookies are updated
		console.log(green(`INFO: re-open pages with the same hostname: ${hostname}`));
		if (this.config.urls) {
			this.openPages(this.config.urls.filter(i => new URL(i).hostname === hostname));
		}
	}

	async saveCookies(): Promise<void> {
		const cookies = await this.context!.cookies();
		const _path = path.resolve(this.config.cacheDir, "cookies.json")
		const { cookiesShouldBeSaved } = this.config
		const filteredCookies = cookies.filter(i => (cookiesShouldBeSaved || []).includes(i.domain))
		fs.writeFileSync(_path, JSON.stringify(filteredCookies, null, 2));
		console.log(green(`INFO: ${filteredCookies.length} cookies saved to ${_path}`));
	}

	handleError(type: string, url: string, error: any): void {
		const logFilePath = path.resolve(this.config.cacheDir, 'errors.log')
		console.error(red(`\n[BREAKING] ${type}: ${url}. error message saved to ${logFilePath}\n${error}`));

		try {
			const timestamp = new Date().toISOString();
			const logLine = `${timestamp} ${type} ${url} ${error}\n\n`;
			fs.writeFileSync(logFilePath, logLine, { flag: 'a' });
		} catch (logError) {
			console.error(red(`\nError: Failed to write to log file: ${(logError as Error).message}`));
		}
	}
	removeAllListeners(page: Page | null): void {
		if (!page) return;
		// avoid remove close listener
		const events = [
			"load",
			"console",
			"crash",
			"pageerror",
			"worker",
			"dialog",
			"request",
			"requestfailed",
			"response"
		] as const;
		events.forEach(event => page.removeAllListeners(event));
	}
	async cleanup(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
		}
	}
}

// // ES Module check for main module execution
// const isMainModule = typeof require !== 'undefined' && require.main === module;
// if (isMainModule) {
// 	const config = parseArgs();

// 	const monitor = new Monitor(config);

// 	(async () => {
// 		try {
// 			await monitor.initializeBrowser();
// 		} catch (error) {
// 			console.error(red("Monitor failed to start:", error));
// 			if (config.exitOnError) {
// 				process.exit(1);
// 			}
// 		}
// 	})();
// }

export default Monitor; 