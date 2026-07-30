(() => {
  'use strict';

  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');
  const select = document.querySelector('.filters .select');
  const tbody = document.querySelector('.table-wrap tbody');
  const CACHE_KEY = 'nolaChillFestScheduleV1';

  if (!select || !tbody || !endpoint) return;

  let standingsByDivision = {};

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const readCachedSchedule = () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return cached && Array.isArray(cached.games) ? cached.games : null;
    } catch (error) {
      return null;
    }
  };

  const writeCachedSchedule = games => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), games }));
    } catch (error) {
      // The live request still works if storage is unavailable.
    }
  };

  const calculate = games => {
    const tables = {};

    games
      .filter(game => game.status === 'Final' && String(game.round || '').toLowerCase().includes('pool'))
      .forEach(game => {
        const division = game.division || 'Other';
        if (!tables[division]) tables[division] = {};

        const getTeam = name => {
          if (!tables[division][name]) {
            tables[division][name] = {
              team: name,
              wins: 0,
              losses: 0,
              ties: 0,
              rf: 0,
              ra: 0
            };
          }
          return tables[division][name];
        };

        const awayScore = Number(game.awayScore);
        const homeScore = Number(game.homeScore);
        if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return;

        const away = getTeam(game.away);
        const home = getTeam(game.home);

        away.rf += awayScore;
        away.ra += homeScore;
        home.rf += homeScore;
        home.ra += awayScore;

        if (awayScore > homeScore) {
          away.wins += 1;
          home.losses += 1;
        } else if (homeScore > awayScore) {
          home.wins += 1;
          away.losses += 1;
        } else {
          away.ties += 1;
          home.ties += 1;
        }
      });

    return Object.fromEntries(Object.entries(tables).map(([division, teams]) => [
      division,
      Object.values(teams)
        .map(team => {
          const gamesPlayed = team.wins + team.losses + team.ties;
          return {
            ...team,
            pct: gamesPlayed ? (team.wins + (team.ties * 0.5)) / gamesPlayed : 0
          };
        })
        .sort((a, b) =>
          b.pct - a.pct ||
          b.wins - a.wins ||
          (b.rf - b.ra) - (a.rf - a.ra) ||
          a.ra - b.ra ||
          a.team.localeCompare(b.team)
        )
    ]));
  };

  const render = () => {
    const division = select.value;
    const rows = standingsByDivision[division] || [];

    if (!division || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:52px;color:#9bb0c4">Standings will populate after official tournament results are entered.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((team, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(team.team)}</td>
        <td>${team.wins}</td>
        <td>${team.losses}</td>
        <td>${team.ties}</td>
        <td>${team.pct.toFixed(3).replace(/^0/, '')}</td>
        <td>${team.rf}</td>
        <td>${team.ra}</td>
        <td>${team.rf - team.ra}</td>
      </tr>
    `).join('');
  };

  const displayStandings = games => {
    standingsByDivision = calculate(games);
    const currentDivision = select.value;

    select.innerHTML = '<option value="">Select division</option>';
    Object.keys(standingsByDivision)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach(division => {
        const option = document.createElement('option');
        option.value = division;
        option.textContent = division;
        select.appendChild(option);
      });

    if (currentDivision && standingsByDivision[currentDivision]) {
      select.value = currentDivision;
    } else if (select.options.length > 1) {
      select.selectedIndex = 1;
    }

    render();
  };

  select.addEventListener('change', render);

  const cachedGames = readCachedSchedule();
  if (cachedGames) displayStandings(cachedGames);

  const callbackName = `loadChillFestStandings_${Date.now()}`;
  const script = document.createElement('script');
  const timeoutId = setTimeout(() => {
    script.remove();
    delete window[callbackName];
  }, 12000);

  window[callbackName] = data => {
    clearTimeout(timeoutId);
    script.remove();
    delete window[callbackName];

    if (!data || !data.ok || !Array.isArray(data.games)) return;

    writeCachedSchedule(data.games);
    displayStandings(data.games);
  };

  script.onerror = () => {
    clearTimeout(timeoutId);
    script.remove();
    delete window[callbackName];
  };

  script.src = `${endpoint}?action=schedule&callback=${encodeURIComponent(callbackName)}&v=${Math.floor(Date.now() / 60000)}`;
  document.head.appendChild(script);
})();
