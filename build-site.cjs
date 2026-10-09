const fs=require('node:fs'),path=require('node:path');
const {root,load,D}=require('./shared.cjs');
const files=['index.html','styles.css','data.js','scoring.js','validation.js','app.js','episode-updates.js','episode-sources.js','episode-ui.js','automation-status.js','.nojekyll'];
function build(destination=path.join(root,'_site')){
 const resolved=path.resolve(destination);if(resolved!==path.join(root,'_site'))throw Error('Build output must be the project _site directory.');
 D.validate(load());fs.mkdirSync(resolved,{recursive:true});
 for(const file of files)fs.copyFileSync(path.join(root,file),path.join(resolved,file));
 fs.cpSync(path.join(root,'images'),path.join(resolved,'images'),{recursive:true});
 return files;
}
if(require.main===module){build();console.log('Static Pages artifact prepared; automation dependencies are not included.');}
module.exports={build,files};
