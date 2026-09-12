import { Command, InvalidArgumentError } from 'commander';
import { checkGitRepo } from '../git/actions.js';
import { getStagedDiff } from '../git/diff.js';
import { generateCommitAnalysis } from '../llm/client.js';
import type { LlmProvider } from '../types/index.js';
import { promptUserAction, renderAnalysisPreview } from './ui.js';

function parseMaxChars(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new InvalidArgumentError('max-chars must be a positive integer');
	}
	return parsed;
}

export interface CommandOptions {
	dryRun?: boolean;
	provider?: LlmProvider;
	maxChars?: number;
}

export async function run(options: CommandOptions): Promise<void> {
	if (!(await checkGitRepo())) {
		throw new Error('This command must be run inside a git repository.');
	}

	const diff = await getStagedDiff(options.maxChars);
	const analysis = await generateCommitAnalysis(diff, options.provider);
	renderAnalysisPreview(analysis);

	if (!options.dryRun) {
		await promptUserAction(analysis);
	}
}

export function createProgram(): Command {
	return new Command()
		.name('scommit')
		.description('Generate a conventional commit, PR summary, and risk analysis')
		.option('--dry-run', 'show the analysis without prompting for an action')
		.option('--provider <groq|gemini>', 'LLM provider to use', (value: string): LlmProvider => {
			if (value !== 'groq' && value !== 'gemini') {
				throw new InvalidArgumentError('provider must be groq or gemini');
			}
			return value;
		})
		.option('--max-chars <number>', 'maximum number of diff characters to analyze', parseMaxChars)
		.action(run);
}
