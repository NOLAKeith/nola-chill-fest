(() => {
  'use strict';

  const CONFIG = window.CHILL_FEST_CONFIG || {};
  const endpoint = String(CONFIG.registrationEndpoint || '');
  const select = document.getElementById('bracket-division');
  const shell = document.getElementById('bracket-shell');
  const bracket = document.getElementById('live-bracket');
  const loading = document.getElementById('bracket-loading');
  const empty = document.getElementById('bracket-empty');
  const updated = document.getElementById('bracket-updated');
  const printButton = document.getElementById('print-bracket');
  const printDivision = document.getElementById('bracket-print-division');
  const CACHE_KEY = 'nolaChillFestBracketsV1';

  if (!endpoint || !select || !bracket) return;

  let bracketsByDivision = {};

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const roundSort = (a, b) =>
    Number(a.roundOrder || 0) - Number(b.roundOrder || 0) ||
    String(a.round || '').localeCompare(String(b.round || ''));

  const gameSort = (a, b) =>
    Number(a.gameOrder || 0) - Number(b.gameOrder || 0) ||
    String(a.gameId || '').localeCompare(String(b.gameId || ''), undefined, { numeric: true });

  const statusClass = status => String(status || '').toLowerCase() === 'final' ? ' is-final' : '';

  const teamRow = (team, seed, score, winner, status) => {
    const hasScore = score !== null && score !== '' && Number.isFinite(Number(score));
    const isWinner = status === 'Final' && winner && team === winner;
    return `
      <div class="bracket-team${isWinner ? ' is-winner' : ''}">
        <span class="bracket-seed">${seed ? escapeHtml(seed) : ''}</span>
        <span class="bracket-team-name">${escapeHtml(team || 'TBD')}</span>
        <strong class="bracket-score">${hasScore ? escapeHtml(score) : ''}</strong>
      </div>
    `;
  };

  const gameCard = game => {
    const meta = [game.dateLabel, game.time, game.field].filter(Boolean).join(' · ');
    return `
      <article class="bracket-game${statusClass(game.status)}" data-game-id="${escapeHtml(game.gameId)}">
        <div class="bracket-game-label">
          <span>${escapeHtml(game.gameId)}</span>
          <span>${escapeHtml(game.status || '')}</span>
        </div>
        ${teamRow(game.awayTeam, game.awaySeed, game.awayScore, game.winner, game.status)}
        ${teamRow(game.homeTeam, game.homeSeed, game.homeScore, game.winner, game.status)}
        ${meta ? `<div class="bracket-game-meta">${escapeHtml(meta)}</div>` : ''}
      </article>
    `;
  };

  const render = () => {
    const division = select.value;
    const games = bracketsByDivision[division] || [];
    printDivision.textContent = division ? `${division} Championship Bracket` : '';

    if (!division || !games.length) {
      shell.hidden = true;
      empty.hidden = false;
      return;
    }

    const rounds = [...new Map(
      games.slice().sort(roundSort).map(game => [String(game.roundOrder) + '|' + game.round, {
        name: game.round,
        order: game.roundOrder
      }])
    ).values()];

    bracket.innerHTML = rounds.map(round => {
      const roundGames = games
        .filter(game => Number(game.roundOrder) === Number(round.order) && game.round === round.name)
        .sort(gameSort);

      return `
        <section class="bracket-round-column">
          <header class="bracket-round-header">
            <span>${escapeHtml(round.name)}</span>
            <small>${roundGames.length} ${roundGames.length === 1 ? 'game' : 'games'}</small>
          </header>
          <div class="bracket-round-games bracket-round-${Number(round.order) || 1}">
            ${roundGames.map(gameCard).join('')}
          </div>
        </section>
      `;
    }).join('');

    const latest = games.map(game => game.lastUpdated).filter(Boolean).sort().at(-1);
    updated.textContent = latest ? `Updated ${latest}` : '';
    empty.hidden = true;
    shell.hidden = false;
  };

  const display = data => {
    const games = Array.isArray(data.games) ? data.games : [];
    bracketsByDivision = games.reduce((result, game) => {
      const division = String(game.division || '').trim();
      if (!division) return result;
      (result[division] ||= []).push(game);
      return result;
    }, {});

    const divisions = Object.keys(bracketsByDivision)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const previous = select.value;
    select.innerHTML = '<option value="">Select division</option>';
    divisions.forEach(division => {
      const option = document.createElement('option');
      option.value = division;
      option.textContent = division;
      select.appendChild(option);
    });

    if (previous && bracketsByDivision[previous]) select.value = previous;
    else if (divisions.length) select.value = divisions[0];

    loading.hidden = true;
    render();
  };

  select.addEventListener('change', render);
  printButton.addEventListener('click', () => window.print());

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.games)) display(cached);
  } catch (error) {}

  const callbackName = `loadChillFestBrackets_${Date.now()}`;
  const script = document.createElement('script');
  const cleanup = () => {
    script.remove();
    delete window[callbackName];
  };
  const timeout = setTimeout(() => {
    cleanup();
    loading.hidden = true;
    if (!Object.keys(bracketsByDivision).length) empty.hidden = false;
  }, 12000);

  window[callbackName] = data => {
    clearTimeout(timeout);
    cleanup();
    if (!data || !data.ok || !Array.isArray(data.games)) {
      loading.hidden = true;
      empty.hidden = false;
      return;
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (error) {}
    display(data);
  };

  script.onerror = () => {
    clearTimeout(timeout);
    cleanup();
    loading.hidden = true;
    if (!Object.keys(bracketsByDivision).length) empty.hidden = false;
  };

  script.src = `${endpoint}?action=brackets&callback=${encodeURIComponent(callbackName)}&v=${Math.floor(Date.now() / 60000)}`;
  document.head.appendChild(script);
})();
