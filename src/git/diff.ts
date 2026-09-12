import { execa } from 'execa';
import { truncateDiff } from './sanitize.js';

export async function getStagedDiff(maxChars?: number): Promise<string> {
	const result = await execa('git', ['diff', '--cached', '--no-ext-diff']);
	const diff = truncateDiff(result.stdout, maxChars);

	if (!diff.trim()) {
		throw new Error('No staged changes found. Stage changes before running scommit.');
	}

	return diff;
}
