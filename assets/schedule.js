(() => {
  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');

  const results = document.getElementById('schedule-results');
  const summary = document.getElementById('schedule-summary');
  const divisionFilter = document.getElementById('schedule-division');
  const dateFilter = document.getElementById('schedule-date');
  const fieldFilter = document.getElementById('schedule-field');
  const teamFilter = document.getElementById('schedule-team');

  let games = [];

  const escapeHtml = value => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const addOptions = (select, items, labels = {}) => {
    [...new Set(items.filter(Boolean))]
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      )
      .forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = labels[value] || value;
        select.appendChild(option);
      });
  };

  const render = () => {
    const filtered = games.filter(game =>
  (!divisionFilter.value ||
    game.division === divisionFilter.value) &&

  (!teamFilter.value ||
    game.away === teamFilter.value ||
    game.home === teamFilter.value) &&

  (!dateFilter.value ||
    game.date === dateFilter.value) &&

  (!fieldFilter.value ||
    game.field === fieldFilter.value)
);

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

    const grouped = filtered.reduce((acc, game) => {
      const key = game.date;

      if (!acc[key]) {
        acc[key] = {
          label: game.dateLabel,
          games: []
        };
      }

      acc[key].games.push(game);
      return acc;
    }, {});

    results.innerHTML = Object.values(grouped)
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
                    ${escapeHtml(game.away)}
                  </div>

                  <div class="schedule-vs">vs</div>

                  <div class="schedule-team">
                    ${escapeHtml(game.home)}
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      `)
      .join('');
  };

  [divisionFilter, teamFilter, dateFilter, fieldFilter].forEach(element => {
    element.addEventListener('change', render);
  });

  const showScheduleError = () => {
    summary.textContent = 'Schedule unavailable';

    results.innerHTML = `
      <div class="schedule-empty">
        <h2>Schedule could not be loaded</h2>
        <p>Please refresh the page or check back shortly.</p>
      </div>
    `;
  };

  if (!endpoint) {
    showScheduleError();
    return;
  }

  const callbackName =
    `loadChillFestSchedule_${Date.now()}`;

  const scheduleScript =
    document.createElement('script');

  const cleanupScheduleRequest = () => {
    clearTimeout(timeout);

    if (scheduleScript.parentNode) {
      scheduleScript.remove();
    }

    try {
      delete window[callbackName];
    } catch (error) {
      window[callbackName] = undefined;
    }
  };

  const timeout = setTimeout(() => {
    cleanupScheduleRequest();
    showScheduleError();
  }, 12000);

  window[callbackName] = data => {
    if (!data || !data.ok || !Array.isArray(data.games)) {
      cleanupScheduleRequest();
      showScheduleError();
      return;
    }

    games = data.games;

const teams = games.flatMap(game => [
  game.away,
  game.home
]);

const dateLabels = Object.fromEntries(
  games.map(game => [
    game.date,
    game.dateLabel
  ])
);

addOptions(
  teamFilter,
  teams
);

addOptions(
  divisionFilter,
  games.map(game => game.division)
);

addOptions(
  dateFilter,
  games.map(game => game.date),
  dateLabels
);

addOptions(
  fieldFilter,
  games.map(game => game.field)
);

    render();
    cleanupScheduleRequest();
  };

  scheduleScript.onerror = () => {
    cleanupScheduleRequest();
    showScheduleError();
  };

  scheduleScript.src =
    `${endpoint}?action=schedule` +
    `&callback=${encodeURIComponent(callbackName)}` +
    `&_=${Date.now()}`;

  document.head.appendChild(scheduleScript);
})();
