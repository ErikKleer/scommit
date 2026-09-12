import { execa } from 'execa';

export async function executeCommit(commitMessage: string): Promise<void> {
	await execa('git', ['commit', '-m', commitMessage]);
}

export async function checkGitRepo(): Promise<boolean> {
	try {
		const result = await execa('git', ['rev-parse', '--is-inside-work-tree']);
		return result.stdout.trim() === 'true';
	} catch {
		return false;
	}
}
