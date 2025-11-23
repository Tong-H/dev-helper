#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { McpServer, } from "@modelcontextprotocol/sdk/server/mcp.js";
import path, { join } from "path";
import { readFileSync, } from "fs";
import { getCacheDirectory } from './helpers/utils';

// Create server instance
const server = new McpServer({
	name: "dev-playkit",
	version: "1.0.0",
})

const scriptPath = path.resolve(__dirname, "server.js")
const cachePath = getCacheDirectory()

const readme = Object.entries({
	server: readFileSync(join(__dirname, "/public/readme/server.md"), "utf-8"),
	monitor: readFileSync(join(__dirname, "/public/readme/monitor.md"), "utf-8"),
	recorder: readFileSync(join(__dirname, "/public/readme/recorder.md"), "utf-8"),
}).reduce((acc, [key, value]) => ({ ...acc, [key]: value.replace(/{{cachePath}}/img, cachePath)}), {} as Record<string, string>)


server.registerTool("debug", {
	description: "Debug pages",
}, async () => {
	return {
		content: [
			{
				type: "text" as const,
				text: `IMPORTANT: 
1. this tool requires the write and read permissions to the cache directory: ${cachePath}.
2. use \`required_permissions: ["all"]\` when run the node command.
3. use \`is_background: false\` until the server is started, then set it to true \`is_background: false\`, so the server will run in the background, `,
			}, {
				type: "text" as const,
				text: readme.monitor,
			}, {
				type: "text" as const,
				text: readme.server,
			}, {
				type: "text" as const,
				text: readme.recorder,
			}],
	}
})

async function main() {
	try {
		const transport = new StdioServerTransport()
		await server.connect(transport)
	} catch (error) {
		console.error("Error connecting server:", error);
		throw error;
	}
}

main().catch((error) => {
	console.error("Fatal error in main():", error)
	process.exit(1)
})
