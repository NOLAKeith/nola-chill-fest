(() => {
  'use strict';

  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');
  const select = document.querySelector('.filters .select');
  const desktopBody = document.querySelector('.standings-desktop tbody');
  const mobileBody = document.querySelector('.standings-mobile tbody');
  const CACHE_KEY = 'nolaChillFestScheduleV1';

  if (!select || !desktopBody || !mobileBody || !endpoint) return;

  let standingsByDivision = {};

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const formatPct = value => Number(value || 0)
    .toFixed(3)
    .replace(/^0/, '');

  const formatDiff = value => {
    const number = Number(value || 0);
    return number > 0 ? `+${number}` : String(number);
  };

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
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), games })
      );
    } catch (error) {
      // Live loading still works if browser storage is unavailable.
    }
  };

  const calculate = games => {
    const tables = {};

    games
      .filter(game =>
        game.status === 'Final' &&
        String(game.round || '').toLowerCase().includes('pool')
      )
      .forEach(game => {
        const division = String(game.division || 'Other').trim();
        if (!tables[division]) tables[division] = {};

        const getTeam = name => {
          const teamName = String(name || '').trim();
          if (!tables[division][teamName]) {
            tables[division][teamName] = {
              team: teamName,
              wins: 0,
              losses: 0,
              ties: 0,
              rf: 0,
              ra: 0
            };
          }
          return tables[division][teamName];
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

    return Object.fromEntries(
      Object.entries(tables).map(([division, teams]) => [
        division,
        Object.values(teams)
          .map(team => {
            const gamesPlayed = team.wins + team.losses + team.ties;
            return {
              ...team,
              pct: gamesPlayed
                ? (team.wins + (team.ties * 0.5)) / gamesPlayed
                : 0
            };
          })
          .sort((a, b) =>
            b.pct - a.pct ||
            b.wins - a.wins ||
            (b.rf - b.ra) - (a.rf - a.ra) ||
            a.ra - b.ra ||
            a.team.localeCompare(b.team)
          )
      ])
    );
  };

  const renderEmpty = () => {
    const message =
      'Standings will populate after official tournament results are entered.';

    desktopBody.innerHTML = `
      <tr>
        <td colspan="9" class="standings-empty">${message}</td>
      </tr>
    `;

    mobileBody.innerHTML = `
      <tr>
        <td colspan="7" class="standings-empty">${message}</td>
      </tr>
    `;
  };

  const render = () => {
    const division = select.value;
    const rows = standingsByDivision[division] || [];

    if (!division || !rows.length) {
      renderEmpty();
      return;
    }

    desktopBody.innerHTML = rows.map((team, index) => {
      const diff = team.rf - team.ra;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(team.team)}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td>${team.ties}</td>
          <td>${formatPct(team.pct)}</td>
          <td>${team.rf}</td>
          <td>${team.ra}</td>
          <td>${formatDiff(diff)}</td>
        </tr>
      `;
    }).join('');

    mobileBody.innerHTML = rows.map((team, index) => {
      const diff = team.rf - team.ra;
      const record = `${team.wins}-${team.losses}-${team.ties}`;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(team.team)}</td>
          <td>${record}</td>
          <td>${formatPct(team.pct)}</td>
          <td>${team.ra}</td>
          <td>${formatDiff(diff)}</td>
          <td>${team.rf}</td>
        </tr>
      `;
    }).join('');
  };

  const displayStandings = games => {
    standingsByDivision = calculate(games);
    const currentDivision = select.value;
    const divisions = Object.keys(standingsByDivision)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    select.innerHTML = '<option value="">Select division</option>';

    divisions.forEach(division => {
      const option = document.createElement('option');
      option.value = division;
      option.textContent = division;
      select.appendChild(option);
    });

    if (currentDivision && standingsByDivision[currentDivision]) {
      select.value = currentDivision;
    } else if (divisions.length) {
      select.value = divisions[0];
    }

    render();
  };

  select.addEventListener('change', render);

  const cachedGames = readCachedSchedule();
  if (cachedGames) displayStandings(cachedGames);

  const callbackName = `loadChillFestStandings_${Date.now()}`;
  const script = document.createElement('script');

  const cleanup = () => {
    script.remove();
    delete window[callbackName];
  };

  const timeoutId = setTimeout(cleanup, 12000);

  window[callbackName] = data => {
    clearTimeout(timeoutId);
    cleanup();

    if (!data || !data.ok || !Array.isArray(data.games)) return;

    writeCachedSchedule(data.games);
    displayStandings(data.games);
  };

  script.onerror = () => {
    clearTimeout(timeoutId);
    cleanup();
  };

  script.src =
    `${endpoint}?action=schedule` +
    `&callback=${encodeURIComponent(callbackName)}` +
    `&v=${Math.floor(Date.now() / 60000)}`;

  document.head.appendChild(script);
})();
