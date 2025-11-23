import { Request, Response } from 'express';
import chalk from 'chalk';
import { takeScreenshot } from '../helpers/utils';
import { ScreenshotOptions } from '../types/monitor';
import Monitor from '../monitor';
import { ServerConfig } from '../types/monitor';

const handler = async (req: Request, res: Response, monitor: Monitor, config: ServerConfig) => {
	try {
		const page = monitor.currentPage;
		if (!page) return res.status(400).json({ error: 'Page not initialized' });

		// Get screenshot options from query parameters
		const options: ScreenshotOptions = {};
		if (req.query.selector) {
			options.selector = req.query.selector as any;
		}
		if (req.query.clip) {
			try {
				options.clip = JSON.parse(req.query.clip as string);
			} catch (e) {
				// Ignore invalid clip parameter
			}
		}
		// Take screenshot using the utility function
		const screenshotResult = await takeScreenshot(page, monitor.config.cacheDir, options);

		if (!screenshotResult.success) {
			return res.status(500).json({
				error: 'Screenshot failed',
				message: screenshotResult.error
			});
		}

		const response: any = {
			success: true,
			message: 'Screenshot taken successfully',
			screenshot: `http://localhost:${config.port}${screenshotResult.url}`,
			screenshotInfo: screenshotResult
		};

		// Add element-specific information if selector was used
		if (screenshotResult.selector && screenshotResult.elementInfo) {
			response.elementInfo = {
				selector: screenshotResult.selector,
				offset: {
					x: screenshotResult.elementInfo.x,
					y: screenshotResult.elementInfo.y,
					width: screenshotResult.elementInfo.width,
					height: screenshotResult.elementInfo.height
				},
				viewport: {
					width: screenshotResult.elementInfo.viewportWidth,
					height: screenshotResult.elementInfo.viewportHeight
				},
				scroll: {
					x: screenshotResult.elementInfo.scrollX,
					y: screenshotResult.elementInfo.scrollY
				}
			};
		}
		console.log(chalk.green(`\nScreenshot taken successfully: ${screenshotResult.url}`));
		res.json(response);

	} catch (error) {
		console.error(chalk.red('Error in screenshot endpoint:', error));
		res.status(500).json({
			error: 'Internal server error',
			message: (error as Error).message
		});
	}
};

export default handler;

