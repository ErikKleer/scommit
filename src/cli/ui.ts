import { cancel, isCancel, select } from '@clack/prompts';
import chalk from 'chalk';
import clipboard from 'clipboardy';
import { executeCommit } from '../git/actions.js';
import type { CommitAnalysis } from '../types/index.js';

function riskLabel(score: CommitAnalysis['riskScore']): string {
	if (score <= 2) return chalk.green('Low Risk');
	if (score === 3) return chalk.yellow('Moderate Risk');
	return chalk.red(score === 4 ? 'High Risk' : 'Critical Risk');
}

export function formatPrSummaryMarkdown(data: CommitAnalysis): string {
	const keyChanges = data.prSummary.keyChanges.map((change) => `- ${change}`).join('\n') || '- None';
	const sideEffects = data.prSummary.sideEffects.join('; ') || 'None';

	return [
		'## Context',
		data.prSummary.context,
		'',
		'## Changes',
		keyChanges,
		'',
		'## Side Effects & Risk Assessment',
		`- **Risk Level:** ${data.riskScore}/5 (${data.riskReason})`,
		`- **Breaking Changes / Alerts:** ${sideEffects}`,
	].join('\n');
}

function panel(content: string): string {
	const lines = content.split('\n');
	const width = Math.max(...lines.map((line) => line.length), 2);
	const border = `+${'-'.repeat(width + 2)}+`;
	return [border, ...lines.map((line) => `| ${line.padEnd(width)} |`), border].join('\n');
}

export function renderAnalysisPreview(data: CommitAnalysis): void {
	console.log();
	console.log(`${chalk.cyan('Commit Message')}  ${chalk.green(data.commitMessage)}`);
	console.log(`${chalk.cyan('Risk Score')}       ${data.riskScore}/5 ${riskLabel(data.riskScore)}`);
	console.log(`${chalk.dim(data.riskReason)}`);
	console.log();
	console.log(chalk.cyan('PR Summary'));
	console.log(panel(formatPrSummaryMarkdown(data)));
}

function copyToClipboard(text: string): boolean {
	try {
		clipboard.writeSync(text);
		return true;
	} catch (error) {
		console.log(chalk.yellow('Could not copy the PR summary to the clipboard. Markdown output:'));
		console.log(text);
		console.log(chalk.dim(error instanceof Error ? error.message : String(error)));
		return false;
	}
}

export async function promptUserAction(data: CommitAnalysis): Promise<void> {
	const choice = await select({
		message: 'What would you like to do?',
		options: [
			{ value: 'commit', label: 'Commit directly' },
			{ value: 'copy-and-commit', label: 'Copy PR Summary & Commit' },
			{ value: 'copy', label: 'Copy PR Summary only' },
			{ value: 'cancel', label: 'Cancel' },
		],
	});

	if (isCancel(choice) || choice === 'cancel') {
		cancel('Cancelled.');
		return;
	}

	if (choice === 'copy' || choice === 'copy-and-commit') {
		if (copyToClipboard(formatPrSummaryMarkdown(data))) {
			console.log(chalk.green('PR summary copied to the clipboard.'));
		}
	}

	if (choice === 'commit' || choice === 'copy-and-commit') {
		await executeCommit(data.commitMessage);
		console.log(chalk.green(`Committed: ${data.commitMessage}`));
	}
}
