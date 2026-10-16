// Identical page modules use explicit local/static capabilities.
const response=await fetch('./runtime-config.json');
if(!response.ok)throw Error('运行配置缺失，无法确定计算方式');
const config=await response.json();
export const isStatic=config.mode==='static';
if(!['static','local'].includes(config.mode))throw Error('运行模式无效');
if(isStatic)await import('./static-api.js');
export async function post(path,body){
 if(isStatic)return window.truckStatic.post(path,body);
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),v=await r.json();if(!r.ok)throw Error(v.error||'请求失败');return v;
}
export async function wait(job,label='正在计算'){
 if(isStatic)return window.truckStatic.wait(job);
 for(let i=0;i<7200;i++){const r=await fetch('/api/jobs/'+job.id),v=await r.json();if(v.status==='completed')return v.result;if(v.status==='failed')throw Error(v.error);await new Promise(resolve=>setTimeout(resolve,500));}throw Error('计算尚未返回，请检查本机任务');
}
export const exportURL=id=>isStatic?window.truckStatic.exportURL(id):'/api/export/'+id;
export function configurePage(){
 document.querySelectorAll('[data-static-text]').forEach(el=>{if(isStatic)el.textContent=el.dataset.staticText;});
 document.querySelectorAll('[data-local-only]').forEach(el=>el.hidden=isStatic);
 document.querySelectorAll('[data-static-only]').forEach(el=>el.hidden=!isStatic);
 document.querySelectorAll('[data-static-href]').forEach(el=>{if(isStatic)el.href=el.dataset.staticHref;});
}
configurePage();
