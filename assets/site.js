const CONFIG = window.CHILL_FEST_CONFIG || {};
const menu = document.querySelector('.menu-btn');
const mobile = document.querySelector('.mobile-nav');
if (menu && mobile) {
  menu.addEventListener('click', () => {
    const open = mobile.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
}

document.querySelectorAll('[data-whos-coming]').forEach((el) => {
  if (!CONFIG.showWhosComing) el.remove();
});
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

const form = document.getElementById('registration-form');
if (form) {
  const button = document.getElementById('submit-registration');
  const status = document.getElementById('form-status');
  const endpoint = String(CONFIG.registrationEndpoint || '');

  const setStatus = (message, type = '') => {
    status.textContent = message;
    status.className = `form-status ${type}`.trim();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    if (!form.reportValidity()) return;
    if (!endpoint || endpoint.includes('PASTE_YOUR_')) {
      setStatus('Registration is not connected yet. Please contact Patrick at 504-312-0863 or patrickdcresson@gmail.com.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Submitting…';

    try {
      const body = new URLSearchParams(new FormData(form));
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        body
      });

      sessionStorage.setItem('chillFestRegistrationTeam', form.elements.team_name.value);
      window.location.href = 'thank-you.html';
    } catch (error) {
      console.error(error);
      setStatus('We could not submit the registration. Please try again, or contact Patrick directly.', 'error');
      button.disabled = false;
      button.textContent = 'Submit Registration →';
    }
  });
}

const thankYouTeam = document.querySelector('[data-registration-team]');
if (thankYouTeam) {
  const team = sessionStorage.getItem('chillFestRegistrationTeam');
  if (team) thankYouTeam.textContent = team;
}

const printBracketButton = document.querySelector('[data-print-bracket]');
if (printBracketButton) {
  printBracketButton.addEventListener('click', () => window.print());
}

document.querySelectorAll('[data-print-date]').forEach((el) => {
  el.textContent = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date());
});


// Version 4 configurable homepage modules
const countdown = document.querySelector('[data-countdown]');
if (countdown && CONFIG.tournament?.startDate) {
  const target = new Date(CONFIG.tournament.startDate).getTime();
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    countdown.textContent = diff ? `${days} days, ${hours} hours` : 'Tournament weekend is here';
  };
  tick(); setInterval(tick, 60000);
}
const updates = document.querySelector('[data-tournament-updates]');
if (updates && Array.isArray(CONFIG.updates)) {
  updates.innerHTML = CONFIG.updates.map(item => `<article class="update-item"><strong>${item.title}</strong><span>${item.text}</span></article>`).join('');
}
document.querySelectorAll('[data-sponsors]').forEach(el => { if (CONFIG.showSponsors === false) el.remove(); });

const approvedTeamsContainer =
  document.getElementById('approved-teams');

const approvedTeamsStatus =
  document.getElementById('approved-teams-status');

if (approvedTeamsContainer && approvedTeamsStatus) {
  const endpoint = String(CONFIG.registrationEndpoint || '');

  const escapeHtml = (value) => {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const renderApprovedTeams = (teams) => {
    if (!Array.isArray(teams) || teams.length === 0) {
      approvedTeamsStatus.innerHTML = `
        <div class="empty-icon">⚾</div>
        <h2>Teams Will Appear Here</h2>
        <p>No approved teams have been published yet.</p>
        <a class="btn" href="register.html">Register Your Team</a>
      `;

      approvedTeamsStatus.hidden = false;
      approvedTeamsContainer.hidden = true;
      return;
    }

    const grouped = teams.reduce((groups, team) => {
      const division = team.division || 'Other';

      if (!groups[division]) {
        groups[division] = [];
      }

      groups[division].push(team);
      return groups;
    }, {});

    approvedTeamsContainer.innerHTML =
      Object.entries(grouped)
        .map(([division, divisionTeams]) => {
          const cards = divisionTeams
            .map((team) => {
              const location = [
                team.organization,
                team.teamCity
              ]
                .filter(Boolean)
                .join(' · ');

              return `
                <article class="card team-card">
                  <div class="eyebrow">
                    ${escapeHtml(division)}
                  </div>

                  <h3>
                    ${escapeHtml(team.teamName)}
                  </h3>

                  ${
                    location
                      ? `<p>${escapeHtml(location)}</p>`
                      : ''
                  }
                </article>
              `;
            })
            .join('');

          return `
            <section class="division-section">
              <div class="section-head">
                <div>
                  <div class="eyebrow">
                    Tournament Field
                  </div>

                  <h2>
                    ${escapeHtml(division)} Division
                  </h2>
                </div>

                <div class="team-count">
                  ${divisionTeams.length}
                  ${divisionTeams.length === 1 ? 'Team' : 'Teams'}
                </div>
              </div>

              <div class="team-grid">
                ${cards}
              </div>
            </section>
          `;
        })
        .join('');

    approvedTeamsStatus.hidden = true;
    approvedTeamsContainer.hidden = false;
  };

  if (!endpoint) {
    approvedTeamsStatus.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <h2>Teams Could Not Be Loaded</h2>
      <p>The approved-team feed is not connected.</p>
    `;
  } else {
    fetch(`${endpoint}?action=approved-teams`)
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          throw new Error(
            result.message || 'Unable to load teams.'
          );
        }

        renderApprovedTeams(result.teams);
      })
      .catch((error) => {
        console.error(error);

        approvedTeamsStatus.innerHTML = `
          <div class="empty-icon">⚠️</div>
          <h2>Teams Could Not Be Loaded</h2>
          <p>Please refresh the page or check back shortly.</p>
        `;
      });
  }
}

// Homepage division counts from the approved-teams feed
const divisionCountElements = document.querySelectorAll('[data-division-count]');

if (divisionCountElements.length) {
  const endpoint = String(CONFIG.registrationEndpoint || '');

  const setDivisionCounts = (teams) => {
    const counts = Array.from(divisionCountElements).reduce((result, element) => {
      result[element.dataset.divisionCount] = 0;
      return result;
    }, {});

    if (Array.isArray(teams)) {
      teams.forEach((team) => {
        const division = String(team.division || '').trim().toUpperCase();

        if (Object.prototype.hasOwnProperty.call(counts, division)) {
          counts[division] += 1;
        }
      });
    }

    divisionCountElements.forEach((element) => {
      const division = element.dataset.divisionCount;
      const count = counts[division] || 0;

      element.textContent = count === 0
        ? 'Be the first approved team'
        : `${count} approved ${count === 1 ? 'team' : 'teams'}`;
    });
  };

  const showDivisionCountError = () => {
    divisionCountElements.forEach((element) => {
      element.textContent = 'View approved teams';
    });
  };

  if (!endpoint) {
    showDivisionCountError();
  } else {
    fetch(`${endpoint}?action=approved-teams`)
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          throw new Error(
            result.message || 'Unable to load division counts.'
          );
        }

        setDivisionCounts(result.teams);
      })
      .catch((error) => {
        console.error(error);
        showDivisionCountError();
      });
  }
}

