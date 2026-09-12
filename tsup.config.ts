import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['bin/index.ts'],
	format: ['esm'],
	outDir: 'dist/bin',
	clean: true,
	external: [],
	noExternal: ['*'],
	skipNodeModulesBundle: false,
});
