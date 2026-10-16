// Report navigation carries only the identity supported by the destination.
export const chapters=[
 {id:'home',title:'决策总览',short:'决策总览',url:'index.html',minutes:'2分钟',message:'支持接入预筛查、用户影响复核与建设方案比较。'},
 {id:'scene',title:'区域与场站',short:'区域与场站',url:'scene.html',minutes:'2分钟',message:'运输任务形成充电负荷，S1与S2共同占用F1及上级T1资源。'},
 {id:'quality',title:'电网影响与治理',short:'影响与治理',url:'quality.html',minutes:'4分钟',message:'同一需求与背景下，联合评价设备负载、用户电压和谐波。'},
 {id:'candidates',title:'接入方案分级',short:'方案分级',url:'candidates.html',minutes:'2分钟',message:'计算结果与运行保障证据共同形成接入推进条件。'},
 {id:'planning',title:'建设时序评估',short:'建设时序',url:'planning.html?view=planning',minutes:'2分钟',message:'独立案例B：六站72小时代表工况，评价需求增长与配套工程投产时序。'},
 {id:'delivery',title:'联合试点与交付',short:'联合试点',url:'delivery.html',minutes:'2分钟',message:'拟联合确定3—5座站、同期数据协同及阶段性验证任务。'}
];
export function reportTarget(page,context={}){
 const {caseId='summer-normal',plan='unmanaged',station='S1',node='ZLV1',step=40}=context;
 if(context.unavailable)return {href:null,label:'当前记录尚未就绪',note:'记录校验完成后继续同案例汇报。'};
 if(page==='home')return {href:'./scene.html?case=summer-normal&plan=unmanaged&station=S1&step=40&level=region',label:'进入区域与场站',note:'案例A · 夏季四站代表周 · S1、S2共享馈线'};
 if(page==='scene'){
  const [season,stress]=caseId.split('-');return {href:'./quality.html?'+new URLSearchParams({season,stress,plan,station,node,step,view:'electrical',scene:1}),label:'进入电网影响与治理',note:'延续当前案例、方案、场站与计算时刻。'};
 }
 if(page==='quality'){
  if(!['summer-normal','winter-background'].includes(caseId)||plan==='baseline')return {href:null,label:plan==='baseline'?'电气基线不参与接入分级':'该工况尚无接入分级记录',note:'当前分析结果保留；分级入口仅对应已登记的接入方案。'};
  return {href:'./candidates.html?'+new URLSearchParams({case:caseId,proposal:plan,station}),label:'进入接入方案分级',note:'延续当前背景与方案，核对推进条件和证据缺项。'};
 }
 if(page==='candidates')return {href:'./planning.html?view=planning&year=2027&growth=medium&stress=normal&plan=ordered',label:'切换至独立建设案例B',note:'四站代表周结论在此收束；下一环节为六站独立输入，采用2027—2030年代表工况。'};
 if(page==='planning')return {href:'./delivery.html',label:'进入联合试点与交付',note:'汇总站点预评估、治理条件与配套工程，形成试点任务。'};
 return {href:'./index.html',label:'返回决策总览',note:'拟协同事项：试点对象、数据范围、验证任务与验收口径。'};
}
