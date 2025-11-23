import fs from 'fs';
import path from 'path';
import { RecordingIndex } from '../types/recorder';
import { ServerConfig } from '../types/monitor';

export function getClientRecorderScript(serverConfig: ServerConfig, config: {
	recordMouseMoves: boolean;
	mouseMoveThrottle: number;
}): string {
	// Read the client script template
	let script = fs.readFileSync(path.join(serverConfig.rootPath, 'public', 'static', 'clientScript.js'), 'utf-8');
	
	// Replace placeholders with actual values
	// Pattern: /*{{PLACEHOLDER}}*/ defaultValue  ->  actualValue
	script = script.replace(/\/\*\{\{SERVER_PORT\}\}\*\/ \d+/g, String(serverConfig.port));
	script = script.replace(/\/\*\{\{RECORD_MOUSE_MOVES\}\}\*\/ (true|false)/g, String(config.recordMouseMoves));
	script = script.replace(/\/\*\{\{MOUSE_MOVE_THROTTLE\}\}\*\/ \d+/g, String(config.mouseMoveThrottle));
	
	return script;
}

export function ensureRecordingsDir(cacheDir: string): string {
	const recordingsDir = path.join(cacheDir, 'recordings');
	if (!fs.existsSync(recordingsDir)) {
		fs.mkdirSync(recordingsDir, { recursive: true });
	}
	return recordingsDir;
}

export function loadIndex(cacheDir: string): RecordingIndex {
	const indexPath = path.join(cacheDir, 'recordings', 'index.json');
	if (fs.existsSync(indexPath)) {
		try {
			const data = fs.readFileSync(indexPath, 'utf-8');
			return JSON.parse(data);
		} catch (error) {
			console.error('Error loading recordings index:', error);
		}
	}
	return {
		recordings: [],
		lastUpdated: Date.now()
	};
}

export function saveIndex(cacheDir: string, index: RecordingIndex): void {
	const indexPath = path.join(cacheDir, 'recordings', 'index.json');
	index.lastUpdated = Date.now();
	fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

export function generateSessionId(): string {
	const now = new Date();
	// Format: YYYYMMDD_HHMMSS (e.g., 20250106_143022)
	const timestamp = now.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d+Z$/, '')
		.replace('T', '_');
	const random = Math.random().toString(36).substring(2, 9);
	return `${timestamp}_${random}`;
}

export function getRecordingPath(cacheDir: string, sessionId: string): string {
	return path.join(cacheDir, 'recordings', `${sessionId}.json`);
}

export function calculateMetadata(events: any[]): {
	eventCount: number;
	urlChanges: number;
	averageActionDuration: number;
} {
	const eventCount = events.length;
	const urlChanges = events.reduce((count, event, index) => {
		if (index === 0) return 0;
		return event.url !== events[index - 1].url ? count + 1 : count;
	}, 0);
	
	const totalDuration = events.reduce((sum, event) => sum + (event.duration || 0), 0);
	const averageActionDuration = eventCount > 0 ? Math.round(totalDuration / eventCount) : 0;
	
	return {
		eventCount,
		urlChanges,
		averageActionDuration
	};
}

