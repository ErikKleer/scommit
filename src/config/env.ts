import 'dotenv/config';

export type LlmProvider = 'groq' | 'gemini';

export const env = {
	groqApiKey: process.env.GROQ_API_KEY,
	geminiApiKey: process.env.GEMINI_API_KEY,
	fallbackProviders: ['groq', 'gemini'] as const,
} as const;

export type EnvironmentConfig = typeof env;
