/* GitHub Pages adapter: serve registered, source-verified simulation records. */
(() => {
  const entries = new Map();
  const jobs = new Map();
  let indexPromise;
  let sequence = 0;
  const index = () => indexPromise ||= fetch('./data/index.json').then(r => {
    if (!r.ok) throw Error('示范目录读取失败，请刷新页面。');
    return r.json();
  });
  const key = o => `${o.year}-${o.growth}-${o.plan}-${o.stress}`;
  async function record(path) {
    const response = await fetch(path);
    if (!response.ok) throw Error('场景记录读取失败，请重试。');
    if (!('DecompressionStream' in window)) throw Error('请使用支持压缩数据读取的新版浏览器。');
    const value = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    return value;
  }
  function register(kind, result, entry) {
    const id = String(++sequence);
    jobs.set(id, {kind, result, entry});
    if (kind === 'run' || kind === 'ac') entries.set(result.job_id, entry);
    return {id, status: 'completed'};
  }
  async function post(path, args) {
    const catalog = await index();
    if (path === '/api/run') {
      const entry = catalog.scenarios[key(args)];
      if (!entry) throw Error('该组合不在登记的示范范围内。');
      return register('run', await record(entry.result), entry);
    }
    if (path === '/api/planning') {
      const entry = catalog.planning[`${args.growth}-${args.stress}`];
      if (!entry) throw Error('年度比较记录不存在。');
      return register('planning', await record(entry.result), entry);
    }
    if (path === '/api/research') return register('research', await record(catalog.research.result), catalog.research);
    const previous = jobs.get(args.job_id);
    if (!previous?.entry) throw Error('请先选择一个场景。');
    const entry = previous.entry;
    if (path === '/api/ac') {
      if (!entry.ac) throw Error('本组合尚未登记交流潮流记录；请下载本地版执行完整校核。');
      return register('ac', await record(entry.ac), entry);
    }
    if (path === '/api/flex') {
      const filename = entry.flex?.[args.feeder_id];
      if (!filename) throw Error('本组合没有可用的合格基准调节记录。');
      return register('flex', await record(filename), entry);
    }
    throw Error('在线示范仅浏览登记的计算记录；完整求解请使用本地版。');
  }
  async function wait(job) {
    const value = jobs.get(job.id);
    if (!value) throw Error('结果尚未载入。');
    return value.result;
  }
  function exportURL(id) {
    const job = jobs.get(id);
    return job?.kind === 'ac' ? job.entry.ac_export : job?.entry?.export;
  }
  function configure(result) {
    const entry = entries.get(result.job_id);
    const ac = document.querySelector('#ac-button');
    ac.disabled = !entry?.ac;
    ac.title = entry?.ac ? '查看该场景完整288时段的已计算记录' : '此场景请在本地版执行交流潮流';
    if (!entry?.ac && result.ac.status !== 'completed') {
      document.querySelector('#ac-content').textContent = '本组合未登记交流记录。2027年中增长正常工况的常规、有序和提前扩建方案可查看；其他组合请使用本地版校核。';
    }
  }
  window.truckStatic = {post, wait, exportURL, configure};
})();
