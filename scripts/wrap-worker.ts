// Runs after `vite build`. The Cloudflare adapter writes SvelteKit's Worker to
// `.svelte-kit/cloudflare/_worker.js` and exports only `fetch`. This keeps that Worker as
// `_sveltekit.js` and puts a wrapper in its place that also exports `scheduled` (the Cron Trigger).
import { copyFileSync, readFileSync, renameSync } from 'node:fs';

const dir = '.svelte-kit/cloudflare';
const worker = `${dir}/_worker.js`;
const alreadyWrapped = readFileSync(worker, 'utf8').includes('Cron Trigger');

if (alreadyWrapped) {
	console.log('Worker already wrapped.');
} else {
	renameSync(worker, `${dir}/_sveltekit.js`);
	copyFileSync('scripts/worker-template.js', worker);
	console.log('Worker wrapped with the scheduled handler.');
}
