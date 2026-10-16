const family=new URLSearchParams(location.search).get('case_family');
if(family==='four')await import('./four-planning.js');
else if(family===null||family==='six')await import('./scene.js');
else document.querySelector('main').textContent='未登记的案例族，未替换为其他案例。';
