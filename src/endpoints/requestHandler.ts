import { Request, Response } from 'express';
import chalk from 'chalk';
import Monitor from '../monitor';
import { MonitorConfig } from '../types/monitor';

const reqListeningMap = new Map<string, {
	response?: string;
	isCaptured?: boolean;
	isMocked?: boolean;
}>();

const handler = async (req: Request, res: Response, monitor: Monitor, config: MonitorConfig, type: 'mock' | 'capture' | 'cancelMock' | 'cancelCapture') => {
	try {
		const page = monitor.currentPage;
		if (!page) return res.status(400).json({ error: 'Page not initialized' });

		const { url, response: desiredResponse, status = 200 } = req.body as {
			url: string;
			response: any;
			status?: number;
		};

		// Validate required parameters
		if (!url) {
			return res.status(400).json({ error: 'Missing required parameter: url' });
		}

		const _url = url.replace(/^\//, '').replace(/\/$/, '');
		// Set up route interception for the specified URL
		// Use glob pattern to match URLs containing the specified path
		const urlPattern = `**/*${_url}*`;

		const reqListening = reqListeningMap.get(urlPattern) || {};

		if (['cancelMock', 'cancelCapture'].includes(type)) {
			if (type === 'cancelMock') {
				reqListening.isMocked = false;
			}
			if (type === 'cancelCapture') {
				reqListening.isCaptured = false;
			}
			if (!reqListening.isMocked && !reqListening.isCaptured) {
				reqListeningMap.delete(urlPattern);
				await page.unroute(urlPattern);
			} else {
				reqListeningMap.set(urlPattern, reqListening);
			}
			const msg = `Request ${type} for URL pattern: ${_url}`;
			console.log(chalk.green(`\n${msg}`));
			res.json({
				success: true,
				message: msg,
			});
			return;
		}

		if (type === 'mock') {
			let _response = (() => {
				try {
					return JSON.stringify(desiredResponse);
				} catch (error) {
					return desiredResponse || "{}";
				}
			})();
			reqListeningMap.set(urlPattern, {
				...reqListening,
				response: _response,
				isMocked: true,
			});
		}
		if (type === 'capture') {
			reqListeningMap.set(urlPattern, {
				...reqListening,
				isCaptured: true,
			});
		}
		await page.route(urlPattern, async route => {
			const _url = decodeURIComponent(route.request().url());
			const _reqListening = reqListeningMap.get(urlPattern) || {};
			console.log(chalk.blue(`\nRequest ${type}: ${_url}`));

			if (_reqListening.isMocked) {
				const body = _reqListening.response || "{}";
				await route.fulfill({
					status: status,
					contentType: 'application/json',
					body
				});
				if (_reqListening.isCaptured) {
					console.log(chalk.blue(`\nRequest capture: ${_url}\n${body}`));
				}
				return;
			}
			if (_reqListening.isCaptured) {
				const response = await route.fetch();
				const json = await response.json();
				await route.fulfill({ response, json });
				console.log(chalk.blue(`\nRequest capture: ${_url}\n${JSON.stringify(json, null, 2)}`));
			}
		});

		const msg = `Request ${type} set up for URL pattern: ${_url}`;
		console.log(chalk.green(`\n${msg}`));
		res.json({
			success: true,
			message: msg,
		});

	} catch (error) {
		console.error(chalk.red('Error in mock Request:', error));
		res.status(500).json({
			error: 'Internal server error',
			message: (error as Error).message
		});
	}
};

export default handler;

