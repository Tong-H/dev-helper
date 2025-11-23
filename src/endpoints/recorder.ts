import { Request, Response } from 'express';
import chalk from 'chalk';
import Monitor from '../monitor';
import { ServerConfig } from '../types/monitor';
import { RecordedAction, ReplayOptions } from '../types/recorder';
import { getClientRecorderScript } from '../recorder/utils';

const red = chalk.red;
const green = chalk.green;
const yellow = chalk.yellow;

// POST /recorder/start
export async function startRecording(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		const page = monitor.currentPage;
		if (!page || !monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		// Inject recorder script into page
		try {
			const script = getClientRecorderScript(config, {
				recordMouseMoves: false,
				mouseMoveThrottle: 100
			});

			await page?.evaluate(script);
			console.log(green('\n[Recorder] Client script injected into page'));
		} catch (error) {
			console.error(red('\n[Recorder] Failed to inject client script:', (error as Error).message));
		}
		const { name } = req.body || {};
		const startUrl = page?.url();

		const result = monitor.recorder.startRecording(name, startUrl);

		console.log(green('[Recorder] Recording started via API'));

		res.json({
			success: true,
			sessionId: result.sessionId,
			startTime: result.startTime,
			message: 'Recording started. Interact with the page normally.'
		});
	} catch (error) {
		console.error(red('[Recorder] Error starting recording:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// POST /recorder/stop
export async function stopRecording(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}
		await monitor.currentPage?.evaluate(() => {
			// @ts-ignore
			window.__recorderStatus = false;
		});
		const result = monitor.recorder.stopRecording();

		console.log(green('[Recorder] Recording stopped via API'));

		res.json({
			success: true,
			sessionId: result.sessionId,
			duration: result.duration,
			eventCount: result.eventCount,
			filepath: result.filepath,
			message: `Recording saved. Use POST /recorder/replay/${result.sessionId} to run this test.`
		});
	} catch (error) {
		console.error(red('[Recorder] Error stopping recording:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// GET /recorder/status
export async function getStatus(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		const status = monitor.recorder.getStatus();

		if (status.isRecording) {
			const elapsedTime = status.startTime ? Date.now() - status.startTime : 0;
			res.json({
				isRecording: true,
				sessionId: status.sessionId,
				startTime: status.startTime,
				eventCount: status.eventCount,
				elapsedTime
			});
		} else {
			res.json({
				isRecording: false
			});
		}
	} catch (error) {
		console.error(red('[Recorder] Error getting status:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// POST /recorder/event (internal endpoint for client script)
export async function addEvent(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		const event: RecordedAction = req.body;
		monitor.recorder.addEvent(event);

		res.json({ success: true });
	} catch (error) {
		console.error(red('[Recorder] Error adding event:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// GET /recorder/sessions
export async function listSessions(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		const recordings = monitor.recorder.listSessions();

		res.json({
			success: true,
			recordings: recordings.map(r => ({
				id: r.id,
				name: r.name,
				startUrl: r.startUrl,
				startTime: r.startTime,
				duration: r.duration,
				eventCount: r.eventCount
			})),
			count: recordings.length
		});
	} catch (error) {
		console.error(red('[Recorder] Error listing sessions:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// GET /recorder/session/:id
export async function getSession(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		const { id } = req.params;
		const session = monitor.recorder.loadSession(id);

		res.json({
			success: true,
			session
		});
	} catch (error) {
		console.error(red('[Recorder] Error getting session:', error));
		res.status(404).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// POST /recorder/replay/:id
export async function replaySession(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		if (!monitor.currentPage) {
			return res.status(400).json({
				success: false,
				error: 'No active page'
			});
		}

		const { id } = req.params;
		const options: ReplayOptions = {
			speedMultiplier: parseFloat(req.query.speed as string) || 1.0,
			minDuration: req.query.minDuration ? parseInt(req.query.minDuration as string) : undefined,
			maxDuration: req.query.maxDuration ? parseInt(req.query.maxDuration as string) : undefined,
			skipMouseMoves: req.query.skipMouseMoves === 'true',
			screenshot: req.query.screenshot === 'true',
			stopOnError: req.query.stopOnError !== 'false'
		};

		console.log(green(`[Recorder] Starting replay of session: ${id}`));
		const result = await monitor.recorder.replaySession(id, monitor.currentPage, options);

		if (result.screenshots && result.screenshots.length > 0) {
			result.screenshots = result.screenshots.map(
				url => `http://localhost:${config.port}${url}`
			);
		}

		res.json(result);
	} catch (error) {
		console.error(red('[Recorder] Error replaying session:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// DELETE /recorder/session/:id
export async function deleteSession(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		const { id } = req.params;
		monitor.recorder.deleteSession(id);

		res.json({
			success: true,
			sessionId: id,
			message: 'Recording deleted successfully'
		});
	} catch (error) {
		console.error(red('[Recorder] Error deleting session:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

// PUT /recorder/session/:id/name
export async function updateSessionName(req: Request, res: Response, monitor: Monitor, config: ServerConfig) {
	try {
		if (!monitor.recorder) {
			return res.status(400).json({
				success: false,
				error: 'Recorder not initialized'
			});
		}

		const { id } = req.params;
		const { name } = req.body;

		if (!name) {
			return res.status(400).json({
				success: false,
				error: 'Name is required'
			});
		}

		monitor.recorder.updateSessionName(id, name);

		res.json({
			success: true,
			sessionId: id,
			name,
			message: 'Recording name updated'
		});
	} catch (error) {
		console.error(red('[Recorder] Error updating session name:', error));
		res.status(500).json({
			success: false,
			error: (error as Error).message
		});
	}
}

