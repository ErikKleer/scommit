const fileTruncationIndicator = '\n[... Diff truncated for this file: token limit reached ...]\n';
const codeExtensions = new Set(['ts', 'js', 'py', 'rs', 'go', 'json']);
const secondaryExtensions = new Set(['md', 'yaml', 'yml', 'css']);
const fileBodyLimit = 4000;

interface Hunk {
	header: string;
	lines: string[];
}

interface DiffFile {
	index: number;
	metadata: string[];
	hunks: Hunk[];
	path: string;
	priority: number;
}

function extensionOf(path: string): string {
	return path.split(/[./]/).pop()?.toLowerCase() ?? '';
}

function priorityOf(path: string): number {
	const extension = extensionOf(path);
	if (codeExtensions.has(extension)) {
		return 0;
	}
	if (secondaryExtensions.has(extension)) {
		return 2;
	}
	return 1;
}

function parseFiles(diff: string): { prefix: string[]; files: DiffFile[] } {
	const lines = diff.match(/.*(?:\r?\n|$)/g)?.filter((line) => line.length > 0) ?? [];
	const prefix: string[] = [];
	const files: DiffFile[] = [];
	let current: DiffFile | undefined;
	let currentHunk: Hunk | undefined;

	for (const line of lines) {
		if (line.startsWith('diff --git ')) {
			const path = line.match(/ b\/(.+?)(?:\r?\n)?$/)?.[1] ?? line;
			current = { index: files.length, metadata: [line], hunks: [], path, priority: priorityOf(path) };
			files.push(current);
			currentHunk = undefined;
			continue;
		}

		if (!current) {
			prefix.push(line);
			continue;
		}

		if (line.startsWith('@@ ')) {
			currentHunk = { header: line, lines: [] };
			current.hunks.push(currentHunk);
			continue;
		}

		if (currentHunk) {
			currentHunk.lines.push(line);
		} else {
			current.metadata.push(line);
		}
	}

	return { prefix, files };
}

function renderFile(file: DiffFile, contentBudget = Number.POSITIVE_INFINITY): string {
	const contentLength = file.hunks.reduce(
		(total, hunk) => total + hunk.lines.reduce((length, line) => length + line.length, 0),
		0,
	);
	const shouldTruncate = contentLength > fileBodyLimit || contentLength > contentBudget;
	if (!shouldTruncate) {
		return [...file.metadata, ...file.hunks.flatMap((hunk) => [hunk.header, ...hunk.lines])].join('');
	}

	const output = [...file.metadata];
	let remaining = Math.min(fileBodyLimit, contentBudget);
	for (const hunk of file.hunks) {
		output.push(hunk.header);
		for (const line of hunk.lines) {
			if (line.length <= remaining) {
				output.push(line);
				remaining -= line.length;
			}
		}
	}
	return `${output.join('')}${fileTruncationIndicator}`;
}

function selectFiles(files: DiffFile[], maxChars: number): string[] {
	const selected = new Map<number, string>();
	let remaining = maxChars;

	for (const file of [...files].sort((left, right) => left.priority - right.priority || left.index - right.index)) {
		const full = renderFile(file);
		const rendered = full.length <= remaining ? full : renderFile(file, remaining);
		if (rendered.length <= remaining) {
			selected.set(file.index, rendered);
			remaining -= rendered.length;
		}
	}

	return files.filter((file) => selected.has(file.index)).map((file) => selected.get(file.index) as string);
}

function fitLines(lines: string[], maxChars: number): string {
	let result = '';
	for (const line of lines) {
		if (result.length + line.length > maxChars) {
			break;
		}
		result += line;
	}
	return result;
}

export function truncateDiff(diff: string, maxChars: number = 16000): string {
	if (maxChars <= 0 || !diff) {
		return '';
	}

	const { prefix, files } = parseFiles(diff);
	if (files.length === 0) {
		return fitLines(diff.match(/.*(?:\r?\n|$)/g)?.filter((line) => line.length > 0) ?? [], maxChars);
	}

	const prefixText = fitLines(prefix, maxChars);
	const fileBudget = Math.max(0, maxChars - prefixText.length);
	return `${prefixText}${selectFiles(files, fileBudget).join('')}`;
}
