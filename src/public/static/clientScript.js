(function() {
	// Only run in browser environment
	if (typeof window === 'undefined') return;
	
	window.__recorderStatus = true;

	// Prevent multiple injections
	if (window.__recorderInjected) return;
	window.__recorderInjected = true;

	const SERVER_PORT = /*{{SERVER_PORT}}*/ 3000;
	const RECORD_MOUSE_MOVES = /*{{RECORD_MOUSE_MOVES}}*/ false;
	const MOUSE_MOVE_THROTTLE = /*{{MOUSE_MOVE_THROTTLE}}*/ 100;

	let sessionStartTime = Date.now();
	let lastActionTimestamp = 0;
	let mouseMoveTimeout = null;

	function getViewport() {
		return {
			width: window.innerWidth,
			height: window.innerHeight
		};
	}

	function sendEvent(event) {
		fetch(`http://localhost:${SERVER_PORT}/recorder/event`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(event)
		}).catch(err => {
			console.error('Failed to send recording event:', err);
		});
	}

	function recordAction(type, data = {}) {
		if (window.__recorderStatus !== true) return;
		const now = Date.now();
		const timestamp = now - sessionStartTime;
		const duration = lastActionTimestamp ? now - lastActionTimestamp : 0;
		
		const event = {
			type,
			timestamp,
			duration,
			url: window.location.href,
			viewport: getViewport(),
			...data
		};

		sendEvent(event);
		lastActionTimestamp = now;
	}

	// Record mouse clicks
	document.addEventListener('click', (e) => {
		recordAction('click', {
			x: e.clientX,
			y: e.clientY
		});
	}, true);

	// Record mouse movements (throttled)
	if (RECORD_MOUSE_MOVES) {
		document.addEventListener('mousemove', (e) => {
			if (mouseMoveTimeout) return;
			
			mouseMoveTimeout = setTimeout(() => {
				recordAction('mousemove', {
					x: e.clientX,
					y: e.clientY
				});
				mouseMoveTimeout = null;
			}, MOUSE_MOVE_THROTTLE);
		}, true);
	}

	// Record keyboard input
	document.addEventListener('keydown', (e) => {
		// Skip modifier keys
		if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
		
		recordAction('keypress', {
			key: e.key,
			value: e.key.length === 1 ? e.key : ''
		});
	}, true);

	// Record scroll events (throttled)
	let scrollTimeout = null;
	window.addEventListener('scroll', () => {
		if (scrollTimeout) return;
		
		scrollTimeout = setTimeout(() => {
			recordAction('scroll', {
				scrollX: window.scrollX,
				scrollY: window.scrollY
			});
			scrollTimeout = null;
		}, 500);
	}, true);

	console.log('[Recorder] Client script injected and listening for events');
})();

