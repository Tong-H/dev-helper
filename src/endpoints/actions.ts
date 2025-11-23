import { Request, Response } from 'express';
import { Page } from 'playwright';
import chalk from 'chalk';
import { takeScreenshot, findElementByMultipleStrategies } from '../helpers/utils';
import { Action, ActionResult, ServerConfig } from '../types/monitor';
import { EndpointHandler, MockAction } from '../types/endpoints';
import Monitor from '../monitor';

function cleanHTML(): string {
	const clone = document.getElementsByTagName("body")[0].cloneNode(true) as HTMLElement;

	// Remove all styling and scripting attributes/tags
	clone.querySelectorAll('*').forEach(el => {
		['style', 'class', 'id'].forEach(attr => el.removeAttribute(attr));
		// Remove data-* attributes
		Array.from(el.attributes).forEach(attr => {
			if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
		});
	});

	clone.querySelectorAll('style, script').forEach(tag => tag.remove());
	return clone.outerHTML;
}

// Helper function to parse and validate actions
function parseActions(actionsParam: string): Action[] | null {
	try {
		const actions = JSON.parse(actionsParam);
		if (!Array.isArray(actions)) return [actions];
		return actions;
	} catch (parseError) {
		console.error(chalk.red('Invalid JSON in actions parameter:', parseError));
		return null;
	}
}

// Helper function to process a single action
async function processAction(action: Action, page: Page): Promise<boolean | string> {
	const { type, interval, selectors, value, code, coordinator } = action;
	try {
		switch (type) {
			case "javascript": {
				if (!code) {
					console.log("No JavaScript code provided for execution");
					return false;
				}

				await page.evaluate(code);
				console.log(`Executed JavaScript code: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);
				return true;
			}
			case "cursor-click": {
				if (!coordinator) return false;
				await page.mouse.click(coordinator.x, coordinator.y);
				return true;
			}
			case "cursor-move": {
				if (!coordinator) return false;
				await page.mouse.move(coordinator.x, coordinator.y);
				return true;
			}
			case "fill-form": {
				if (!selectors) return false;
				const element = await findElementByMultipleStrategies(page, selectors);
				if (!element) {
					console.log(`Element with "${selectors}" not found by any strategy`);
					return false;
				}
				const tagName = await element.evaluate(el => el.tagName.toLowerCase());
				const inputTagNames = ['input', 'textarea', 'select'];
				await element.click();
				// if it's an input element and has a value, then fill it with the value
				if (inputTagNames.includes(tagName) && value !== undefined) {
					await element.fill(value);
				}
				return true;
			}
			case "get-html": {
				if (!selectors) return false;
				const element = await findElementByMultipleStrategies(page, selectors);
				if (!element) {
					console.log(`Element with "${selectors}" not found by any strategy`);
					return false;
				} 
				return await element.innerHTML();
			}
		}
	} catch (error) {
		console.error(chalk.red(`Action Execution Error:`, error));
		return false;
	}
	return false;
}

/**
 * Example actions array format for the /actions endpoint:
 * {
 *   type: "fill-form" | "javascript" | "cursor-click" | "cursor-move" | "get-html",
 *   selectors?: string[], // the first one is the container, the second one is the target element
 *   interval?: number,
 *   value?: string,
 *   code?: string,
 *   coordinator?: {
 *     x: number,
 *     y: number
 *   }
 * }
 */
const mockActions: Record<string, Action[]> = {
	ingee: [
		{ type: "fill-form", selectors: ["data-id=data-panel"], interval: 1000 },
		{ type: "get-html", selectors: ["id=data-panel", "textarea"], interval: 1000 },
		{ type: "cursor-click", coordinator: { x: 437, y: 498 }, interval: 1000 },
		{ type: "fill-form", selectors: ["data-id=data-panel"], interval: 1000 },
		{ type: "get-html", selectors: ["id=data-panel", "textarea"], interval: 1000 },
	],
};

const handler = async (req: Request, res: Response, monitor: Monitor, config: ServerConfig, extra?: MockAction) => {
	try {
		const page = monitor.currentPage;
		if (!page) return res.status(400).json({ error: 'Page not initialized' });
		// Parse and validate actions
		
		const actions = extra ? mockActions[extra.name] : parseActions(req.query.actions as string);
		if (!actions) return res.status(400).json({ error: 'Invalid actions parameter' });

		// Process all actions
		const results = await Promise.all(actions.map( async action => {
			const result = await processAction(action, page)
			if (action.interval && action.interval > 0) {
				await page.waitForTimeout(action.interval);
			}
			return result
		}));


		// Get the updated HTML after all actions
		// const html = await page.evaluate(cleanHTML);

		// Take screenshot using the utility function
		const screenshotResult = await takeScreenshot(page, monitor.config.cacheDir);

		res.json({
			success: true,
			results: results.map(result => ({
				status: result ? "success" : "failed",
				...(typeof result !== "boolean" ? {result} : {}),
			})),
			screenshot: screenshotResult.success ? `http://localhost:${config.port}${screenshotResult.url}` : null,
			screenshotInfo: screenshotResult
		});

	} catch (error) {
		console.error(chalk.red('Error in action endpoint:', error));
		res.status(500).json({
			error: 'Internal server error',
			message: (error as Error).message
		});
	}
}

export default handler;

