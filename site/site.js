const header=document.querySelector('#site-header');
if(header){
 const active=document.body.dataset.page;
 header.innerHTML=`<header class="site-header"><a class="site-brand" href="./index.html"><span class="site-mark">↯</span><span>重卡接入与电网协同评估<small>面向上海电力的研究能力演示</small></span></a><nav class="site-nav" aria-label="全站导航">${[['home','决策总览','index.html'],['quality','电网影响与治理','quality.html'],['planning','接入与建设','planning.html'],['delivery','试点与交付','delivery.html']].map(([id,label,url])=>`<a href="./${url}" ${id===active?'aria-current="page"':''}>${label}</a>`).join('')}</nav><span class="site-badge">研究示范</span></header>`;
}
let previewScroll=0;
function closePrintPreview(){document.body.classList.remove('report-preview','printing-report');document.querySelector('#print-toolbar')?.remove();window.scrollTo(0,previewScroll);}
document.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>{
 previewScroll=window.scrollY;document.body.classList.add('report-preview','printing-report');
 const toolbar=document.createElement('div');toolbar.id='print-toolbar';toolbar.innerHTML='<span>业务结论单 · 打印预览</span><div><button id="print-system" class="primary">系统打印 / 保存 PDF</button><button id="print-close">返回分析</button></div>';
 document.body.prepend(toolbar);toolbar.querySelector('#print-close').addEventListener('click',closePrintPreview);toolbar.querySelector('#print-system').addEventListener('click',()=>window.print());window.scrollTo(0,0);
}));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('report-preview'))closePrintPreview();});
document.querySelectorAll('[data-copy-link]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);b.textContent='链接已复制';}catch{b.textContent='请复制地址栏链接';}}));
