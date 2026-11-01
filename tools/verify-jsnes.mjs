import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(fs.readFileSync(new URL('../cores/jsnes/manifest.json',import.meta.url),'utf8'));
for(const file of manifest.files){
 const bytes=fs.readFileSync(new URL('../node_modules/jsnes/'+file.path,import.meta.url));
 const hash=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 assert.equal(hash,file.gitBlobSha,`Unexpected JSNES source: ${file.path}`);
}
assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../node_modules/jsnes/package.json',import.meta.url))).dependencies??{},{});
console.log(`JSNES ${manifest.version}: ${manifest.files.length} pinned source/license files verified; no runtime dependencies.`);
