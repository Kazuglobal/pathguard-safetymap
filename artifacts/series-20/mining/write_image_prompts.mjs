// ep21-30_images.mjs から、Codex に渡すプロンプトと映像用の fx を images/prompts.json に書き出す。
// 使い方: node write_image_prompts.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IMAGES, ORIENT, composePrompt } from './ep21-30_images.mjs';

const out = fileURLToPath(new URL('../images/prompts.json', import.meta.url));
mkdirSync(fileURLToPath(new URL('../images/', import.meta.url)), { recursive: true });

const episodes = {};
for (const [ep, items] of Object.entries(IMAGES)) {
  episodes[ep] = {};
  for (const key of Object.keys(items)) {
    episodes[ep][key] = { orient: ORIENT[key], prompt: composePrompt(ep, key), fx: items[key].fx ?? null };
  }
}
writeFileSync(out, `${JSON.stringify({ note: 'mining/ep21-30_images.mjs から生成。手で直さない', episodes }, null, 2)}\n`, 'utf8');
console.log(`書き出し: ${out}（${Object.keys(episodes).length}本）`);
