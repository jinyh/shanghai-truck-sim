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
    print(json.dumps({'passed':True,'files':len(manifest),**catalog['counts']},ensure_ascii=False))


if __name__=='__main__':main()
