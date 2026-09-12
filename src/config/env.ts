import 'dotenv/config';
import { config } from 'dotenv';
import { homedir } from 'node:os';
import { join } from 'node:path';

config({ path: join(homedir(), '.scommit.env') });

export const env = {
	geminiApiKey: process.env.GEMINI_API_KEY,
} as const;

export type EnvironmentConfig = typeof env;
