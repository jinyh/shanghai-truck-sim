import './site.js?v=pilot-flow-1';
import {number as n,escape as e} from './assessment.js';
try{
 const response=await fetch('./showcase-summary.json');if(!response.ok)throw Error('案例摘要尚未生成');const summary=await response.json(),s=summary.quality,c=s.cases;
 const link=(label,plan)=>`<a href="./quality.html?season=summer&stress=normal&view=report&plan=${plan}">${label} ↗</a>`;
 document.querySelector('#home-findings').innerHTML=`<article class="finding-card"><div class="eyebrow">电压与谐波联合评价</div><h3>无功补偿改善电压，谐波指标上升</h3><p>同一夏季案例中，补偿方案最低基波电压从 ${n(c.ordered.voltage_min_pu,4)} 升至 ${n(c.capacitor.voltage_min_pu,4)} pu；全观测点最高电压谐波畸变率也随之上升。</p><div class="finding-values">${[['有序充电',c.ordered.thdu_pct],['加无功补偿',c.capacitor.thdu_pct],['加谐波滤波',c.filter.thdu_pct]].map(([label,v])=>`<div><span>${label}</span><b>${n(v,2)}%</b></div>`).join('')}</div><p class="study-note">2—25次 THDu · 各方案全时窗、全观测点最大值；不是同一节点的配对增量。</p>${link('查看措施与复核依据','capacitor')}</article>
 <article class="finding-card"><div class="eyebrow">运营目标与电网影响分别评估</div><h3>有序充电降低电能费，充电峰值上升</h3><p>代表周电能费由 ${n(c.unmanaged.energy_cost_cny,0)} 元降至 ${n(c.ordered.energy_cost_cny,0)} 元；全站充电总峰值由 ${n(c.unmanaged.charging_peak_kw,0)} kW 升至 ${n(c.ordered.charging_peak_kw,0)} kW。</p><div class="finding-values"><div><span>最高负载上级设备</span><b style="font-size:19px">${e(c.ordered.worst_asset.name)}</b></div><div><span>有功限额利用率</span><b>${n(c.ordered.worst_asset.loading_pct,1)}%</b></div><div><span>用户观测点</span><b>${n(c.ordered.user_nodes,0)} 个</b></div></div><p class="study-note">用户影响按模型观测点统计，不折算实际户数。运营商电费与电网建设效益分别评价。</p>${link('查看接入点与用户结果','ordered')}</article>
 <p class="evidence-link" style="grid-column:1/-1">来源：${e(s.case_id)} · ${e(s.start)} 至 ${e(s.end)} · 摘要与完整输入版本绑定。<a href="./${e(s.export)}">下载对应复算包 ↓</a></p>`;
 const cards=document.querySelectorAll('#home-findings article');if(cards.length===2)cards[0].before(cards[1]);
}catch(error){document.querySelector('#home-findings').innerHTML=`<p class="summary-error">${e(error.message)}。请进入分析工作台查看案例记录。</p>`;}

const annual=document.querySelector('#home-annual');
if(annual)try{
 const response=await fetch('./four-summary.json');if(!response.ok)throw Error('年度结果尚未登记');const d=await response.json(),base=d.rows.find(r=>r.engineering==='existing'),expanded=d.rows.find(r=>r.engineering==='station');
 const first=d.first_constraints.find(r=>r.metric==='transport');
 const href='./planning.html?'+new URLSearchParams({case_family:'four',v:d.version,year:base.year,growth:'medium',season:'summer',engineering:'station',stress:'normal',plan:'unmanaged'});
 annual.innerHTML=`<article class="finding-card" style="grid-column:1/-1"><div class="eyebrow">同一四站 · 2027—2030年度延伸</div><h3>${first?.year?`${first.year}年出现运输履约约束`:'年度运输履约状态：'+e(first?.status||'待评估')}</h3><p>中增长情景下，${base.year}年各站${base.vehicles_per_station}辆车；夏季代表周现状配置欠充 ${n(base.shortfall_kwh,2)} kWh，S1/S2站内扩容后四站合计欠充 ${n(expanded.shortfall_kwh,2)} kWh。设备容量、履约和用户指标分别形成建设依据。</p><p>车辆年增长13%、背景P/Q年增长3.5%为合成情景假设；年度结果与2026基准沿用同一组站点及路线。</p><a href="${href}">四站年度约束与候选工程 ↗</a><p class="study-note">版本 ${e(d.version)} · 数值来自对应代表周记录。</p></article>`;
}catch(error){annual.textContent=error.message;}
