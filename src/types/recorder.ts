export interface RecordedAction {
	type: 'click' | 'mousemove' | 'input' | 'keypress' | 'scroll' | 'pageLoad';
	timestamp: number;      // ms from session start
	duration: number;       // ms to wait BEFORE this action (from previous action)
	x?: number;            // for mouse events
	y?: number;            // for mouse events
	value?: string;        // for input/keypress
	key?: string;          // for keypress events
	scrollX?: number;      // for scroll events
	scrollY?: number;      // for scroll events
	url: string;           // current page URL
	viewport: { width: number; height: number };
}

export interface RecordingSession {
	id: string;
	name?: string;         // optional name for AI to set
	startUrl: string;
	startTime: number;
	endTime?: number;
	totalDuration?: number;
	events: RecordedAction[];
	viewport: { width: number; height: number };
	metadata?: {
		eventCount: number;
		urlChanges: number;
		averageActionDuration: number;
	};
}

export interface RecordingIndex {
	recordings: Array<{
		id: string;
		name?: string;
		startUrl: string;
		startTime: number;
		duration?: number;
		eventCount: number;
		filepath: string;
	}>;
	lastUpdated: number;
}

export interface RecorderState {
	isRecording: boolean;
	sessionId?: string;
	startTime?: number;
	eventCount: number;
	currentSession?: RecordingSession;
}

export interface ReplayOptions {
	speedMultiplier?: number;       // 1.0 = normal speed
	minDuration?: number;          // minimum wait time (default: 0ms)
	maxDuration?: number;          // maximum wait time (default: 10000ms)
	skipMouseMoves?: boolean;
	screenshot?: boolean;          // take screenshot after each action
	stopOnError?: boolean;         // default true
}

export interface ReplayResult {
	success: boolean;
	sessionId: string;
	eventsExecuted: number;
	eventsFailed?: number;
	totalDuration?: number;
	actualDuration?: number;
	screenshots?: string[];
	errors?: Array<{
		eventIndex: number;
		event: RecordedAction;
		error: string;
	}>;
	message: string;
}

