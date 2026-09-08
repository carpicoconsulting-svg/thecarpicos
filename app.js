(function () {
  'use strict';
  // ---- Wedding config (keep in sync with the date shown in index.html) ----
  var WEDDING_AT = new Date('2027-08-08T17:00:00-04:00'); // Sunday, August 8, 2027, 5:00 PM Toronto time

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- Nav ----
  var toggle = $('#navToggle'), links = $('#navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('a', links).forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); });
    });
  }
  // Active section highlight
  var sections = $$('main section[id], header[id]');
  var navAnchors = $$('#navLinks a[href^="#"]');
  if ('IntersectionObserver' in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navAnchors.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  // ---- Countdown ----
  var cd = $('#countdown');
  function tick() {
    if (!cd) return;
    var diff = WEDDING_AT - new Date();
    if (diff <= 0) { cd.classList.add('is-past'); cd.textContent = 'We are married!'; return; }
    var d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4);
    $('[data-cd="days"]', cd).textContent = d;
    $('[data-cd="hours"]', cd).textContent = h;
    $('[data-cd="minutes"]', cd).textContent = m;
  }
  tick(); setInterval(tick, 30000);

  // ---- RSVP (posts straight to a Google Form owned by Nick and Laura; responses land in their Google Sheet) ----
  var FORM = {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSdivNTNjqTSrxRYFbhhbxlwK-mMoANwgZj4SiTOOfdq0FJp4Q/formResponse',
    fallback: 'https://docs.google.com/forms/d/e/1FAIpQLSdivNTNjqTSrxRYFbhhbxlwK-mMoANwgZj4SiTOOfdq0FJp4Q/viewform',
    fields: { name: 'entry.521357415', email: 'entry.1157304710', attending: 'entry.686622912', extra: 'entry.941261820',
              guest1: 'entry.1562040421', guest2: 'entry.1004882003', guest3: 'entry.2082170761', guest4: 'entry.272580214',
              dietary: 'entry.694190378', song: 'entry.1258660614', message: 'entry.215218613' },
    maxGuests: 4,
    attendingLabels: { yes: 'Joyfully accepts', no: 'Regretfully declines' }
  };
  var form = $('#rsvpForm');
  if (!form) return;
  var attendingOnly = $('#attendingOnly'), msg = $('#formMsg'), submit = $('#rsvpSubmit');
  var done = $('#rsvpDone'), doneTitle = $('#doneTitle'), doneText = $('#doneText');
  var fallbackLink = $('#rsvpFallback');
  if (fallbackLink && FORM.fallback.indexOf('__') !== 0) fallbackLink.href = FORM.fallback;

  var extraSel = $('#extra'), guestBox = $('#guestNames');
  function renderGuestFields() {
    var n = parseInt(extraSel.value, 10) || 0;
    var current = {};
    $$('input', guestBox).forEach(function (i) { current[i.name] = i.value; });
    guestBox.innerHTML = '';
    for (var k = 1; k <= n; k++) {
      var wrap = document.createElement('div'); wrap.className = 'field';
      var lab = document.createElement('label'); lab.setAttribute('for', 'guest' + k); lab.textContent = 'Guest ' + k + ' full name';
      var req = document.createElement('span'); req.className = 'req'; req.textContent = ' *'; lab.appendChild(req);
      var inp = document.createElement('input'); inp.type = 'text'; inp.id = 'guest' + k; inp.name = 'guest' + k; inp.maxLength = 120; inp.setAttribute('aria-required', 'true');
      inp.autocomplete = 'off'; inp.placeholder = 'First and last name'; inp.value = current['guest' + k] || '';
      var err = document.createElement('small'); err.className = 'err'; err.id = 'err-guest' + k; err.setAttribute('data-err', 'guest' + k);
      wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(err); guestBox.appendChild(wrap);
    }
    guestBox.hidden = n === 0;
  }
  extraSel.addEventListener('change', renderGuestFields);
  renderGuestFields();

  function syncAttending() {
    var v = (form.querySelector('input[name="attending"]:checked') || {}).value;
    attendingOnly.hidden = v === 'no';
  }
  $$('input[name="attending"]', form).forEach(function (r) { r.addEventListener('change', syncAttending); });
  syncAttending();

  function setError(name, text) {
    var el = form.querySelector('[data-err="' + name + '"]');
    if (el) { el.textContent = text || ''; if (!el.id) el.id = 'err-' + name; }
    var field = el && el.closest('.field');
    if (field) field.classList.toggle('has-error', !!text);
    var input = form.querySelector('[name="' + name + '"]');
    if (input && input.type !== 'radio') {
      if (text) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', el ? el.id : ''); }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    }
  }
  function clearErrors() { $$('[data-err]', form).forEach(function (el) { setError(el.getAttribute('data-err'), ''); }); msg.textContent = ''; msg.classList.remove('is-error'); }

  function showDone(data) {
    var first = (data.name || '').trim().split(/\s+/)[0] || 'friend';
    form.hidden = true; done.hidden = false;
    if (data.attending === 'yes') {
      doneTitle.textContent = 'See you there, ' + first + '!';
      doneText.textContent = 'Your RSVP is in. We cannot wait to celebrate with you on August 8, 2027. Keep an eye on this site for the full timeline as the day gets closer.';
    } else {
      doneTitle.textContent = 'Thank you, ' + first;
      doneText.textContent = 'We are sorry you cannot make it, but we are so grateful you let us know. You will be in our thoughts on the day.';
    }
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearErrors();
    var data = {};
    $$('input, select, textarea', form).forEach(function (el) {
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; return; }
      data[el.name] = el.value;
    });
    if (data.website) { showDone(data); return; } // honeypot: bots see success, nothing is sent
    var errors = {};
    if (!data.name || data.name.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) errors.email = 'Please enter a valid email address.';
    if (!data.attending) errors.attending = 'Please let us know if you can make it.';
    var extra = data.attending === 'yes' ? (parseInt(data.extra, 10) || 0) : 0;
    for (var g = 1; g <= extra; g++) {
      if (!data['guest' + g] || data['guest' + g].trim().length < 2) errors['guest' + g] = 'Please enter this guest\'s full name.';
    }
    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (k) { setError(k, errors[k]); });
      var first = form.querySelector('.has-error input, .has-error textarea, .has-error select, fieldset.has-error input');
      if (first) first.focus();
      return;
    }
    if (FORM.action.indexOf('__') === 0) { msg.textContent = 'The RSVP form is not connected yet. Please try again later.'; msg.classList.add('is-error'); return; }
    submit.disabled = true; msg.textContent = 'Sending…';
    var body = new URLSearchParams();
    body.append(FORM.fields.name, data.name.trim());
    body.append(FORM.fields.email, data.email.trim());
    body.append(FORM.fields.attending, FORM.attendingLabels[data.attending]);
    body.append(FORM.fields.extra, String(extra));
    for (var q = 1; q <= FORM.maxGuests; q++) {
      var key = FORM.fields['guest' + q];
      if (key && key.indexOf('__') !== 0) body.append(key, q <= extra ? (data['guest' + q] || '').trim() : '');
    }
    body.append(FORM.fields.dietary, data.attending === 'yes' ? (data.dietary || '') : '');
    body.append(FORM.fields.song, data.attending === 'yes' ? (data.song || '') : '');
    body.append(FORM.fields.message, data.message || '');
    fetch(FORM.action, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () { showDone(data); })
      .catch(function () { msg.textContent = 'We could not send your RSVP. Please check your connection and try again, or use the backup form link below.'; msg.classList.add('is-error'); })
      .then(function () { submit.disabled = false; if (msg.textContent === 'Sending…') msg.textContent = ''; });
  });
})();
