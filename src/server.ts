#!/usr/bin/env node
import express, { Express, Request, Response } from 'express';
import Monitor from './monitor';
import chalk from 'chalk';
import { parseArgs, cleanupScreenshots, isPortAvailable, openInNewWindow } from './helpers/utils';
import screenshot from './endpoints/screenshot';
import requestHandler from './endpoints/requestHandler';
import * as recorder from './endpoints/recorder';
import { ServerConfig } from './types/monitor';

const config: ServerConfig = { 
	port: 3000, 
	newWindow: true,
	openDevtools: true,
	...parseArgs(), 
	rootPath: __dirname,
};

// Check if server should run in a new window before initializing anything
if (config.newWindow) {
	openInNewWindow();
	// This will exit the current process, so code below won't execute
}

const app: Express = express();

const monitor = new Monitor({
	debug: true,
	urls: [],
	...config
});

const cacheDir = monitor.config.cacheDir;

// Add middleware to parse JSON requests
app.use(express.json());

// Add CORS middleware to allow browser requests
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	
	// Handle preflight requests
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	
	next();
});

// Serve static files from the cache directory
app.use('/screenshots', express.static(cacheDir));

app.post('/request/mock', (req: Request, res: Response) => requestHandler(req, res, monitor, config, 'mock'));
app.post('/request/mock/cancel', (req: Request, res: Response) => requestHandler(req, res, monitor, config, 'cancelMock'));
app.post('/request/capture', (req: Request, res: Response) => requestHandler(req, res, monitor, config, 'capture'));
app.post('/request/capture/cancel', (req: Request, res: Response) => requestHandler(req, res, monitor, config, 'cancelCapture'));
app.get('/screenshot', (req: Request, res: Response) => screenshot(req, res, monitor, config));

// Recorder endpoints
app.post('/recorder/start', (req: Request, res: Response) => recorder.startRecording(req, res, monitor, config));
app.post('/recorder/stop', (req: Request, res: Response) => recorder.stopRecording(req, res, monitor, config));
app.get('/recorder/status', (req: Request, res: Response) => recorder.getStatus(req, res, monitor, config));
app.post('/recorder/event', (req: Request, res: Response) => recorder.addEvent(req, res, monitor, config));
app.get('/recorder/sessions', (req: Request, res: Response) => recorder.listSessions(req, res, monitor, config));
app.get('/recorder/session/:id', (req: Request, res: Response) => recorder.getSession(req, res, monitor, config));
app.post('/recorder/replay/:id', (req: Request, res: Response) => recorder.replaySession(req, res, monitor, config));
app.delete('/recorder/session/:id', (req: Request, res: Response) => recorder.deleteSession(req, res, monitor, config));
app.put('/recorder/session/:id/name', (req: Request, res: Response) => recorder.updateSessionName(req, res, monitor, config));

// Check port availability before starting server
async function startServer(): Promise<void> {
	let portAvailable = false
	while (!portAvailable) {
		console.error(chalk.yellow(`Trying port ${config.port}...`));
		portAvailable = await isPortAvailable(config.port!);
		if (!portAvailable) {
			console.error(chalk.yellow(`Port ${config.port} is already in use.`));
			config.port++;
		}
	}
	app.listen(config.port, async () => {
		console.log(`listening on port ${config.port}`)

		// Clean up old screenshots on startup
		cleanupScreenshots(cacheDir);
		console.log(`\nAvailable endpoints:\n
			GET  /screenshot - Take a screenshot of the current page
				Query params: ?selector=ELEMENT_SELECTOR&clip={"x":0,"y":0,"width":100,"height":100}
			GET  /screenshots/:filename - View screenshot files
			
			Recorder endpoints:
			POST /recorder/start - Start recording user actions
			POST /recorder/stop - Stop recording and save
			GET  /recorder/status - Get current recording status
			GET  /recorder/sessions - List all saved recordings
			GET  /recorder/session/:id - Get recording details
			POST /recorder/replay/:id - Replay a recorded session
				Query params: ?speed=1.0&skipMouseMoves=false&screenshot=false
			DELETE /recorder/session/:id - Delete a recording
			PUT /recorder/session/:id/name - Update recording name
		`)
	});

		// Initialize browser
		await monitor.initializeBrowser({
			onAllPagesClosed: async () => {
				console.log(chalk.yellow('All pages closed, exiting server...'));
				process.exit(0);
			}
		})
}

startServer();

