#!/usr/bin/env node

import { createProgram } from '../src/cli/commands.js';

try {
	await createProgram().parseAsync(process.argv);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
