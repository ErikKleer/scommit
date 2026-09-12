import { z } from 'zod';

export const CommitAnalysisSchema = z.object({
	commitMessage: z
		.string()
		.min(1)
		.regex(/^[a-z]+(?:\([^)]+\))?: .+$/, 'must be a Conventional Commit message'),
	prSummary: z.object({
		context: z.string().min(1),
		keyChanges: z.array(z.string().min(1)),
		sideEffects: z.array(z.string().min(1)),
	}),
	riskScore: z.number().int().min(1).max(5),
	riskReason: z.string().min(1),
});

export type CommitAnalysis = z.infer<typeof CommitAnalysisSchema>;
