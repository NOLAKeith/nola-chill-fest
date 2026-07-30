(() => {
  'use strict';

  // ------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------

  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');
  const showSchedule = CONFIG.showSchedule === true;

  // ------------------------------------------------------------
  // Page elements
  // ------------------------------------------------------------

  const controls = document.getElementById('schedule-controls');
  const results = document.getElementById('schedule-results');
  const summary = document.getElementById('schedule-summary');

  const divisionFilter = document.getElementById('schedule-division');
  const teamFilter = document.getElementById('schedule-team');
  const dateFilter = document.getElementById('schedule-date');
  const fieldFilter = document.getElementById('schedule-field');

  const requiredElements = [
    results,
    summary,
    divisionFilter,
    teamFilter,
    dateFilter,
    fieldFilter
  ];

  if (requiredElements.some(element => !element)) {
    console.error('NOLA Chill Fest schedule: required page elements are missing.');
    return;
  }

  let games = [];
  const CACHE_KEY = 'nolaChillFestScheduleV1';
  const CACHE_MAX_AGE = 5 * 60 * 1000;

  // ------------------------------------------------------------
  // General helpers
  // ------------------------------------------------------------

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const showControls = () => {
    if (controls) {
      controls.style.display = '';
    }
  };

  const hideControls = () => {
    if (controls) {
      controls.style.display = 'none';
    }
  };

  const addOptions = (select, items, labels = {}) => {
    const uniqueItems = [...new Set(items.filter(Boolean))]
      .sort((a, b) =>
        String(a).localeCompare(String(b), undefined, { numeric: true })
      );

    uniqueItems.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labels[value] || value;
      select.appendChild(option);
    });
  };

  const readCachedSchedule = () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.games) || !cached.savedAt) return null;
      return cached;
    } catch (error) {
      return null;
    }
  };

  const writeCachedSchedule = scheduleGames => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        games: scheduleGames
      }));
    } catch (error) {
      // Storage can be unavailable in private browsing; the live request still works.
    }
  };

  const populateFilters = () => {
    divisionFilter.innerHTML = '<option value="">All divisions</option>';
    teamFilter.innerHTML = '<option value="">All teams</option>';
    dateFilter.innerHTML = '<option value="">All dates</option>';
    fieldFilter.innerHTML = '<option value="">All fields</option>';

    const dateLabels = Object.fromEntries(
      games.map(game => [game.date, game.dateLabel])
    );

    addOptions(divisionFilter, games.map(game => game.division));
    addOptions(dateFilter, games.map(game => game.date), dateLabels);
    addOptions(fieldFilter, games.map(game => game.field));
    updateTeamOptions();
  };

  const displaySchedule = scheduleGames => {
    games = scheduleGames;

    if (!games.length) {
      showComingSoon();
      return;
    }

    populateFilters();
    showControls();
    render();
  };

  // ------------------------------------------------------------
  // Page states
  // ------------------------------------------------------------

  const showComingSoon = () => {
    hideControls();
    summary.textContent = '';

    results.innerHTML = `
      <div class="schedule-empty schedule-coming-soon">
        <div class="schedule-empty-icon"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg></div>
        <h2>Schedule Coming Soon</h2>
        <p>
          The official 2026 schedule will appear here after registration closes
          and divisions are finalized.
        </p>
        <a class="btn" href="register.html">Register Your Team</a>
      </div>
    `;
  };

  const showScheduleError = () => {
    hideControls();
    summary.textContent = 'Schedule unavailable';

    results.innerHTML = `
      <div class="schedule-empty">
        <h2>Schedule could not be loaded</h2>
        <p>Please refresh the page or check back shortly.</p>
      </div>
    `;
  };

  // ------------------------------------------------------------
  // Filters
  // ------------------------------------------------------------

  const updateTeamOptions = () => {
    const selectedDivision = divisionFilter.value;

    const relevantGames = selectedDivision
      ? games.filter(game => game.division === selectedDivision)
      : games;

    const teamOptions = relevantGames.flatMap(game => [
      {
        value: `${game.division}||${game.away}`,
        division: game.division,
        name: game.away
      },
      {
        value: `${game.division}||${game.home}`,
        division: game.division,
        name: game.home
      }
    ]);

    const uniqueTeams = [
      ...new Map(
        teamOptions
          .filter(team => team.name)
          .map(team => [team.value, team])
      ).values()
    ].sort((a, b) => {
      const divisionSort = String(a.division).localeCompare(
        String(b.division),
        undefined,
        { numeric: true }
      );

      return divisionSort || String(a.name).localeCompare(
        String(b.name),
        undefined,
        { numeric: true }
      );
    });

    teamFilter.innerHTML = '<option value="">All teams</option>';

    uniqueTeams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.value;
      option.textContent = selectedDivision
        ? team.name
        : `${team.division} — ${team.name}`;

      teamFilter.appendChild(option);
    });

    teamFilter.value = '';
  };

  const getFilteredGames = () => {
    return games.filter(game =>
      (
        !divisionFilter.value ||
        game.division === divisionFilter.value
      ) &&
      (
        !teamFilter.value ||
        `${game.division}||${game.away}` === teamFilter.value ||
        `${game.division}||${game.home}` === teamFilter.value
      ) &&
      (
        !dateFilter.value ||
        game.date === dateFilter.value
      ) &&
      (
        !fieldFilter.value ||
        game.field === fieldFilter.value
      )
    );
  };

  const scoreClass = (game, side) => {
    if (game.status !== 'Final') return '';

    const awayScore = Number(game.awayScore);
    const homeScore = Number(game.homeScore);
    if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore) || awayScore === homeScore) {
      return 'schedule-score';
    }

    const isWinner = side === 'away' ? awayScore > homeScore : homeScore > awayScore;
    return `schedule-score ${isWinner ? 'schedule-score-winner' : 'schedule-score-loser'}`;
  };

  // ------------------------------------------------------------
  // Schedule rendering
  // ------------------------------------------------------------

  const render = () => {
    const filtered = getFilteredGames();

    summary.textContent =
      `${filtered.length} ${filtered.length === 1 ? 'game' : 'games'} shown`;

    if (!filtered.length) {
      results.innerHTML = `
        <div class="schedule-empty">
          <h2>No games found</h2>
          <p>Try changing one of the filters.</p>
        </div>
      `;
      return;
    }

    const groupedByDate = filtered.reduce((groups, game) => {
      const key = game.date;

      if (!groups[key]) {
        groups[key] = {
          label: game.dateLabel,
          games: []
        };
      }

      groups[key].games.push(game);
      return groups;
    }, {});

    results.innerHTML = Object.values(groupedByDate)
      .map(day => `
        <section class="schedule-day">
          <h2>${escapeHtml(day.label)}</h2>

          <div class="schedule-games">
            ${day.games.map(game => `
              <article class="schedule-game">
                <div class="schedule-game-top">
                  <div class="schedule-kicker">
                    ${escapeHtml(game.division)} ·
                    ${escapeHtml(game.round)}
                  </div>

                  <div class="schedule-meta">
                    ${escapeHtml(game.time)} ·
                    ${escapeHtml(game.field)}
                  </div>
                </div>

                <div class="schedule-matchup">
                  <div class="schedule-team">
                    ${escapeHtml(game.away)}${game.status === 'Final' ? ` <strong class="${scoreClass(game, 'away')}">${escapeHtml(game.awayScore)}</strong>` : ''}
                  </div>

                  <div class="schedule-vs">${game.status === 'Final' ? 'Final' : 'vs'}</div>

                  <div class="schedule-team">
                    ${game.status === 'Final' ? `<strong class="${scoreClass(game, 'home')}">${escapeHtml(game.homeScore)}</strong> ` : ''}${escapeHtml(game.home)}
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      `)
      .join('');
  };

  divisionFilter.addEventListener('change', () => {
    updateTeamOptions();
    render();
  });

  [teamFilter, dateFilter, fieldFilter].forEach(filter => {
    filter.addEventListener('change', render);
  });

  // ------------------------------------------------------------
  // Feature flag
  // ------------------------------------------------------------

  if (!showSchedule) {
    showComingSoon();
    return;
  }

  if (!endpoint) {
    showScheduleError();
    return;
  }

  const cachedSchedule = readCachedSchedule();
  if (cachedSchedule && cachedSchedule.games.length) {
    displaySchedule(cachedSchedule.games);
  }

  // ------------------------------------------------------------
  // JSONP schedule request
  // ------------------------------------------------------------

  const callbackName = `loadChillFestSchedule_${Date.now()}`;
  const scheduleScript = document.createElement('script');

  let timeoutId;

  const cleanupScheduleRequest = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (scheduleScript.parentNode) {
      scheduleScript.remove();
    }

    try {
      delete window[callbackName];
    } catch (error) {
      window[callbackName] = undefined;
    }
  };

  timeoutId = setTimeout(() => {
    cleanupScheduleRequest();
    if (!cachedSchedule) showScheduleError();
  }, 12000);

  window[callbackName] = data => {
    if (!data || !data.ok || !Array.isArray(data.games)) {
      cleanupScheduleRequest();
      showScheduleError();
      return;
    }

    writeCachedSchedule(data.games);
    displaySchedule(data.games);
    cleanupScheduleRequest();
  };

  scheduleScript.onerror = () => {
    cleanupScheduleRequest();
    if (!cachedSchedule) showScheduleError();
  };

  scheduleScript.src =
    `${endpoint}?action=schedule` +
    `&callback=${encodeURIComponent(callbackName)}` +
    `&v=${Math.floor(Date.now() / 60000)}`;

  document.head.appendChild(scheduleScript);
})();
