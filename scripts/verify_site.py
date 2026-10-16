"""Dependency-free checks used both locally and by the Pages workflow."""
import gzip
import hashlib
import json
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
if not SITE.is_dir():SITE=ROOT/'output'/'pages-site'/'site'


def read(path):
    relative=path.removeprefix('./')
    p=SITE/relative
    assert p.resolve().is_relative_to(SITE.resolve())
    return json.loads(gzip.decompress(p.read_bytes()))


def main():
    catalog=json.loads((SITE/'data/index.json').read_text())
    manifest=json.loads((SITE/'manifest.json').read_text())
    assert catalog['counts']['scenarios']==375 and len(catalog['planning'])==15
    for relative,digest in manifest.items():
        assert hashlib.sha256((SITE/relative).read_bytes()).hexdigest()==digest,relative
        assert 'private' not in Path(relative).parts
    for key,entry in catalog['scenarios'].items():
        result=read(entry['result']);task=result['task'];m=result['metrics']
        assert task['metadata']['evidence']=='synthetic' and result['evidence_level']=='synthetic'
        assert 'original_import' not in task['metadata'] and not result['formal_connection_approval']
        assert entry['input_hash']==result['input_hash'] and m['period_hours']==72
        assert m['energy_balance_error_kwh']<1e-5 and not m['annualized']
        assert key==f"{task['metadata']['year']}-{task['metadata']['growth']}-{task['metadata']['plan']}-{task['metadata']['stress']}"
        for path in entry.get('flex',{}).values():
            value=read(path);assert m['feasible'] and value['status']=='calculated'
            for direction in value['directions'].values():
                assert direction.get('feasible') and abs(direction['pre_event_energy_change_kwh'])<1e-5
        if entry.get('ac'):assert read(entry['ac'])['ac']['steps_checked']==288
        with zipfile.ZipFile(SITE/entry['export'].removeprefix('./')) as z:
            assert 'task.json' in z.namelist() and 'source_manifest.json' in z.namelist()
    for entry in catalog['planning'].values():
        result=read(entry['result']);assert len(result['rows'])==20
        assert not result['annualized'] and result['suggested_plan'] is None
    research=read(catalog['research']['result']);assert research['model_calls']==0 and not research['rsi_benefit_proven']
    script=(SITE/'app.js').read_text();html=(SITE/'planning.html').read_text()
    assert 'data-local-only' in html and 'runtime.js' in script
    assert json.loads((SITE/'runtime-config.json').read_text())['mode']=='static'
    quality_cases=check_quality()
    check_showcase()
    check_scene()
    print(json.dumps({'passed':True,'files':len(manifest),'quality_weekly_cases':quality_cases,**catalog['counts']},ensure_ascii=False))


