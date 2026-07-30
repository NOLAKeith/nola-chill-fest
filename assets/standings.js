(() => {
  'use strict';
  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');
  const division = document.getElementById('standings-division');
  const body = document.getElementById('standings-body');
  const status = document.getElementById('standings-status');
  if (!division || !body || !status || !endpoint) return;

  let games = [];
  const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const calculate = selectedDivision => {
    const table = {};
    games.filter(g => g.status === 'Final' && g.round.toLowerCase().includes('pool') && (!selectedDivision || g.division === selectedDivision)).forEach(g => {
      if (g.awayScore === null || g.homeScore === null) return;
      [g.away,g.home].forEach(team => { table[`${g.division}||${team}`] ||= {division:g.division,team,w:0,l:0,t:0,rf:0,ra:0}; });
      const away=table[`${g.division}||${g.away}`], home=table[`${g.division}||${g.home}`];
      away.rf += g.awayScore; away.ra += g.homeScore; home.rf += g.homeScore; home.ra += g.awayScore;
      if (g.awayScore > g.homeScore) { away.w++; home.l++; } else if (g.homeScore > g.awayScore) { home.w++; away.l++; } else { away.t++; home.t++; }
    });
    return Object.values(table).sort((a,b) => {
      if (a.division !== b.division) return a.division.localeCompare(b.division,undefined,{numeric:true});
      const ap=(a.w+a.l+a.t)?(a.w+a.t*.5)/(a.w+a.l+a.t):0, bp=(b.w+b.l+b.t)?(b.w+b.t*.5)/(b.w+b.l+b.t):0;
      return bp-ap || (b.rf-b.ra)-(a.rf-a.ra) || a.ra-b.ra || a.team.localeCompare(b.team);
    });
  };

  const render = () => {
    const rows = calculate(division.value);
    if (!rows.length) { body.innerHTML='<tr><td colspan="8" class="standings-empty">No final pool-play results are available for this division yet.</td></tr>'; status.textContent='Standings update after games are marked Final.'; return; }
    let current=''; let seed=0;
    body.innerHTML = rows.map(row => {
      if (row.division !== current) { current=row.division; seed=0; }
      seed++;
      return `<tr><td>${seed}</td><td><strong>${escapeHtml(row.team)}</strong><span class="standings-division-label">${escapeHtml(row.division)}</span></td><td>${row.w}</td><td>${row.l}</td><td>${row.t}</td><td>${row.rf}</td><td>${row.ra}</td><td>${row.rf-row.ra}</td></tr>`;
    }).join('');
    status.textContent = `${rows.length} ${rows.length === 1 ? 'team' : 'teams'} shown`;
  };

  division.addEventListener('change', render);
  const callback=`loadChillFestStandings_${Date.now()}`; const script=document.createElement('script');
  const timeout=setTimeout(()=>{ status.textContent='Standings could not be loaded.'; },12000);
  window[callback]=data=>{ clearTimeout(timeout); script.remove(); try{delete window[callback]}catch{}; if(!data||!data.ok||!Array.isArray(data.games)){status.textContent='Standings could not be loaded.';return;} games=data.games; const divisions=[...new Set(games.map(g=>g.division).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); divisions.forEach(value=>{const o=document.createElement('option');o.value=value;o.textContent=value;division.appendChild(o);}); render(); };
  script.onerror=()=>{clearTimeout(timeout);status.textContent='Standings could not be loaded.';};
  script.src=`${endpoint}?action=schedule&callback=${encodeURIComponent(callback)}&_=${Date.now()}`; document.head.appendChild(script);
})();
