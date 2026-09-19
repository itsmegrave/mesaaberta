// Compiles messages/*.json into src/lib/paraglide without starting Vite.
// Used by `prepare` and `check`, because the output is gitignored.
import { compile } from '@inlang/paraglide-js';
import { paraglideOptions } from '../paraglide.config.ts';

await compile({ ...paraglideOptions, strategy: [...paraglideOptions.strategy], silent: true });
