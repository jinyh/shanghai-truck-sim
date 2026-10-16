"""Versioned pre-screening decisions. Evidence is input; colour is always derived."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

RULE_VERSION = 'prescreen-1.0'
STAGE = '接入预筛查'
CHECKS = {
    'demand': '需求与车辆履约', 'capacity': '共享供电资源',
    'voltage': '用户与接入点电压', 'harmonics': '用户与接入点谐波',
    'external': '外线可实施性', 'controls': '必要运行保障',
}
CONTEXT_KEYS = ('scale', 'combination', 'background', 'network', 'control', 'rules')
DEPENDENCIES = {k: CONTEXT_KEYS for k in CHECKS}
DEPENDENCIES['external'] = ('scale', 'network', 'rules')
LABELS = {'red': '当前方案需调整', 'gray': '暂无法判断', 'yellow': '有条件推进', 'green': '本阶段可推进'}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()).hexdigest()


def evaluate(record, as_of=None):
    """Conservative precedence: valid blockers > gaps > verified conditions > pass.

    A check is an atomic conclusion with one or more corroborating references.
    Conflicting references invalidate that check, not independent checks.
    Changing context invalidates only evidence that depends on those facts.
    """
    if not isinstance(record, dict): raise ValueError('评估记录必须为JSON对象')
    r = deepcopy(record)
    r.pop('decision', None)
    r.pop('assessment_id', None)
    if r.get('stage') != STAGE:
        raise ValueError('仅支持接入预筛查阶段')
    for key in ('station', 'proposal', 'context', 'checks', 'evaluated_at'):
        if key not in r:
            raise ValueError(f'缺少 {key}')
    if any(not isinstance(r[k],dict) for k in ('station','proposal','context')) or not isinstance(r['checks'],list):
        raise ValueError('场站、方案、上下文须为对象，检查项须为列表')
    if not r['station'].get('id') or not r['proposal'].get('id'):
        raise ValueError('场站与方案必须有稳定编号')
    coordinates = r['station'].get('coordinates')
    if coordinates is not None and (not isinstance(coordinates, list) or len(coordinates) != 2 or
            not all(isinstance(x, (int, float)) and math.isfinite(x) for x in coordinates) or
            not -180 <= coordinates[0] <= 180 or not -90 <= coordinates[1] <= 90):
        raise ValueError('坐标须为有效WGS84经纬度；未核实坐标请留空')
    scale = r['proposal'].get('scale_kw')
    if scale is not None and (not isinstance(scale, (int, float)) or not math.isfinite(scale) or scale <= 0):
        raise ValueError('接入规模须为正数或待核实空值')
    context = r['context']
    when = as_of or r['evaluated_at']
    at = datetime.fromisoformat(when.replace('Z', '+00:00'))
    if at.tzinfo is None: raise ValueError('评估时间须包含时区')
    if as_of: r['evaluated_at'] = as_of
    required = dict(CHECKS)
    for extra in r.get('additional_required', []):
        if not extra.get('trigger') or not extra.get('id') or extra['id'] in required:
            raise ValueError('额外必需项须登记唯一编号和触发原因')
        required[extra['id']] = extra['name']
    if r['proposal'].get('requires_control'):
        required['control_failure'] = '控制失效必需工况'
    supplied = {}
    for c in r['checks']:
        if not isinstance(c,dict) or not c.get('id') or not isinstance(c.get('evidence',[]),list):raise ValueError('检查项格式不完整')
        if c['id'] in supplied:
            raise ValueError('检查项编号重复')
        supplied[c['id']] = c
    findings, blockers, gaps, conditions = [], [], [], []
    for key, label in required.items():
        c = supplied.get(key, {})
        status = c.get('status', 'unknown')
        if status not in ('pass', 'fail', 'conditional', 'unknown'):
            raise ValueError(f'非法检查状态：{status}')
        evidence = c.get('evidence', [])
        problems = []
        if context.get('rules') != RULE_VERSION:
            problems.append('规则版本已变化或未登记，需重评')
        if context.get('scale') != scale:
            problems.append('接入规模已变化，结果待更新')
        deps = DEPENDENCIES.get(key, CONTEXT_KEYS)
        if any(context.get(k) in (None, '', []) for k in deps):
            problems.append('适用背景或接入组合尚未登记')
        if not evidence:
            problems.append('缺少可追溯证据')
        conclusions = {e.get('conclusion') for e in evidence if e.get('conclusion')}
        if len(conclusions) > 1 or c.get('conflict'):
            problems.append('证据冲突待核实')
        for e in evidence:
            if not isinstance(e,dict) or not isinstance(e.get('binding',{}),dict):raise ValueError('证据及其绑定须为对象')
            if not all(e.get(k) for k in ('source', 'locator', 'version', 'criterion')):
                problems.append('证据来源、位置、版本或判据不完整')
            if e.get('state') != 'valid':
                problems.append({'solver_failed': '求解失败，不能据此判为不可行', 'conflict': '证据冲突待核实', 'stale': '结果待更新'}.get(e.get('state'), '证据待核实'))
            if any(e.get('binding', {}).get(k) != context.get(k) for k in deps):
                problems.append('适用条件已变化，结果待更新')
            if e.get('station_id') != r['station']['id'] or e.get('proposal_id') != r['proposal']['id']:
                problems.append('证据未绑定当前场站与方案')
            if e.get('valid_until') and datetime.fromisoformat(e['valid_until'].replace('Z', '+00:00')) < at:
                problems.append('证据有效期已过，结果待更新')
        cs = c.get('conditions', [])
        # Promises are missing evidence; only a verified path may yield yellow.
        if status == 'conditional' and (not cs or any(not x.get('verified') or not x.get('verification') or not x.get('closure_evidence') or not x.get('owner') for x in cs)):
            problems.append('解决路径或闭环要求尚未核实')
        if status == 'pass' and any(not x.get('closed') for x in cs):
            problems.append('检查结论与未闭环条件冲突')
        effective = 'unknown' if problems else status
        if effective == 'conditional' and all(x.get('closed') for x in cs):
            # Closure requires a separately referenced acceptance record.
            effective = 'pass' if all(x.get('closure_reference') for x in cs) else 'unknown'
            if effective == 'unknown': problems.append('条件声称已闭环，但缺少验收依据')
        item = {**c, 'id': key, 'name': label, 'effective_status': effective,
                'reason': c.get('reason', f'{label}待补证'), 'pending': list(dict.fromkeys(problems))}
        findings.append(item)
        if effective == 'fail': blockers.append(item)
        if effective == 'unknown': gaps.append(item)
        for condition in cs:
            if not condition.get('closed'):
                conditions.append({**condition, 'check_id': key, 'evidence_valid': not problems})
    colour = 'red' if blockers else 'gray' if gaps else 'yellow' if conditions else 'green'
    decisive = blockers or gaps or [x for x in findings if x['effective_status'] == 'conditional']
    r['assessment_id'] = digest(r)[:20]
    r['decision'] = {'color': colour, 'label': LABELS[colour], 'rule_version': RULE_VERSION,
                     'primary_reason': decisive[0]['reason'] if decisive else '本阶段必需项满足；按登记规模、组合和运行条件推进',
                     'reasons': [x['id'] for x in decisive], 'checks': findings,
                     'blockers': [x['id'] for x in blockers], 'pending': [x['id'] for x in gaps],
                     'conditions': conditions, 'required_count': len(required),
                     'evidenced_count': len(required)-len(gaps),
                     'passed_count': sum(x['effective_status'] == 'pass' for x in findings),
                     'capacity_reserved': False, 'engineering_approved': False}
    return r


def import_register(data):
    """Read the reference workbook without executing formulas or geocoding."""
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if sum(x.file_size for x in z.infolist()) > 40_000_000:
            raise ValueError('解压内容超过40MB')
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', ns):
                strings.append(''.join(t.text or '' for t in si.findall('.//s:t', ns)))
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        sheet = next((s for s in wb.findall('s:sheets/s:sheet', ns) if s.get('name') == '场站评分录入表'), None)
        if sheet is None: raise ValueError('缺少“场站评分录入表”')
        rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = next(x.get('Target') for x in rels if x.get('Id') == rid)
        path = target.lstrip('/') if target.startswith('/') else 'xl/'+target
        rows = ET.fromstring(z.read(path)).findall('s:sheetData/s:row', ns)
        records = []
        sha = hashlib.sha256(data).hexdigest()
        for row in rows:
            number = int(row.get('r'))
            if number < 3: continue
            cells = {}
            for c in row.findall('s:c', ns):
                col = re.sub(r'\d', '', c.get('r'))
                v = c.find('s:v', ns);value = v.text if v is not None else ''
                if c.get('t') == 's': value = strings[int(value)]
                elif c.get('t') == 'inlineStr': value = ''.join(x.text or '' for x in c.findall('.//s:t', ns))
                formula = c.find('s:f', ns)
                cells[col] = {'value': value, 'formula': formula.text if formula is not None else None}
            val = lambda c: cells.get(c, {}).get('value', '')
            if not val('B') or not val('C'): continue
            sid = f'C{len(records)+1:03d}'
            record = {'stage': STAGE, 'evaluated_at': datetime.now(timezone.utc).isoformat(),
                      'station': {'id': sid, 'name': val('A') or sid+' · 待核正式名称', 'district': val('B'), 'location': val('C'), 'coordinates': None},
                      'proposal': {'id': 'unconfirmed', 'name': '拟接入方案待登记', 'scale_kw': None},
                      'context': {'rules': RULE_VERSION, **{k: None for k in CONTEXT_KEYS if k != 'rules'}},
                      'checks': [], 'evidence_level': 'local_unverified', 'public': False,
                      'source_register': {'sha256': sha, 'sheet': '场站评分录入表', 'row': number, 'cells': cells,
                                          'note': '原表公式及缓存仅存档；车位数×单桩功率不作为接入规模或电压等级依据'},
                      'scope': '本地候选台账；供电映射、坐标及接入方案待核实',
                      'not_evaluated': ['短路', '保护', '转供', '可靠性', '现场验证']}
            records.append(evaluate(record))
    if not records: raise ValueError('未发现候选站记录')
    return records


def save_records(records, folder):
    """Append-only snapshots, including original facts. No overwrite of history."""
    folder = Path(folder); folder.mkdir(parents=True, exist_ok=True)
    result = [evaluate({**raw, 'public': False}) for raw in records]
    for r in result:
        target = folder/(r['assessment_id']+'.json')
        content = json.dumps(r, ensure_ascii=False, indent=2, allow_nan=False)+'\n'
        try:
            with target.open('x') as f: f.write(content)
        except FileExistsError:
            if target.read_text() != content: raise ValueError('同版本内容冲突')
    return result


def local_catalog(folder):
    records = [json.loads(p.read_text()) for p in sorted(Path(folder).glob('*.json'))]
    return {'schema_version': 'candidates-1.0', 'public': False, 'records': records,
            'rule_version': RULE_VERSION, 'stage': STAGE}
