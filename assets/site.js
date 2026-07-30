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
