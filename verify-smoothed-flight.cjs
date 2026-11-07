'use strict';
const fs=require('node:fs'),Module=require('node:module');
const source=fs.readFileSync('verify-benchmarks.cjs','utf8')
  .replace("const fs=require('node:fs'),", "const {smoothControls}=require('./dist/controls.js');\nconst fs=require('node:fs'),")
  .replace('stepTrainer(f,pilot(f));','stepTrainer(f,smoothControls(f,{...pilot(f),response:.55}));');
const code=source.replace('response:.55}));','response:.55},1/120));');
const compiled=new Module(__filename,module);
compiled.filename=__filename;
compiled.paths=module.paths;
compiled._compile(code,__filename);

