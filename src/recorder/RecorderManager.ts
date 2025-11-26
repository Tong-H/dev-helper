import fs from 'fs';
import path from 'path';
import { Page } from 'playwright';
import chalk from 'chalk';
import {
	RecordedAction,
	RecordingSession,
	RecorderState,
	ReplayOptions,
	ReplayResult
} from '../types/recorder';
import {
	ensureRecordingsDir,
	loadIndex,
	saveIndex,
	generateSessionId,
	getRecordingPath,
	calculateMetadata
} from './utils';
import { takeScreenshot } from '../helpers/utils';

const green = chalk.green;
const red = chalk.red;
const yellow = chalk.yellow;

export default class RecorderManager {
	private state: RecorderState;
	private cacheDir: string;
	private readonly storageDir: string;

	constructor(cacheDir: string) {
		this.cacheDir = cacheDir;
		this.storageDir = path.join(cacheDir, 'recordings');
		this.state = {
			isRecording: false,
			eventCount: 0
		};

		// Ensure recordings directory exists
		ensureRecordingsDir(cacheDir);
		console.log(green(`[Recorder] Initialized. Storage: ${this.storageDir}`));
	}

	// Start a new recording session
	startRecording(name?: string, startUrl?: string): { sessionId: string; startTime: number } {
		if (this.state.isRecording) {
			throw new Error('Already recording. Stop current session first.');
		}

		const sessionId = generateSessionId();
		const startTime = Date.now();
		const viewport = { width: 1920, height: 1080 }; // Will be updated from first event

		this.state = {
			isRecording: true,
			sessionId,
			startTime,
			eventCount: 0,
			currentSession: {
				id: sessionId,
				name,
				startUrl: startUrl || '',
				startTime,
				events: [],
				viewport
			}
		};

		console.log(green(`[Recorder] Started recording session: ${sessionId}`));
		return { sessionId, startTime };
	}

	// Stop recording and save to disk
	stopRecording(): { sessionId: string; duration: number; eventCount: number; filepath: string } {
		if (!this.state.isRecording || !this.state.currentSession) {
			throw new Error('No active recording session');
		}

		const endTime = Date.now();
		const session = this.state.currentSession;
		session.endTime = endTime;
		session.totalDuration = endTime - session.startTime;
		session.metadata = calculateMetadata(session.events);

		// Update startUrl from first event if not set
		if (!session.startUrl && session.events.length > 0) {
			session.startUrl = session.events[0].url;
		}

		// Save session to disk
		const filepath = this.saveSession(session);

		// Update index
		this.updateIndex(session, filepath);

		const result = {
			sessionId: session.id,
			duration: session.totalDuration,
			eventCount: session.events.length,
			filepath
		};

		// Reset state
		this.state = {
			isRecording: false,
			eventCount: 0
		};

		console.log(green(`[Recorder] Stopped recording: ${session.id} (${result.eventCount} events, ${result.duration}ms)`));
		return result;
	}

	// Add an event to the current recording
	addEvent(event: RecordedAction): void {
		if (!this.state.isRecording || !this.state.currentSession) {
			console.warn(yellow('[Recorder] Received event but not recording'));
			return;
		}

		// Update viewport from first event
		if (this.state.eventCount === 0) {
			this.state.currentSession.viewport = event.viewport;
			if (!this.state.currentSession.startUrl) {
				this.state.currentSession.startUrl = event.url;
			}
		}

		this.state.currentSession.events.push(event);
		this.state.eventCount++;
	}

	// Record a page load event
	recordPageLoad(url: string, viewport: { width: number; height: number }): void {
		if (!this.state.isRecording || !this.state.currentSession || !this.state.startTime) {
			return;
		}

		const now = Date.now();
		const timestamp = now - this.state.startTime;
		const events = this.state.currentSession.events;
		const duration = events.length > 0
			? timestamp - events[events.length - 1].timestamp
			: 0;

		this.addEvent({
			type: 'pageLoad',
			url,
			timestamp,
			duration,
			viewport
		});

		console.log(green(`[Recorder] Recorded page load: ${url}`));
	}

	// Get current recording status
	getStatus(): RecorderState {
		if (this.state.isRecording && this.state.startTime) {
			return {
				...this.state,
				eventCount: this.state.eventCount
			};
		}
		return {
			isRecording: false,
			eventCount: 0
		};
	}

