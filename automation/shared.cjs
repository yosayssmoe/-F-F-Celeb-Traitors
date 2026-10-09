const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},URL,Date});
for(const file of ['scoring.js','validation.js','episode-updates.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file,timeout:1000});
const T=context.window.TraitorsScoring,D=context.window.SweepstakeData,E=context.window.EpisodeUpdates;
const clone=x=>JSON.parse(JSON.stringify(x));
const stable=x=>JSON.stringify(sort(x));
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));return x;}
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:stable(x)).digest('hex');
function load(file=path.join(root,'data.js')){return clone(D.parse(fs.readFileSync(file,'utf8')));}
function serialize(data){D.validate(data);return '// Sweepstake data — automatically verified additions; manual controls remain available.\nwindow.SWEEPSTAKE = '+JSON.stringify(data,null,2)+';\n';}
function payload(e){const out=clone(e);delete out.automation;delete out.sources;delete out.id;return out;}
module.exports={root,T,D,E,clone,stable,hash,load,serialize,payload};
