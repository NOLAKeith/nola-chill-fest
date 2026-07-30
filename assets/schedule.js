(() => {
  'use strict';

  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');
  const showSchedule = CONFIG.showSchedule === true;

  const controls = document.getElementById('schedule-controls');
  const results = document.getElementById('schedule-results');
  const summary = document.getElementById('schedule-summary');
  const divisionFilter = document.getElementById('schedule-division');
  const teamFilter = document.getElementById('schedule-team');
  const dateFilter = document.getElementById('schedule-date');
  const fieldFilter = document.getElementById('schedule-field');

  if ([results, summary, divisionFilter, teamFilter, dateFilter, fieldFilter].some(el => !el)) return;

  let games = [];

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const hideControls = () => { if (controls) controls.style.display = 'none'; };
  const showControls = () => { if (controls) controls.style.display = ''; };

  const showComingSoon = () => {
    hideControls();
    summary.textContent = '';
    results.innerHTML = `<div class="schedule-empty schedule-coming-soon">
      <div class="schedule-empty-icon"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
      <h2>Schedule Coming Soon</h2><p>The official 2026 schedule will appear here after divisions are finalized.</p>
    </div>`;
  };

  const showError = () => {
    hideControls();
    summary.textContent = 'Schedule unavailable';
    results.innerHTML = '<div class="schedule-empty"><h2>Schedule could not be loaded</h2><p>Please refresh the page or check back shortly.</p></div>';
  };

  const resetSelect = (select, label) => { select.innerHTML = `<option value="">${label}</option>`; };
  const addOptions = (select, items, labels = {}) => {
    [...new Set(items.filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = labels[value] || value; select.appendChild(option);
    });
  };

  const updateTeamOptions = () => {
    const selectedDivision = divisionFilter.value;
    const relevant = selectedDivision ? games.filter(g => g.division === selectedDivision) : games;
    const teams = relevant.flatMap(g => [{value:`${g.division}||${g.away}`, division:g.division, name:g.away},{value:`${g.division}||${g.home}`, division:g.division, name:g.home}]);
    const unique = [...new Map(teams.filter(t=>t.name).map(t=>[t.value,t])).values()].sort((a,b)=>a.division.localeCompare(b.division,undefined,{numeric:true})||a.name.localeCompare(b.name));
    resetSelect(teamFilter, 'All teams');
    unique.forEach(team => { const option=document.createElement('option'); option.value=team.value; option.textContent=selectedDivision?team.name:`${team.division} — ${team.name}`; teamFilter.appendChild(option); });
  };

  const filteredGames = () => games.filter(game =>
    (!divisionFilter.value || game.division === divisionFilter.value) &&
    (!teamFilter.value || `${game.division}||${game.away}` === teamFilter.value || `${game.division}||${game.home}` === teamFilter.value) &&
    (!dateFilter.value || game.date === dateFilter.value) &&
    (!fieldFilter.value || game.field === fieldFilter.value)
  );

  const matchupHtml = game => {
    const isFinal = game.status === 'Final';
    const awayScore = isFinal && game.awayScore !== null ? escapeHtml(game.awayScore) : '';
    const homeScore = isFinal && game.homeScore !== null ? escapeHtml(game.homeScore) : '';
    return `<div class="schedule-matchup ${isFinal ? 'is-final' : ''}">
      <div class="schedule-team-row"><span class="schedule-team">${escapeHtml(game.away)}</span>${isFinal ? `<strong class="schedule-score">${awayScore}</strong>` : ''}</div>
      <div class="schedule-team-row"><span class="schedule-team">${escapeHtml(game.home)}</span>${isFinal ? `<strong class="schedule-score">${homeScore}</strong>` : ''}</div>
    </div>`;
  };

  const render = () => {
    const filtered = filteredGames();
    summary.textContent = `${filtered.length} ${filtered.length === 1 ? 'game' : 'games'} shown`;
    if (!filtered.length) { results.innerHTML='<div class="schedule-empty"><h2>No games found</h2><p>Try changing one of the filters.</p></div>'; return; }
    const grouped = filtered.reduce((all, game) => { (all[game.date] ||= {label:game.dateLabel,games:[]}).games.push(game); return all; }, {});
    results.innerHTML = Object.values(grouped).map(day => `<section class="schedule-day"><h2>${escapeHtml(day.label)}</h2><div class="schedule-games">${day.games.map(game => `<article class="schedule-game">
      <div class="schedule-game-top"><div class="schedule-kicker">${escapeHtml(game.division)} · ${escapeHtml(game.round)}</div><div class="schedule-meta">${escapeHtml(game.time)} · ${escapeHtml(game.field)}</div></div>
      ${matchupHtml(game)}
      <div class="schedule-status ${game.status === 'Final' ? 'final' : ''}">${escapeHtml(game.status)}</div>
    </article>`).join('')}</div></section>`).join('');
  };

  divisionFilter.addEventListener('change', () => { updateTeamOptions(); render(); });
  [teamFilter,dateFilter,fieldFilter].forEach(filter => filter.addEventListener('change', render));

  if (!showSchedule) { showComingSoon(); return; }
  if (!endpoint) { showError(); return; }

  const callbackName = `loadChillFestSchedule_${Date.now()}`;
  const script = document.createElement('script');
  let timeoutId = setTimeout(() => { cleanup(); showError(); }, 12000);
  const cleanup = () => { clearTimeout(timeoutId); script.remove(); try { delete window[callbackName]; } catch { window[callbackName]=undefined; } };

  window[callbackName] = data => {
    if (!data || !data.ok || !Array.isArray(data.games)) { cleanup(); showError(); return; }
    games = data.games;
    if (!games.length) { cleanup(); showComingSoon(); return; }
    const dateLabels = Object.fromEntries(games.map(g=>[g.date,g.dateLabel]));
    resetSelect(divisionFilter,'All divisions'); resetSelect(dateFilter,'All dates'); resetSelect(fieldFilter,'All fields');
    addOptions(divisionFilter,games.map(g=>g.division)); addOptions(dateFilter,games.map(g=>g.date),dateLabels); addOptions(fieldFilter,games.map(g=>g.field));
    updateTeamOptions(); showControls(); render(); cleanup();
  };
  script.onerror = () => { cleanup(); showError(); };
  script.src = `${endpoint}?action=schedule&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
  document.head.appendChild(script);
})();