	// Save session to disk
	saveSession(session: RecordingSession): string {
		const filepath = getRecordingPath(this.cacheDir, session.id);
		fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
		console.log(green(`[Recorder] Saved session to: ${filepath}`));
		return filepath;
	}

	// Load session from disk
	loadSession(sessionId: string): RecordingSession {
		const filepath = getRecordingPath(this.cacheDir, sessionId);
		if (!fs.existsSync(filepath)) {
			throw new Error(`Recording not found: ${sessionId}`);
		}
		const data = fs.readFileSync(filepath, 'utf-8');
		return JSON.parse(data);
	}

	// List all recordings
	listSessions(): Array<any> {
		const index = loadIndex(this.cacheDir);
		return index.recordings;
	}

	// Delete a recording
	deleteSession(sessionId: string): void {
		const filepath = getRecordingPath(this.cacheDir, sessionId);
		if (fs.existsSync(filepath)) {
			fs.unlinkSync(filepath);
		}

		// Update index
		const index = loadIndex(this.cacheDir);
		index.recordings = index.recordings.filter(r => r.id !== sessionId);
		saveIndex(this.cacheDir, index);

		console.log(green(`[Recorder] Deleted session: ${sessionId}`));
	}

	// Update session name
	updateSessionName(sessionId: string, name: string): void {
		// Update the session file
		const session = this.loadSession(sessionId);
		session.name = name;
		this.saveSession(session);

		// Update index
		const index = loadIndex(this.cacheDir);
		const recording = index.recordings.find(r => r.id === sessionId);
		if (recording) {
			recording.name = name;
			saveIndex(this.cacheDir, index);
		}

		console.log(green(`[Recorder] Updated session name: ${sessionId} -> "${name}"`));
	}

	// Replay a recorded session
	async replaySession(
		sessionId: string,
		page: Page,
		options: ReplayOptions = {}
	): Promise<ReplayResult> {
		const session = this.loadSession(sessionId);
		const screenshots: string[] = [];
		const errors: Array<{ eventIndex: number; event: RecordedAction; error: string }> = [];
		let eventsExecuted = 0;
		let currentUrl = session.startUrl;

		console.log(green(`[Recorder] Starting replay of session: ${sessionId} (${session.events.length} events)`));

		// Check and set viewport size to match recording
		const currentViewport = page.viewportSize();
		const recordedViewport = session.viewport;

		if (currentViewport) {
			const viewportMatches =
				currentViewport.width === recordedViewport.width &&
				currentViewport.height === recordedViewport.height;
			if (!viewportMatches) {
				try {
					await page.setViewportSize(recordedViewport);
					console.log(green(`[Recorder] Viewport adjusted to ${recordedViewport.width}x${recordedViewport.height}`));
				} catch (vpError) {
					console.warn(yellow(`[Recorder] Failed to set viewport: ${(vpError as Error).message}`));
				}
			}
		}

		// Navigate to start URL
		try {
			const currentPageUrl = page.url();
			if (currentPageUrl !== session.startUrl) {
				await page.goto(session.startUrl);
				await page.waitForLoadState("domcontentloaded");
				currentUrl = session.startUrl;
			} else {
				console.log(green(`[Recorder] Already on start URL, skipping navigation: ${session.startUrl}`));
				currentUrl = currentPageUrl;
			}
		} catch (error) {
			return {
				success: false,
				sessionId,
				eventsExecuted: 0,
				eventsFailed: 1,
				errors: [{
					eventIndex: -1,
					event: { type: 'click', timestamp: 0, duration: 0, url: session.startUrl, viewport: session.viewport },
					error: `Failed to navigate to start URL: ${(error as Error).message}`
				}],
				message: 'Failed to navigate to start URL'
			};
		}

		const startTime = Date.now();

		// Execute each event
		for (let i = 0; i < session.events.length; i++) {
			const event = session.events[i];

			try {
				// Skip mouse moves if requested
				if (options.skipMouseMoves && event.type === 'mousemove') {
					continue;
				}

				// Wait for duration (adjusted by speed)
				const waitTime = this.calculateWaitTime(event.duration, options);
				if (waitTime > 0) {
					await page.waitForTimeout(waitTime);
				}

				// Handle URL changes (navigation)
				if (event.url !== currentUrl) {
					// For pageLoad events, navigate to the URL if needed
					if (event.type === 'pageLoad') {
						const currentPageUrl = page.url();
						if (currentPageUrl !== event.url) {
							console.log(yellow(`[Recorder] Navigating to: ${event.url}`));
							try {
								await page.goto(event.url);
								await page.waitForLoadState("domcontentloaded");
								currentUrl = event.url;
							} catch (navError) {
								console.warn(yellow(`[Recorder] Navigation failed: ${(navError as Error).message}`));
							}
						} else {
							console.log(green(`[Recorder] Already on URL, skipping navigation: ${event.url}`));
							currentUrl = currentPageUrl;
						}
					} else {
						// For other events, wait for navigation to complete
						console.log(yellow(`[Recorder] URL changed, waiting for navigation: ${event.url}`));
						try {
							await page.waitForURL(event.url, { timeout: 30000 });
							currentUrl = event.url;
						} catch (navError) {
							console.warn(yellow(`[Recorder] Navigation timeout, continuing anyway`));
						}
					}
				}

				// Execute the action
				await this.executeAction(event, page);
				eventsExecuted++;

				// Take screenshot if requested
				if (options.screenshot) {
					const screenshotResult = await takeScreenshot(page, this.cacheDir);
					if (screenshotResult.success && screenshotResult.url) {
						screenshots.push(screenshotResult.url);
					}
				}

				console.log(`[Recorder] Executed event ${i + 1}/${session.events.length}: ${event.type}`);

			} catch (error) {
				const errorMsg = (error as Error).message;
				console.error(red(`[Recorder] Error executing event ${i}: ${errorMsg}`));

				errors.push({
					eventIndex: i,
					event,
					error: errorMsg
				});

				if (options.stopOnError !== false) {
					const actualDuration = Date.now() - startTime;
					return {
						success: false,
						sessionId,
						eventsExecuted,
						eventsFailed: errors.length,
						actualDuration,
						screenshots,
						errors,
						message: `Replay failed at event ${i}: ${errorMsg}`
					};
				}
			}
		}

		const actualDuration = Date.now() - startTime;
		const success = errors.length === 0;

		console.log(success
			? green(`[Recorder] Replay completed successfully: ${eventsExecuted} events`)
			: yellow(`[Recorder] Replay completed with errors: ${eventsExecuted} executed, ${errors.length} failed`)
		);

		return {
			success,
			sessionId,
			eventsExecuted,
			eventsFailed: errors.length,
			totalDuration: session.totalDuration,
			actualDuration,
			screenshots,
			errors: errors.length > 0 ? errors : undefined,
			message: success ? 'Replay completed successfully' : `Replay completed with ${errors.length} error(s)`
		};
	}

