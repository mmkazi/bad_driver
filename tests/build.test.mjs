import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('static build is self-contained and resolves assets under a repository subpath',async()=>{
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url))});
  const root=new URL('../dist/',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
  assert.ok(!html.includes('node_modules'));assert.ok(!/(?:src|href)="\//.test(html));
  const imports=JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
  for(const ref of [...Object.values(imports),'./src/main.js','./src/style.css','./']){
    assert.ok(new URL(ref,'https://example.test/bad_driver/').pathname.startsWith('/bad_driver/'));
    assert.ok((await stat(new URL(ref,root))).isFile()||ref==='./');
  }
  for(const directory of ['src/','vendor/'])for(const name of await readdir(new URL(directory,root))){
    if(!name.endsWith('.js'))continue;
    const moduleURL=new URL(directory+name,root),source=await readFile(moduleURL,'utf8');
    const references=[...source.matchAll(/^[ \t]*(?:import|export)\s+[^;\n]*?\sfrom\s*['"]([^'"]+)['"]/gm),...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
    for(const match of references){
      const specifier=match[1];
      if(specifier.startsWith('.'))assert.ok((await stat(new URL(specifier,moduleURL))).isFile());
      else assert.ok(specifier in imports,`Unpackaged dependency: ${specifier}`);
    }
  }
  const entries=await readdir(root);assert.deepEqual(entries.sort(),['.nojekyll','index.html','src','vendor']);
  for(const name of ['three','cannon-es'])assert.ok((await readFile(new URL(`vendor/${name}.LICENSE.txt`,root),'utf8')).length>100);
});
