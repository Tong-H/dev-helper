import { Request, Response } from 'express';
import Monitor from '../monitor';
import { MonitorConfig } from './monitor';

export interface EndpointHandler {
	(req: Request, res: Response, monitor: Monitor, config: MonitorConfig, extra?: any): Promise<void>;
}

export interface MockAction {
	name: string;
}

