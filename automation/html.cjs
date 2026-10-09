const {parse}=require('parse5');
function children(node){return node.childNodes||[];}
function all(node,predicate,out=[]){if(predicate(node))out.push(node);for(const c of children(node))all(c,predicate,out);return out;}
function attr(node,key){return node?.attrs?.find(a=>a.name===key)?.value||'';}
function text(node){if(!node)return '';if(['script','style','sup'].includes(node.tagName))return '';if(node.nodeName==='#text')return node.value;return children(node).map(text).join(node.tagName==='br'?' ':'').replace(/\s+/g,' ').trim();}
function parentTable(node){for(let p=node.parentNode;p;p=p.parentNode)if(p.tagName==='table')return p;}
function grid(table){
 const rows=all(table,n=>n.tagName==='tr'&&parentTable(n)===table),g=[];let cellId=0;
 rows.forEach((row,r)=>{g[r]??=[];let col=0;
  for(const cell of children(row).filter(n=>['td','th'].includes(n.tagName))){
   while(g[r][col])col++;const rs=Number(attr(cell,'rowspan')||1),cs=Number(attr(cell,'colspan')||1);
   if(!Number.isInteger(rs)||!Number.isInteger(cs)||rs<1||cs<1||rs>100||cs>100)throw Error('Unsupported table span');
   const item={text:text(cell),node:cell,id:++cellId,row:r,col,rowspan:rs,colspan:cs};
   for(let y=0;y<rs;y++){g[r+y]??=[];for(let x=0;x<cs;x++){if(g[r+y][col+x])throw Error('Overlapping table cells');g[r+y][col+x]=item;}}col+=cs;
  }
 });return g;
}
function aliases(names){const map=new Map();for(const name of names){const p=name.split(' ');for(const a of [name,p[0],p[0]+' '+(p[1]?.[0]||'')+'.']){const k=a.toLowerCase();map.set(k,map.has(k)&&map.get(k)!==name?null:name);}}
 for(const [a,n] of [['James A.','James Acaster'],['James B.','James Blunt'],['Kenny','King Kenny'],['Leigh-Anne','Leigh-Anne Pinnock']])if(names.includes(n))map.set(a.toLowerCase(),n);
 return value=>map.get((value||'').trim().replace(/’/g,"'").toLowerCase())||null;
}
module.exports={parse,all,attr,text,grid,aliases};
