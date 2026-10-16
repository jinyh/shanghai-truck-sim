import './site.js';
import {CityMap} from './city-map.js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols={green:'●',yellow:'▲',red:'■',gray:'◆'};
const stateNames={pass:'满足',fail:'不满足',conditional:'条件待闭环',unknown:'待核实'};
const fmt=x=>typeof x==='number'?x.toLocaleString('zh-CN',{maximumFractionDigits:5}):String(x??'未登记');
const badge=d=>`<span class="badge ${esc(d.color)}">${symbols[d.color]} ${esc(d.label)}</span>`;
let catalog,record,caseId,proposalId,stationId,local=false,camera,availableLocal=false,view;
let params=new URLSearchParams(location.search);
const safeLink=s=>typeof s==='string'&&(/^(quality-data\/|candidate-assumptions\.json$|quality\.html\?)/).test(s)?s:null;
async function read(url){const r=await fetch(url);if(!r.ok)throw Error(`无法载入记录（${r.status}），请检查评估版本或本地服务。`);return r.json();}
function download(name,value){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function saveLink(){if(!record)return;const p=new URLSearchParams({dataset:local?'local':'public',v:catalog.version||'local',case:caseId,proposal:proposalId,station:stationId,assessment:record.assessment_id});if(camera)p.set('map',camera.map(x=>x.toFixed(6)).join(','));history.replaceState(null,'','?'+p);}
function inCase(){return catalog.records.filter(r=>(r.case_id||'local')===caseId);}
function versions(sid=stationId,pid=proposalId){return inCase().filter(r=>r.station.id===sid&&r.proposal.id===pid).sort((a,b)=>b.evaluated_at.localeCompare(a.evaluated_at));}
function choose(sid,pid=proposalId,id=null){stationId=sid;proposalId=pid;const choices=versions();record=id?choices.find(r=>r.assessment_id===id):choices[0];if(!record)throw Error('指定评估版本不存在，未自动替换为其他结论。');render();}
function options(){const cases=catalog.cases||{local:'本地候选台账'};$('#case-select').innerHTML=Object.entries(cases).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');$('#case-select').value=caseId;const proposals=new Map(inCase().map(r=>[r.proposal.id,r.proposal.name]));$('#proposal-select').innerHTML=[...proposals].map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');$('#proposal-select').value=proposalId;}
function renderList(){
 const search=$('#station-search').value.trim().toLowerCase();
 const ids=[...new Set(inCase().filter(r=>r.proposal.id===proposalId).map(r=>r.station.id))];
 const shown=ids.map(id=>id===stationId?record:versions(id)[0]).filter(r=>[r.station.id,r.station.name,r.station.district,r.station.location].some(s=>String(s||'').toLowerCase().includes(search)));
 $('#station-count').textContent=`${shown.length} 座 / ${shown.filter(r=>!r.station.coordinates).length} 座待定位`;
 $('#candidate-list').innerHTML=shown.map(r=>`<button class="station-card ${r.station.id===stationId?'selected':''}" data-station="${esc(r.station.id)}"><b>${esc(r.station.id+' · '+r.station.name)}</b>${badge(r.decision)}<small>${esc(r.proposal.name)} · ${r.proposal.scale_kw==null?'规模待核实':fmt(r.proposal.scale_kw)+' kW'}</small><span class="reason">${esc(r.decision.primary_reason)}</span><small>必需项有据 ${r.decision.evidenced_count}/${r.decision.required_count} · ${esc(r.evaluated_at.slice(0,10))}${r.station.coordinates?'':' · 未定位'}</small></button>`).join('')||'<p>没有匹配站点。</p>';
 $('#candidate-list').querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>choose(b.dataset.station));
 view?.setStations(shown.map(r=>({...r.station,decision:r.decision})),stationId);
 $('#map-note').textContent=local?'全市公开地理背景；未登记坐标的真实候选站仅保留在列表。':'全市底图为地理背景；虚线内为计算覆盖区。站位与工程参数为合成示范。';
}
function evidenceHTML(e){const link=safeLink(e.source);return `<div class="evidence-card"><b>${esc(e.object||e.evidence_kind||'依据记录')}</b>${e.attribution?` <span class="badge gray">${esc(e.attribution)}</span>`:''}${e.actual!=null?`<div class="evidence-values"><div><span>接入后 / 当前值</span><b>${esc(fmt(e.actual))} ${esc(e.unit)}</b></div>${e.baseline!=null?`<div><span>同点同时刻 · 接入前</span><b>${esc(fmt(e.baseline))}</b></div><div><span>配对增量 ${e.unit==='%'?'（百分点）':''}</span><b>${e.delta>0?'+':''}${esc(fmt(e.delta))}</b></div>`:''}<div><span>登记界限 / 余量</span><b>${esc(fmt(e.limit))} / ${esc(fmt(e.margin))}</b></div></div>`:''}<dl><dt>判据与口径</dt><dd>${esc(e.criterion)}</dd><dt>时段 / 指标</dt><dd>${esc(e.time||'登记记录')} · ${esc(e.metric||'登记专项')}</dd><dt>共同约束关联</dt><dd>${esc(e.related_stations?.join('、')||'见所列对象；未外推其他站点')}</dd><dt>来源位置</dt><dd>${link?`<a href="./${esc(link)}">${esc(e.source)} ↓</a>`:esc(e.source)}<br>${esc(e.locator)}</dd><dt>计算 / 资料版本</dt><dd>${esc(e.version)}</dd><dt>证据性质</dt><dd>${esc(e.evidence_kind||'本地登记证据')} · ${esc(e.state)}</dd></dl>${safeLink(e.link)?`<a class="button" href="./${esc(e.link)}">定位到对应曲线 ↗</a>`:''}</div>`;}
function detailsHTML(r,print=false){const d=r.decision,checks=d.checks;return `<section class="evidence-section"><h3>01 / 为什么是这个颜色</h3><p>${badge(d)} ${esc(d.primary_reason)}</p>${checks.map(c=>`<div class="check-row"><b>${esc(c.name)}</b><span>${stateNames[c.effective_status]}</span><p>${esc(c.reason)}${c.pending.length?`<small>待核：${esc(c.pending.join('；'))}</small>`:''}</p></div>`).join('')}</section>
<section class="evidence-section"><h3>02 / 证据在哪里</h3><p>接入前后数值按同节点、同时刻配对；设备总负载包含背景，不把原有越限归责于新站。</p>${checks.map(c=>`<${print?'section':'details'} class="evidence-check" ${!print&&d.reasons.includes(c.id)?'open':''}><${print?'h4':'summary'}>${esc(c.name)} · ${c.evidence?.length||0} 条依据</${print?'h4':'summary'}>${c.evidence?.length?c.evidence.map(evidenceHTML).join(''):'<p>尚无可追溯依据。补证后重新计算结论。</p>'}</${print?'section':'details'}>`).join('')}</section>
<section class="evidence-section"><h3>03 / 怎样改变结论</h3>${d.conditions.length?`<ul>${d.conditions.map(c=>`<li><b>${esc(c.text)}</b> · ${c.evidence_valid?'已验证路径，待闭环':'已知条件，相关证据仍待核实'}<br>验证：${esc(c.verification)}<br>需补：${esc(c.closure_evidence)}<br>协同：${esc(c.owner)}</li>`).join('')}</ul>`:'<p>当前没有登记为“已验证且待闭环”的前置条件。</p>'}${d.pending.length?`<p>需补证专项：${esc(checks.filter(c=>d.pending.includes(c.id)).map(c=>c.name).join('、'))}。补齐资料或计算后生成新的评估记录。</p>`:''}${d.blockers.length?'<p>已证明不满足的原方案仍保留红色。改变容量、供电点、运行方式或建设时序后，新增方案重新评估；未验证措施列为待论证。</p>':''}<ul>${(r.next_steps||['由场站方提供运输与设备资料，供电方核实供电映射和同期负荷，建设与运行方补充实施及保障依据；业务角色待双方确认。']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
<section class="evidence-section"><h3>04 / 适用边界是什么</h3><dl class="scope-dl"><dt>阶段 / 范围</dt><dd>${esc(r.stage)} · ${esc(r.scope)}</dd><dt>本次规模</dt><dd>${r.proposal.scale_kw==null?'待核实':fmt(r.proposal.scale_kw)+' kW'}；绿色不代表已预留容量</dd><dt>接入组合</dt><dd>${esc(JSON.stringify(r.context.combination??'待核实'))}</dd><dt>背景 / 运行方式</dt><dd>${esc(r.context.background||'待核实')} / ${esc(r.context.control||'待核实')}</dd><dt>评估时间 / 时窗</dt><dd>${esc(r.evaluated_at)}<br>${esc(r.period?.join(' 至 ')||'待登记')}</dd><dt>规则 / 评估编号</dt><dd>${esc(d.rule_version)} / ${esc(r.assessment_id)}</dd><dt>未覆盖专项</dt><dd>${esc(r.not_evaluated?.join('、')||'见必需缺项')}</dd></dl><p>规模、接入组合、背景负荷、供电方式、控制条件或规则改变后须重评；仍有效的独立阻断证据继续保留。供电关系不按地理距离推定。</p>${r.source_register?`<details><summary>原始台账字段与公式（不参与判色）</summary><pre>${esc(JSON.stringify(r.source_register,null,2))}</pre></details>`:''}</section>`;}
function render(){
 options();const r=record,d=r.decision;
 $('#candidate-scene-link').hidden=local;$('#candidate-scene-link').href='./scene.html?'+new URLSearchParams({case:caseId,plan:proposalId,station:stationId,assessment:r.assessment_id,level:'station'});
 $('#dataset-note').textContent=local?'本地真实候选台账 · 资料尚待核实 · 不进入公开构建':'公开合成示例 · 电气数值来自既有计算，外线与手续另作合成登记 · 绿色仅限本阶段';
 $('#selected-summary').innerHTML=`${badge(d)}<h2>${esc(r.station.id+' · '+r.station.name)} / ${esc(r.proposal.name)}</h2><p>${esc(d.primary_reason)}</p><div class="progress-row"><span>必需项有据 ${d.evidenced_count}/${d.required_count}</span><span>阻断 ${d.blockers.length} 项</span><span>待核 ${d.pending.length} 项</span><span>已知待闭环条件 ${d.conditions.length} 项</span><span>评估于 ${esc(r.evaluated_at.slice(0,10))}</span></div>`;
 $('#candidate-detail').innerHTML=detailsHTML(r);
 $('#candidate-report').innerHTML=`<h2>接入预筛查 · 业务结论单</h2><p>${esc(r.station.name)} / ${esc(r.proposal.name)}</p><p>${local?'本地登记证据，真实性及适用性须复核':'公开合成工程与手续示范'}</p>${detailsHTML(r,true)}`;
 $('#assessment-select').innerHTML=versions().map(x=>`<option value="${x.assessment_id}">${esc(x.evaluated_at)} · ${x.assessment_id.slice(0,8)} · ${esc(x.decision.label)}</option>`).join('');$('#assessment-select').value=r.assessment_id;
 const proposals=[...new Set(inCase().filter(x=>x.station.id===stationId).map(x=>x.proposal.id))];
 $('#proposal-comparison').innerHTML=proposals.map(id=>{const x=id===proposalId?r:versions(stationId,id)[0];return `<button class="proposal-card" data-proposal="${esc(id)}" aria-pressed="${id===proposalId}"><b>${esc(x.proposal.name)}</b>${badge(x.decision)}<small>${esc(x.decision.primary_reason)}</small></button>`;}).join('');
 $('#proposal-comparison').querySelectorAll('[data-proposal]').forEach(b=>b.onclick=()=>choose(stationId,b.dataset.proposal));renderList();saveLink();
}
async function load(useLocal=false){
 local=useLocal;
 if(local){if(!availableLocal)throw Error('本地台账仅由本机工作台提供；公开站点不含真实资料。');catalog=await read('/api/candidates');if(!catalog.records.length)throw Error('本地台账为空，请先导入基础清单。');}
 else{const index=await read('./candidates-index.json');const v=params.get('v');const file=v&&v!=='local'&&/^[a-f0-9]{16}$/.test(v)?`candidates-${v}.json`:index.current;catalog=await read('./'+file);}
 caseId=params.get('case')||(local?'local':catalog.default_case);proposalId=params.get('proposal')||(local?catalog.records[0].proposal.id:catalog.default_proposal);stationId=params.get('station')||catalog.records[0].station.id;
 choose(stationId,proposalId,params.get('assessment'));$('#candidate-status').textContent='';
}
function error(e){$('#candidate-status').className='candidate-error';$('#candidate-status').textContent=e.message;}
$('#station-search').oninput=renderList;
$('#case-select').onchange=()=>{caseId=$('#case-select').value;choose(stationId,proposalId);};
$('#proposal-select').onchange=()=>{const pid=$('#proposal-select').value;const sid=inCase().some(r=>r.station.id===stationId&&r.proposal.id===pid)?stationId:inCase().find(r=>r.proposal.id===pid).station.id;choose(sid,pid);};
$('#assessment-select').onchange=()=>choose(stationId,proposalId,$('#assessment-select').value);
$('#export-record').onclick=()=>record&&download(`candidate-${record.station.id}-${record.assessment_id}.json`,record);
$('#input-template').onclick=()=>{if(!record)return;const r=structuredClone(record);delete r.decision;delete r.assessment_id;r.public=false;r.evaluated_at=new Date().toISOString();download(`candidate-input-${r.station.id}.json`,r);};
$('#local-switch').onclick=()=>{params=new URLSearchParams();load(true).catch(error);};
$('#public-switch').onclick=()=>{params=new URLSearchParams();load(false).catch(error);};
$('#local-export').onclick=async()=>{try{download('local-candidates-all-versions.json',await read('/api/candidates'));}catch(e){error(e);}};
$('#local-import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const res=await fetch('/api/candidates/import',{method:'POST',body:await f.arrayBuffer()});const result=await res.json();if(!res.ok)throw Error(result.error);params=new URLSearchParams();await load(true);$('#candidate-status').textContent=`已保存 ${result.count} 条评估，历史版本保留。`;}catch(err){error(err);}finally{e.target.value='';}};
try{if(['127.0.0.1','localhost'].includes(location.hostname)){try{const health=await read('/api/health');availableLocal=health.candidates===true;}catch{}}$('#local-panel').hidden=!availableLocal;await load(params.get('dataset')==='local');try{view=await CityMap.create($('#candidate-map'),{onPick:id=>choose(id),onView:box=>{camera=box;saveLink();},onEnter:()=>$('#selected-summary').scrollIntoView({behavior:'smooth'})});const initialCamera=params.get('map')?.split(',').map(Number);if(initialCamera)view.restore(initialCamera);renderList();}catch(e){$('#map-note').textContent='地图暂不可用：'+e.message+'。站点列表、依据与导出仍可使用。';}}catch(e){error(e);}