def check_quality():
    catalog=json.loads((SITE/'quality-data/index.json').read_text())
    assert set(catalog['records'])=={season+'-'+stress for season in ('summer','winter') for stress in ('normal','bunched','light','weak','background')}
    count=0
    for key,entry in catalog['records'].items():
        assert entry['days']==7
        for field,digest in [('result','sha256'),('export','export_sha256')]:
            assert hashlib.sha256((SITE/'quality-data'/entry[field]).read_bytes()).hexdigest()==entry[digest]
        shown=read('quality-data/'+entry['result']);assert not shown['formal_connection_approval'] and not shown['annualized']
        assert shown['fundamental_crosscheck']['passed']
        assert shown['source_sha256']==entry['source_sha256']
        assert shown['spatial']['source']['public'] and shown['spatial']['source']['license']=='ODbL 1.0'
        with zipfile.ZipFile(SITE/'quality-data'/entry['export']) as z:
            study=json.loads(z.read('study.json'));spatial=json.loads(z.read('spatial.json'))
            assert shown['spatial']=={k:spatial[k] for k in shown['spatial']}
            assert shown['events']==study['events'] and shown['impedance_sensitivity']==study['impedance_sensitivity']
            source_manifest=json.loads(z.read('source_manifest.json'))
            for filename,digest in source_manifest.items():assert hashlib.sha256(z.read(filename)).hexdigest()==digest
            assert set(shown['cases'])=={'baseline','unmanaged','ordered','capacitor','filter'}
            demands=[];backgrounds=[]
            for plan,display in shown['cases'].items():
                raw=json.loads(z.read(f'cases/{plan}/task.json'));raw['spatial']=spatial
                result=json.loads(z.read(f'cases/{plan}/result.json'))
                digest=hashlib.sha256(json.dumps(raw,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()).hexdigest()
                assert digest==display['input_hash']==result['input_hash']==entry['input_hashes'][plan]
                assert raw['metadata']['evidence']=='synthetic' and raw['metadata']['public'] and 'original_import' not in raw['metadata']
                assert raw['electrical']['public'] and raw['periods']==672
                assert len(display['timestamps'])==672 and display['assessment']['engineering_approved'] is False
                assert display['transport']==result['transport']
                for field,v in display['metrics'].items():assert v==result['metrics'][field]
                for field,v in display['power_quality'].items():assert v==result['power_quality'][field]
                q=result['power_quality'];assert q['status']=='completed' and not q['failures'] and not q['engineering_approved']
                assert all([row['step'] for row in rows]==list(range(672)) for rows in q['trace'].values())
                assert len(q['operating_states'])==672 and len(q['equipment'])==672
                assert q['current_allocation_status']=='not_evaluated'
                if plan=='baseline':assert display['transport']['status']=='not_applicable'
                else:demands.append(raw['sessions']);assert len(raw['transport']['trips'])==112
                backgrounds.append(raw['electrical']['loads'])
                count+=1
            assert all(d==demands[0] for d in demands) and all(b==backgrounds[0] for b in backgrounds)
    with zipfile.ZipFile(SITE/'downloads/local-workbench-source.zip') as z:
        names=z.namelist();assert 'shanghai-truck-sim/data/public/shanghai-study-area.json' in names
        assert not any('/private/' in n or '/source-backups/' in n or '材料清单' in n for n in names)
        assert 'dss-python==0.15.7' in z.read('shanghai-truck-sim/requirements-locked.txt').decode()
    assert 'quality.html' in (SITE/'index.html').read_text()
    return count


def check_showcase():
    summary=json.loads((SITE/'showcase-summary.json').read_text())['quality']
    catalog=json.loads((SITE/'quality-data/index.json').read_text())
    entry=catalog['records'][summary['case_id']]
    shown=read('quality-data/'+entry['result'])
    assert summary['record_sha256']==entry['sha256']
    for plan,s in summary['cases'].items():
        c=shown['cases'][plan];q=c['power_quality']
        assert s['input_hash']==c['input_hash']
        assert s['voltage_min_pu']==min(n['voltage_min_pu'] for n in q['nodes'])
        assert s['thdu_pct']==max(n['max_thdu_pct'] for n in q['nodes'])
        assert s['charging_peak_kw']==c['metrics']['charging_peak_kw']
        assert s['energy_cost_cny']==c['metrics']['operator_energy_cost_cny']
        assert s['user_nodes']==sum(n['kind'] in ('industrial','residential','commercial','mixed') for n in q['nodes'])
        a=max((a for a in c['metrics']['assets'] if a['type']!='station'),key=lambda a:a['max_loading_pct'])
        assert s['worst_asset']=={'id':a['id'],'name':a['name'],'loading_pct':a['max_loading_pct']}
    for name in ('index.html','planning.html','quality.html','delivery.html'):
        content=(SITE/name).read_text();assert 'site.css' in content and 'site-header' in content
    assert '/api/' not in (SITE/'delivery.html').read_text()
    assert 'data-print' in (SITE/'quality.html').read_text() and 'data-print' in (SITE/'planning.html').read_text()


def check_scene():
    pointer=json.loads((SITE/'scene-data/index.json').read_text())
    catalog=json.loads((SITE/'scene-data'/pointer['file']).read_text())
    assert len(catalog['records'])==10
    candidates=json.loads((SITE/f'candidates-{catalog["candidate_version"]}.json').read_text())
    assert candidates['public'] and len(candidates['records'])==32
    assert {r['decision']['color'] for r in candidates['records']}=={'green','yellow','red','gray'}
    quality=json.loads((SITE/'quality-data/index.json').read_text())
    for key,entry in catalog['records'].items():
        file=SITE/'scene-data'/entry['file'];assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256']
        shown=read('scene-data/'+entry['file']);case=shown['case_id'];plan=shown['plan']
        assert shown['public'] and shown['input_hash']==entry['input_hash']
        with zipfile.ZipFile(SITE/'quality-data'/quality['records'][case]['export']) as z:
            raw=json.loads(z.read(f'cases/{plan}/result.json'));task=json.loads(z.read(f'cases/{plan}/task.json'))
            base=json.loads(z.read('cases/baseline/result.json'))
        q=raw['power_quality']
        assert shown['trace']==q['trace'] and shown['nodes']==q['nodes'] and shown['operating_states']==q['operating_states']
        assert shown['station_power_kw']==raw['metrics']['station_power_kw'] and shown['timestamps']==raw['timestamps']
        assert shown['stations']==task['stations'] and shown['input_hash']==raw['input_hash']
        for v in shown['vehicles']:
            for t in v['trips']:
                assert t['power_kw']==raw['solution']['power_by_session'][t['session_id']]
                assert t['ledger']==next(x for x in raw['transport']['ledger'] if x['trip_id']==t['id'])
        for aid,e in shown['equipment'].items():assert e['loading_pct']==[next(a['loading_pct'] for a in row['assets'] if a['id']==aid) for row in q['equipment']]
        for r in candidates['records']:
            if r['case_id']!=case or r['proposal']['id']!=plan:continue
            assert r['source_input_hash']==raw['input_hash'] and r['public'] and 'source_register' not in r
            assert not r['decision']['capacity_reserved'] and not r['decision']['engineering_approved']
            for check in r['checks']:
                for e in check.get('evidence',[]):
                    if 'actual' not in e:continue
                    assert e['station_id']==r['station']['id'] and e['proposal_id']==plan
                    if check['id']=='capacity':
                        aid=e['object'].split('（')[0]
                        if '（有功限额）' in e['object']:expected=next(a['max_loading_pct'] for a in raw['metrics']['assets'] if a['id']==aid)
                        else:
                            expected=next(a['loading_pct'] for a in q['equipment'][e['step']]['assets'] if a['id']==aid)
                            before=next(a['loading_pct'] for a in base['power_quality']['equipment'][e['step']]['assets'] if a['id']==aid)
                            assert e['baseline']==before and abs(e['delta']-(expected-before))<1e-12
                        assert e['actual']==expected
                    elif check['id'] in ('voltage','harmonics'):
                        node=e['object'].split(' · ')[0];row=q['trace'][node][e['step']];metric=e['metric']
                        expected=row[metric] if metric in row else row['harmonic_voltage_pct'][int(metric.removesuffix('次谐波'))-2]
                        assert e['actual']==expected
    city_pointer=json.loads((SITE/'city-data/index.json').read_text())
    city=json.loads((SITE/'city-data'/city_pointer['file']).read_text())
    assert city['district_count']==16
    for layer in ('base','regional','context'):
        entry=city[layer];assert hashlib.sha256((SITE/'city-data'/entry['file']).read_bytes()).hexdigest()==entry['sha256']
    presentation_pointer=json.loads((SITE/'presentation/index.json').read_text())
    presentation=json.loads((SITE/'presentation'/presentation_pointer['file']).read_text())
    assert presentation['city_version']==city['version'] and presentation['version']!=catalog['version']
    for name,digest in presentation['sha256'].items():assert hashlib.sha256((SITE/'presentation'/name).read_bytes()).hexdigest()==digest
    for name in ('scene.html','candidates.html'):
        html=(SITE/name).read_text();assert 'site-header' in html and 'site.css' in html
    for name in ('s1-yard','electric-truck'):
        assert (SITE/f'assets/scene/{name}.glb').read_bytes()[:4]==b'glTF'
    with zipfile.ZipFile(SITE/'downloads/local-workbench-source.zip') as z:
        assert 'shanghai-truck-sim/assets/scene/s1-yard.blend' in z.namelist()
        assert not any('/private/' in p or p.endswith('.xlsx') for p in z.namelist())


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--site');args=parser.parse_args()
    if args.site:SITE=Path(args.site)
    main()
