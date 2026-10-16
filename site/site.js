import {chapters,reportTarget} from './report-route.js?v=pilot-flow-1';
const active=document.body.dataset.page;
const chapter=chapters.find(c=>c.id===active),chapterIndex=chapters.indexOf(chapter);
const header=document.querySelector('#site-header');
if(header)header.innerHTML=`<header class="site-header"><a class="site-brand" href="./index.html"><span class="site-mark">↯</span><span>重卡接入与电网协同评估<small>面向上海电力的联合试点研究</small></span></a><nav class="site-nav" aria-label="六个汇报环节">${chapters.map((c,i)=>`<a href="./${c.url}" aria-label="${c.title}" ${c.id===active?'aria-current="page"':''}><small>${i+1}</small> ${c.short}</a>`).join('')}</nav></header>`;
const main=document.querySelector('main');
if(main&&chapter){
 const route=document.createElement('section');route.className='report-route print-hide';route.setAttribute('aria-label','汇报衔接');
 route.innerHTML=`<div><span class="eyebrow">${String(chapterIndex+1).padStart(2,'0')} / 06 · ${chapter.minutes}</span><b>${chapter.message}</b><p data-route-note></p></div><a class="button primary" data-report-next></a>`;
 if(active==='scene')main.after(route);else main.append(route);
}
export function setReportContext(context={}){
 const target=reportTarget(active,context);
 document.querySelectorAll('[data-report-next]').forEach(a=>{a.textContent=target.label+' →';if(target.href)a.setAttribute('href',target.href);else a.removeAttribute('href');a.setAttribute('aria-disabled',String(!target.href));});
 document.querySelectorAll('[data-route-note]').forEach(e=>e.textContent=target.note);
}
setReportContext({unavailable:['scene','quality','candidates'].includes(active)});
let previewScroll=0;
function closePrintPreview(){document.body.classList.remove('report-preview','printing-report');document.querySelector('#print-toolbar')?.remove();window.scrollTo(0,previewScroll);}
document.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>{
 previewScroll=window.scrollY;document.body.classList.add('report-preview','printing-report');
 const toolbar=document.createElement('div');toolbar.id='print-toolbar';toolbar.innerHTML='<span>业务结论单 · 打印预览</span><div><button id="print-system" class="primary">系统打印 / 保存 PDF</button><button id="print-close">返回分析</button></div>';
 document.body.prepend(toolbar);toolbar.querySelector('#print-close').addEventListener('click',closePrintPreview);toolbar.querySelector('#print-system').addEventListener('click',()=>window.print());window.scrollTo(0,0);
}));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('report-preview'))closePrintPreview();});
document.querySelectorAll('[data-copy-link]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);b.textContent='链接已复制';}catch{b.textContent='请复制地址栏链接';}}));
