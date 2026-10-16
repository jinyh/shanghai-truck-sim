if(new URLSearchParams(location.search).get('case_family')==='four')await import('./four-planning.js');
else await import('./quality.js');
