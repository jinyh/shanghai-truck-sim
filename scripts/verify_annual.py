"""Validate versioned annual display, evidence closure, decisions and timelines."""
import gzip
import hashlib
import json
import sys
import zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
try:
    from trucksim.candidates import evaluate
except ModuleNotFoundError as exc:
    if exc.name!='trucksim':raise
    from trucksim_candidates import evaluate

def verify(site):
    site=Path(site);pointer=json.loads((site/'four-data/index.json').read_text());folder=site/'four-data'/pointer['version']
    content=(folder/'index.json').read_bytes();assert hashlib.sha256(content).hexdigest()==pointer['sha256'];catalog=json.loads(content)
    assert len(catalog['records'])==172 and len(catalog['rows'])==860
    assert not catalog['annualized']
    decisions=0;colors={}
    for name,entry in catalog['records'].items():
        raw=(folder/entry['result']).read_bytes();assert hashlib.sha256(raw).hexdigest()==entry['sha256']
        value=json.loads(gzip.decompress(raw));assert value['evaluation_version']==catalog['version']
        archive=(folder/entry['export']).read_bytes();assert hashlib.sha256(archive).hexdigest()==entry['export_sha256']
        with zipfile.ZipFile(folder/entry['export']) as z:
            manifest=json.loads(z.read('study.json'));source=json.loads(z.read('source_manifest.json'))
            for path,sha in source.items():assert hashlib.sha256(z.read(path)).hexdigest()==sha
            assert manifest['id']==value['id']
            for plan,r in value['cases'].items():
                assert r['input_hash']==entry['input_hashes'][plan]==manifest['cases'][plan]['input_hash']
                task=json.loads(z.read(f'cases/{plan}/task.json'))
                assert task['periods']==672 and len(r['timestamps'])==672
                assert all(len(p)==672 for p in r['metrics']['station_power_kw'].values())
                assert len({v['id'] for v in task['transport']['vehicles']})==len(task['transport']['vehicles'])
                assert all(s['port'] is None or s['port']<next(x['ports'] for x in r['stations'] if x['id']==s['station_id']) for s in r['ports'])
                if value.get('trace_encoding')=='columnar-1':
                    for node,c in r['power_quality']['trace'].items():
                        if isinstance(c,dict):assert len(c['step'])==672
                if plan=='baseline':assert value['rows'][0]['states']['transport'] is None
        if value['planning']['stress']=='control_loss':
            for plan in ('ordered','capacitor','filter'):assert value['cases'][plan]['metrics']['station_power_kw']==value['cases']['unmanaged']['metrics']['station_power_kw']
        for r in value['records']:
            again=evaluate(r);assert again['decision']==r['decision'] and again['assessment_id']==r['assessment_id']
            assert r['source_input_hash']==value['cases'][r['proposal']['id']]['input_hash']
            for check in r['decision']['checks']:
                for e in check.get('evidence',[]):assert (site/e['source']).is_file()
            colors[r['decision']['color']]=colors.get(r['decision']['color'],0)+1;decisions+=1
    assert decisions==2752
    for r in catalog['schedules']:
        increments=sum(sum(y['new'].values()) for y in r['investment']);assert increments==sum(r['investment'][-1]['cumulative'].values())
        assert sum(bool(sum(y['new'].values())) for y in r['investment'])==1
        assert r['latest_start']<str(r['commission_year'])+'-01-02'
    print(json.dumps({'annual_comparisons':172,'annual_cases':860,'decisions':decisions,'colors':colors,'source_integrity':True,'annualized':False},ensure_ascii=False))
    return catalog

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--site',required=True);a=p.parse_args();verify(a.site)
