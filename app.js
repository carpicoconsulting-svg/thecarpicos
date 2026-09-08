(function () {
  'use strict';
  // ---- Wedding config (keep in sync with the date shown in index.html) ----
  var WEDDING_AT = new Date('2027-08-08T16:00:00-04:00'); // Sunday, August 8, 2027, 4:00 PM Toronto time

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

  // ---- RSVP (posts straight to a Google Form owned by Laura and Nick; responses land in their Google Sheet) ----
  var FORM = {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSdivNTNjqTSrxRYFbhhbxlwK-mMoANwgZj4SiTOOfdq0FJp4Q/formResponse',
    fallback: 'https://docs.google.com/forms/d/e/1FAIpQLSdivNTNjqTSrxRYFbhhbxlwK-mMoANwgZj4SiTOOfdq0FJp4Q/viewform',
    fields: { name: 'entry.521357415', email: 'entry.1157304710', attending: 'entry.686622912', party: 'entry.941261820',
              guests: 'entry.1562040421', dietary: 'entry.694190378', song: 'entry.1258660614', message: 'entry.215218613' },
    attendingLabels: { yes: 'Joyfully accepts', no: 'Regretfully declines' }
  };
  var form = $('#rsvpForm');
  if (!form) return;
  var attendingOnly = $('#attendingOnly'), msg = $('#formMsg'), submit = $('#rsvpSubmit');
  var done = $('#rsvpDone'), doneTitle = $('#doneTitle'), doneText = $('#doneText');
  var fallbackLink = $('#rsvpFallback');
  if (fallbackLink && FORM.fallback.indexOf('__') !== 0) fallbackLink.href = FORM.fallback;

  function syncAttending() {
    var v = (form.querySelector('input[name="attending"]:checked') || {}).value;
    attendingOnly.hidden = v === 'no';
  }
  $$('input[name="attending"]', form).forEach(function (r) { r.addEventListener('change', syncAttending); });
  syncAttending();

  function setError(name, text) {
    var el = form.querySelector('[data-err="' + name + '"]');
    if (el) el.textContent = text || '';
    var field = el && el.closest('.field');
    if (field) field.classList.toggle('has-error', !!text);
  }
  function clearErrors() { $$('[data-err]', form).forEach(function (el) { setError(el.getAttribute('data-err'), ''); }); msg.textContent = ''; msg.classList.remove('is-error'); }

  function showDone(data) {
    var first = data.name.trim().split(/\s+/)[0];
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
    body.append(FORM.fields.party, data.attending === 'yes' ? (data.party || '1') : '0');
    body.append(FORM.fields.guests, data.attending === 'yes' ? (data.guests || '') : '');
    body.append(FORM.fields.dietary, data.attending === 'yes' ? (data.dietary || '') : '');
    body.append(FORM.fields.song, data.attending === 'yes' ? (data.song || '') : '');
    body.append(FORM.fields.message, data.message || '');
    fetch(FORM.action, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () { showDone(data); })
      .catch(function () { msg.textContent = 'We could not send your RSVP. Please check your connection and try again, or use the backup form link below.'; msg.classList.add('is-error'); })
      .then(function () { submit.disabled = false; if (msg.textContent === 'Sending…') msg.textContent = ''; });
  });
})();
