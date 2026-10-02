import {mkdir,readFile,writeFile,copyFile,rm,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'dist');
// Only clean the fixed generated directory, never a caller-provided path or symlink.
const existing=await lstat(output).catch(error=>{if(error.code!=='ENOENT')throw error;});
if(existing?.isSymbolicLink())throw new Error('Refusing to build into a symlinked dist directory.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const files=[
  ...['main.js','world.js','physics.js','rules.js','course.js','traffic.js','scenery.js','crew.js','bots.js','gamepads.js','style.css'].map(name=>[`src/${name}`,`src/${name}`]),
  ['node_modules/three/build/three.module.js','vendor/three.module.js'],
  ['node_modules/three/build/three.core.js','vendor/three.core.js'],
  ['node_modules/three/LICENSE','vendor/three.LICENSE.txt'],
  ['node_modules/cannon-es/dist/cannon-es.js','vendor/cannon-es.js'],
  ['node_modules/cannon-es/LICENSE','vendor/cannon-es.LICENSE.txt'],
];
for(const [source,destination] of files){
  const target=resolve(output,destination);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,source),target);
}
const html=(await readFile(resolve(root,'index.html'),'utf8'))
  .replace('/node_modules/three/build/three.module.js','./vendor/three.module.js')
  .replace('/node_modules/cannon-es/dist/cannon-es.js','./vendor/cannon-es.js')
  .replaceAll('"/src/','"./src/').replace('href="/"','href="./"');
await writeFile(resolve(output,'index.html'),html);
await writeFile(resolve(output,'.nojekyll'),'');
console.log('Built dist/: standalone static game, with relative URLs for GitHub Pages.');
