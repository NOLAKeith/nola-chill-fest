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
    const headToHead = {};

    const completedPoolGames = games.filter(game =>
      ['Final', 'Forfeit'].includes(String(game.status || '').trim()) &&
      String(game.round || '').toLowerCase().includes('pool')
    );

    completedPoolGames.forEach(game => {
      const division = String(game.division || 'Other').trim();
      if (!tables[division]) tables[division] = {};
      if (!headToHead[division]) headToHead[division] = {};

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

      const awayName = String(game.away || '').trim();
      const homeName = String(game.home || '').trim();
      if (!awayName || !homeName) return;

      const away = getTeam(awayName);
      const home = getTeam(homeName);

      away.rf += awayScore;
      away.ra += homeScore;
      home.rf += homeScore;
      home.ra += awayScore;

      const h2hKey = [awayName, homeName].sort().join('||');
      if (!headToHead[division][h2hKey]) {
        headToHead[division][h2hKey] = {};
      }
      const h2h = headToHead[division][h2hKey];
      h2h[awayName] = h2h[awayName] || { wins: 0, losses: 0, ties: 0 };
      h2h[homeName] = h2h[homeName] || { wins: 0, losses: 0, ties: 0 };

      if (awayScore > homeScore) {
        away.wins += 1;
        home.losses += 1;
        h2h[awayName].wins += 1;
        h2h[homeName].losses += 1;
      } else if (homeScore > awayScore) {
        home.wins += 1;
        away.losses += 1;
        h2h[homeName].wins += 1;
        h2h[awayName].losses += 1;
      } else {
        away.ties += 1;
        home.ties += 1;
        h2h[awayName].ties += 1;
        h2h[homeName].ties += 1;
      }
    });

    const manualOverrides = CONFIG.standingsOverrides || {};

    const compareHeadToHead = (division, a, b) => {
      const key = [a.team, b.team].sort().join('||');
      const record = headToHead[division]?.[key];
      if (!record || !record[a.team] || !record[b.team]) return 0;

      const aGames = record[a.team].wins + record[a.team].losses + record[a.team].ties;
      const bGames = record[b.team].wins + record[b.team].losses + record[b.team].ties;
      if (!aGames || !bGames) return 0;

      const aPct = (record[a.team].wins + record[a.team].ties * 0.5) / aGames;
      const bPct = (record[b.team].wins + record[b.team].ties * 0.5) / bGames;
      return bPct - aPct;
    };

    return Object.fromEntries(
      Object.entries(tables).map(([division, teams]) => {
        const overrides = Array.isArray(manualOverrides[division])
          ? manualOverrides[division].map(name => String(name || '').trim())
          : [];

        const rows = Object.values(teams).map(team => {
          const gamesPlayed = team.wins + team.losses + team.ties;
          return {
            ...team,
            pct: gamesPlayed
              ? (team.wins + (team.ties * 0.5)) / gamesPlayed
              : 0
          };
        });

        rows.sort((a, b) => {
          const aOverride = overrides.indexOf(a.team);
          const bOverride = overrides.indexOf(b.team);
          if (aOverride !== -1 || bOverride !== -1) {
            if (aOverride === -1) return 1;
            if (bOverride === -1) return -1;
            return aOverride - bOverride;
          }

          // Official order: Win/Loss, Head-to-Head, Runs Allowed, Runs Scored.
          const recordOrder =
            b.pct - a.pct ||
            b.wins - a.wins ||
            a.losses - b.losses ||
            b.ties - a.ties;
          if (recordOrder) return recordOrder;

          const h2hOrder = compareHeadToHead(division, a, b);
          if (h2hOrder) return h2hOrder;

          if (a.ra !== b.ra) return a.ra - b.ra;
          if (a.rf !== b.rf) return b.rf - a.rf;

          // Coin flip cannot be safely automated because it must remain stable.
          // Use CONFIG.standingsOverrides for any still-unresolved tie.
          return a.team.localeCompare(b.team);
        });

        return [division, rows];
      })
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
