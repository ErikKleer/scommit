import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { env } from '../config/env.js';
import { CommitAnalysisSchema, type CommitAnalysis } from './schema.js';

const systemInstruction = `You analyze a git diff and return only a JSON object.
Generate a standard Conventional Commit message in commitMessage using <type>(<scope>): <subject> (the scope is optional).
Provide a clear PR summary with context, keyChanges, and sideEffects.
Set riskScore from 1 to 5 and explain it in riskReason. Base riskReason strictly on code complexity, potential breaking changes, or database updates.
Use empty arrays when there are no key changes or side effects.`;

const responseSchema: ResponseSchema = {
	type: SchemaType.OBJECT,
	properties: {
		commitMessage: { type: SchemaType.STRING },
		prSummary: {
			type: SchemaType.OBJECT,
			properties: {
				context: { type: SchemaType.STRING },
				keyChanges: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
				sideEffects: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
			},
			required: ['context', 'keyChanges', 'sideEffects'],
		},
		riskScore: { type: SchemaType.INTEGER },
		riskReason: { type: SchemaType.STRING },
	},
	required: ['commitMessage', 'prSummary', 'riskScore', 'riskReason'],
};

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(error: unknown): boolean {
	if (typeof error === 'object' && error !== null) {
		const candidate = error as { status?: unknown; statusCode?: unknown; message?: unknown };
		return candidate.status === 429 || candidate.statusCode === 429;
	}
	return /(?:429|rate limit|quota)/i.test(String(error));
}

function parseAnalysis(payload: string): CommitAnalysis {
	try {
		return CommitAnalysisSchema.parse(JSON.parse(payload));
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error('Gemini returned invalid JSON payload');
		}
		throw new Error(`Gemini returned an invalid commit analysis: ${errorMessage(error)}`);
	}
}

async function generateWithGemini(diff: string): Promise<CommitAnalysis> {
	if (!env.geminiApiKey) {
		throw new Error('GEMINI_API_KEY is not configured');
	}

	try {
		const client = new GoogleGenerativeAI(env.geminiApiKey);
		const model = client.getGenerativeModel({
			model: 'gemini-3.6-flash',
			systemInstruction,
			generationConfig: {
				temperature: 0,
				responseMimeType: 'application/json',
				responseSchema,
			},
		});
		const result = await model.generateContent(`Analyze this git diff:\n\n${diff}`);
		return parseAnalysis(result.response.text());
	} catch (error) {
		if (isRateLimitError(error)) {
			throw new Error('Gemini quota or rate limit exceeded (429)');
		}
		if (error instanceof Error && (error.message.includes('invalid commit analysis') || error.message.includes('invalid JSON'))) {
			throw error;
		}
		throw new Error(`Gemini request failed: ${errorMessage(error)}`);
	}
}

export async function generateCommitAnalysis(diff: string): Promise<CommitAnalysis> {
	return generateWithGemini(diff);
}