	// Execute a single action
	private async executeAction(event: RecordedAction, page: Page): Promise<void> {
		switch (event.type) {
			case 'click':
				if (event.x !== undefined && event.y !== undefined) {
					await page.mouse.click(event.x, event.y);
				}
				break;

			case 'mousemove':
				if (event.x !== undefined && event.y !== undefined) {
					await page.mouse.move(event.x, event.y);
				}
				break;

			case 'input':
			case 'keypress':
				if (event.value) {
					await page.keyboard.type(event.value);
				} else if (event.key) {
					await page.keyboard.press(event.key);
				}
				break;

			case 'scroll':
				if (event.scrollX !== undefined && event.scrollY !== undefined) {
					await page.evaluate(
						({ x, y }) => window.scrollTo(x, y),
						{ x: event.scrollX, y: event.scrollY }
					);
				}
				break;
		}
	}

	// Calculate wait time with speed multiplier and constraints
	private calculateWaitTime(originalDuration: number, options: ReplayOptions = {}): number {
		let waitTime = originalDuration;

		// Apply speed multiplier
		if (options.speedMultiplier) {
			waitTime = waitTime / options.speedMultiplier;
		}

		// Apply constraints
		const minDuration = options.minDuration ?? 0;
		const maxDuration = options.maxDuration ?? 10000;

		return Math.max(minDuration, Math.min(maxDuration, waitTime));
	}

	// Update the index file
	private updateIndex(session: RecordingSession, filepath: string): void {
		const index = loadIndex(this.cacheDir);

		// Remove old entry if exists
		index.recordings = index.recordings.filter(r => r.id !== session.id);

		// Add new entry
		index.recordings.push({
			id: session.id,
			name: session.name,
			startUrl: session.startUrl,
			startTime: session.startTime,
			duration: session.totalDuration,
			eventCount: session.events.length,
			filepath: path.basename(filepath)
		});

		saveIndex(this.cacheDir, index);
	}
}

