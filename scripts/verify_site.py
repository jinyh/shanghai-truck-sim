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
    script=(SITE/'app.js').read_text();html=(SITE/'index.html').read_text()
    assert "fetch('/api/" not in script and 'id="import-file"' not in html
    assert 'window.truckStatic' in script and 'src="./static-api.js"' in html
    quality_cases=check_quality()
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


if __name__=='__main__':main()
