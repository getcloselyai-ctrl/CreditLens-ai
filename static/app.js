/**
 * CreditLens — frontend controller
 *
 * Posts applicant data to POST /predict and renders the returned default
 * probability, threshold and classification. There is no simulated or
 * fallback prediction: if the service fails, the UI shows an error state.
 */
(() => {
  'use strict';

  // ---------- Configuration ----------
  const API_ENDPOINT = '/predict';
  const REQUEST_TIMEOUT_MS = 20000;
  const DEFAULT_THRESHOLD = 0.649871; // Used only if the response omits "threshold"
  const RING_CIRCUMFERENCE = 2 * Math.PI * 80; // r = 80 on the 200x200 viewBox
  const RING_CENTER = 100;
  const TICK_INNER = 64;
  const TICK_OUTER = 96;
  const MAX_HISTORY = 10;
  const COLOR_GREEN = '#10B981';
  const COLOR_RED = '#EF4444';

  const BADGE_BASE = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold tracking-wide';
  const BADGE_HIGH = `${BADGE_BASE} badge-high text-red-300`;
  const BADGE_LOW = `${BADGE_BASE} badge-low text-emerald-300`;

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  // Numeric fields and their validation rules (names match the API payload exactly)
  const NUMERIC_FIELDS = {
    person_age: { label: 'Age', min: 18, max: 100, integer: true },
    person_income: { label: 'Annual income', min: 1000 },
    person_emp_length: { label: 'Employment length', min: 0, max: 60 },
    loan_amnt: { label: 'Loan amount', min: 500 },
    loan_int_rate: { label: 'Interest rate', min: 1, max: 40 },
    cb_person_cred_hist_length: { label: 'Credit history length', min: 0, max: 50, integer: true }
  };

  const SELECT_FIELDS = {
    person_home_ownership: 'Home ownership',
    loan_intent: 'Loan intent',
    loan_grade: 'Loan grade',
    cb_person_default_on_file: 'Previous default on file'
  };

  const PRESET_LOW = {
    person_age: 34,
    person_income: 95000,
    person_home_ownership: 'MORTGAGE',
    person_emp_length: 7,
    loan_intent: 'PERSONAL',
    loan_grade: 'A',
    loan_amnt: 10000,
    loan_int_rate: 7.5,
    cb_person_default_on_file: 'N',
    cb_person_cred_hist_length: 8
  };

  const PRESET_HIGH = {
    person_age: 22,
    person_income: 24000,
    person_home_ownership: 'RENT',
    person_emp_length: 1,
    loan_intent: 'DEBTCONSOLIDATION',
    loan_grade: 'D',
    loan_amnt: 18000,
    loan_int_rate: 16.8,
    cb_person_default_on_file: 'Y',
    cb_person_cred_hist_length: 2
  };

  // ---------- DOM references ----------
  const $ = (id) => document.getElementById(id);

  const els = {
    form: $('risk-form'),
    submit: $('btn-submit'),
    submitText: $('btn-text'),
    spinner: $('btn-spinner'),
    retry: $('btn-retry'),
    reset: $('btn-reset'),
    presetLow: $('btn-preset-low'),
    presetHigh: $('btn-preset-high'),
    income: $('person_income'),
    loan: $('loan_amnt'),
    ratioHidden: $('loan_percent_income'),
    ratioDisplay: $('loan_percent_income_display'),
    ratioDecimal: $('loan_percent_income_decimal'),
    apiDots: [$('api-status-dot'), $('api-status-dot-mobile')],
    apiTexts: [$('api-status-text'), $('api-status-text-mobile')],
    navToggle: $('nav-toggle'),
    mobileNav: $('mobile-nav'),
    panels: {
      empty: $('panel-empty'),
      loading: $('panel-loading'),
      error: $('panel-error'),
      result: $('panel-result')
    },
    errorMessage: $('error-message'),
    ringProgress: $('gauge-progress'),
    ringTick: $('gauge-tick'),
    probValue: $('prob-value'),
    probRaw: $('prob-raw'),
    riskBadge: $('risk-badge'),
    riskBadgeText: $('risk-badge-text'),
    riskExplain: $('risk-explain'),
    summaryThreshold: $('summary-threshold'),
    summaryLti: $('summary-lti'),
    summaryLoan: $('summary-loan'),
    historyList: $('history-list'),
    historyEmpty: $('history-empty'),
    year: $('footer-year')
  };

  // Bail out quietly if the markup is missing a core element
  if (!els.form || !els.ringProgress || !els.ringTick) {
    console.error('CreditLens: required page elements are missing.');
    return;
  }

  // ---------- State ----------
  let inFlight = false;
  let numberAnimationId = 0;

  // ---------- Errors ----------
  class ApiError extends Error {
    constructor(kind, status, message) {
      super(message || kind);
      this.name = 'ApiError';
      this.kind = kind;     // 'http' | 'shape'
      this.status = status;
    }
  }

  // ---------- Helpers ----------
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fieldEl = (name) => $(name);

  function setPanel(name) {
    Object.entries(els.panels).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
  }

  function setApiStatus(state) {
    const map = {
      idle: { dot: 'bg-slate-500', text: 'API standby' },
      busy: { dot: 'bg-amber-400 status-pulse', text: 'Scoring…' },
      ok: { dot: 'bg-emerald-400', text: 'API connected' },
      error: { dot: 'bg-red-500', text: 'API unavailable' }
    };
    const s = map[state] || map.idle;
    els.apiDots.forEach((dot) => {
      if (dot) dot.className = `w-2 h-2 rounded-full ${s.dot}`;
    });
    els.apiTexts.forEach((t) => {
      if (t) t.textContent = s.text;
    });
  }

  function setLoading(isLoading) {
    els.submit.disabled = isLoading;
    els.submit.setAttribute('aria-busy', String(isLoading));
    els.spinner.classList.toggle('hidden', !isLoading);
    els.submitText.textContent = isLoading ? 'Processing application…' : 'Run Risk Evaluation';
    if (isLoading) setPanel('loading');
  }

  // ---------- Field validation ----------
  function ensureErrorEl(name) {
    const id = `err-${name}`;
    let err = $(id);
    if (!err) {
      const input = fieldEl(name);
      err = document.createElement('p');
      err.id = id;
      err.className = 'field-error';
      err.hidden = true;
      input.parentElement.appendChild(err);
    }
    return err;
  }

  function setFieldError(name, message) {
    const input = fieldEl(name);
    if (!input) return;
    const err = ensureErrorEl(name);
    err.textContent = message;
    err.hidden = !message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
    } else {
      input.setAttribute('aria-invalid', 'false');
      input.removeAttribute('aria-describedby');
    }
  }

  function validateNumeric(name) {
    const rule = NUMERIC_FIELDS[name];
    const raw = fieldEl(name).value.trim();
    if (raw === '') return `${rule.label} is required.`;
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${rule.label} must be a number.`;
    if (rule.integer && !Number.isInteger(n)) return `${rule.label} must be a whole number.`;
    if (n < rule.min) return `${rule.label} must be at least ${rule.min}.`;
    if (rule.max !== undefined && n > rule.max) return `${rule.label} must be at most ${rule.max}.`;
    return '';
  }

  function validateSelect(name) {
    return fieldEl(name).value ? '' : `Please select ${SELECT_FIELDS[name].toLowerCase()}.`;
  }

  function validateField(name) {
    if (NUMERIC_FIELDS[name]) return validateNumeric(name);
    if (SELECT_FIELDS[name]) return validateSelect(name);
    return '';
  }

  function validateForm() {
    let firstInvalid = null;
    const names = [...Object.keys(NUMERIC_FIELDS), ...Object.keys(SELECT_FIELDS)];
    names.forEach((name) => {
      const message = validateField(name);
      setFieldError(name, message);
      if (message && !firstInvalid) firstInvalid = fieldEl(name);
    });

    // Loan-to-income is derived; it is only valid when income and loan are valid
    if (!firstInvalid && updateRatio() === null) {
      firstInvalid = fieldEl('person_income');
      setFieldError('person_income', 'Annual income must be greater than zero.');
    }

    return { valid: !firstInvalid, firstInvalid };
  }

  function bindFieldValidation() {
    const names = [...Object.keys(NUMERIC_FIELDS), ...Object.keys(SELECT_FIELDS)];
    names.forEach((name) => {
      const input = fieldEl(name);
      if (!input) return;
      input.addEventListener('blur', () => {
        // Only validate on blur once the user has typed something, to avoid noise on tab-through
        if (input.value !== '') setFieldError(name, validateField(name));
      });
      const clear = () => {
        if (input.getAttribute('aria-invalid') === 'true') setFieldError(name, validateField(name));
      };
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
    });
  }

  function clearAllFieldErrors() {
    [...Object.keys(NUMERIC_FIELDS), ...Object.keys(SELECT_FIELDS)].forEach((name) => setFieldError(name, ''));
  }

  // ---------- Loan-to-income ratio ----------
  /** Returns the ratio as a 4-decimal number, or null when inputs are not valid. */
  function updateRatio() {
    const income = Number(els.income.value);
    const loan = Number(els.loan.value);

    if (!(income > 0) || !Number.isFinite(loan) || loan < 0) {
      els.ratioDisplay.textContent = '—';
      els.ratioDecimal.textContent = '(Enter a valid income)';
      els.ratioHidden.value = '';
      return null;
    }

    const ratio = loan / income;
    els.ratioDisplay.textContent = `${(ratio * 100).toFixed(2)}%`;
    els.ratioDecimal.textContent = `(Ratio: ${ratio.toFixed(4)})`;
    els.ratioHidden.value = ratio.toFixed(4);
    return ratio;
  }

  // ---------- Payload ----------
  function buildPayload() {
    const v = (id) => fieldEl(id).value;
    return {
      person_age: parseInt(v('person_age'), 10),
      person_income: parseFloat(v('person_income')),
      person_home_ownership: v('person_home_ownership'),
      person_emp_length: parseFloat(v('person_emp_length')),
      loan_intent: v('loan_intent'),
      loan_grade: v('loan_grade'),
      loan_amnt: parseFloat(v('loan_amnt')),
      loan_int_rate: parseFloat(v('loan_int_rate')),
      loan_percent_income: parseFloat(els.ratioHidden.value), // decimal ratio, 4 dp
      cb_person_default_on_file: v('cb_person_default_on_file'),
      cb_person_cred_hist_length: parseInt(v('cb_person_cred_hist_length'), 10)
    };
  }

  // ---------- API ----------
  async function requestPrediction(payload, signal) {
    let response;
    try {
      response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new ApiError('network', 0, 'Network failure');
    }

    if (!response.ok) {
      throw new ApiError('http', response.status, `HTTP ${response.status}`);
    }

    try {
      return await response.json();
    } catch (err) {
      throw new ApiError('shape', response.status, 'Response was not valid JSON');
    }
  }

  /** Validates the response and converts it to display values. */
  function normalizeResponse(data) {
    if (!data || typeof data !== 'object' || typeof data.default_probability !== 'number' || !Number.isFinite(data.default_probability)) {
      throw new ApiError('shape', 200, 'Missing default_probability');
    }

    const probability = clamp(data.default_probability, 0, 1);
    const threshold = typeof data.threshold === 'number' && Number.isFinite(data.threshold)
      ? clamp(data.threshold, 0, 1)
      : DEFAULT_THRESHOLD;

    const isHigh = typeof data.default_prediction === 'number'
      ? data.default_prediction === 1
      : probability >= threshold;

    return { probability, threshold, isHigh };
  }

  function messageFor(err) {
    if (err && err.name === 'AbortError') {
      return 'The prediction service took too long to respond. Please try again.';
    }
    if (err instanceof ApiError) {
      if (err.kind === 'network') return 'Could not reach the prediction service. Check your connection and try again.';
      if (err.kind === 'shape') return 'The prediction service returned a response CreditLens could not read.';
      if (err.status === 422) return 'The server rejected one or more inputs. Please review the form and try again.';
      if (err.status >= 500) return 'The prediction service encountered an error. Please try again shortly.';
      return `The prediction service returned an unexpected response (HTTP ${err.status}).`;
    }
    return 'Something went wrong while running the assessment. Please try again.';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight) return;

    const { valid, firstInvalid } = validateForm();
    if (!valid) {
      firstInvalid.focus();
      return;
    }

    const payload = buildPayload();
    inFlight = true;
    setLoading(true);
    setApiStatus('busy');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const data = await requestPrediction(payload, controller.signal);
      const result = normalizeResponse(data);
      renderResult(result);
      renderSummary(result.threshold, payload.loan_percent_income, payload.loan_amnt);
      addHistory(result, payload);
      setApiStatus('ok');
    } catch (err) {
      console.warn('CreditLens: prediction request failed.', err);
      els.errorMessage.textContent = messageFor(err);
      setPanel('error');
      setApiStatus('error');
    } finally {
      clearTimeout(timer);
      inFlight = false;
      setLoading(false);
    }
  }

  // ---------- Rendering ----------
  function renderRing(probability, threshold, isHigh) {
    const p = clamp(probability, 0, 1);
    const t = clamp(threshold, 0, 1);

    els.ringProgress.setAttribute('stroke', isHigh ? COLOR_RED : COLOR_GREEN);
    els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - p));

    // Threshold tick: starts at 12 o'clock and runs clockwise, matching the progress arc
    const angle = -Math.PI / 2 + t * 2 * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    els.ringTick.setAttribute('x1', (RING_CENTER + TICK_INNER * cos).toFixed(2));
    els.ringTick.setAttribute('y1', (RING_CENTER + TICK_INNER * sin).toFixed(2));
    els.ringTick.setAttribute('x2', (RING_CENTER + TICK_OUTER * cos).toFixed(2));
    els.ringTick.setAttribute('y2', (RING_CENTER + TICK_OUTER * sin).toFixed(2));
  }

  function animateRingFromEmpty(probability, threshold, isHigh) {
    if (prefersReducedMotion()) {
      renderRing(probability, threshold, isHigh);
      return;
    }
    // Snap to empty without transition, then animate to the target value
    els.ringProgress.style.transition = 'none';
    els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    void els.ringProgress.getBoundingClientRect(); // force reflow
    els.ringProgress.style.transition = '';
    renderRing(probability, threshold, isHigh);
  }

  function animateNumber(el, target, decimals = 1, duration = 900) {
    cancelAnimationFrame(numberAnimationId);
    if (prefersReducedMotion()) {
      el.textContent = target.toFixed(decimals);
      return;
    }
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (t < 1) numberAnimationId = requestAnimationFrame(frame);
    };
    numberAnimationId = requestAnimationFrame(frame);
  }

  function renderResult({ probability, threshold, isHigh }) {
    setPanel('result');

    animateRingFromEmpty(probability, threshold, isHigh);
    animateNumber(els.probValue, probability * 100, 1);
    els.probRaw.textContent = `Raw probability: ${probability.toFixed(6)}`;

    els.riskBadge.className = isHigh ? BADGE_HIGH : BADGE_LOW;
    els.riskBadgeText.textContent = isHigh ? 'High Risk' : 'Low Risk';

    const pct = (probability * 100).toFixed(1);
    const cutoff = (threshold * 100).toFixed(1);
    els.riskExplain.textContent = isHigh
      ? `The model estimates a ${pct}% probability of default, which is at or above the ${cutoff}% decision threshold. The application is classified as high risk.`
      : `The model estimates a ${pct}% probability of default, which is below the ${cutoff}% decision threshold. The application is classified as low risk.`;
  }

  function renderSummary(threshold, ratio, loan) {
    els.summaryThreshold.textContent = `${(threshold * 100).toFixed(1)}%`;
    els.summaryLti.textContent = `${(ratio * 100).toFixed(1)}%`;
    els.summaryLoan.textContent = money.format(loan);
  }

  function addHistory(result, payload) {
    els.historyEmpty.hidden = true;

    const row = document.createElement('li');
    row.className = 'history-row';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-2 min-w-0';

    const dot = document.createElement('span');
    dot.className = `w-1.5 h-1.5 rounded-full shrink-0 ${result.isHigh ? 'bg-red-500' : 'bg-emerald-500'}`;
    dot.setAttribute('aria-hidden', 'true');

    const amount = document.createElement('span');
    amount.className = 'text-slate-200 font-semibold truncate';
    amount.textContent = money.format(payload.loan_amnt);

    const lti = document.createElement('span');
    lti.className = 'text-slate-500 text-[10px] shrink-0';
    lti.textContent = `${(payload.loan_percent_income * 100).toFixed(1)}% LTI`;

    left.append(dot, amount, lti);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-3 shrink-0';

    const prob = document.createElement('span');
    prob.className = 'text-slate-300';
    prob.textContent = `${(result.probability * 100).toFixed(1)}%`;

    const badge = document.createElement('span');
    badge.className = `px-2 py-0.5 rounded text-[10px] border font-bold uppercase ${result.isHigh
      ? 'text-red-300 bg-red-950/70 border-red-800/60'
      : 'text-emerald-300 bg-emerald-950/70 border-emerald-800/60'}`;
    badge.textContent = result.isHigh ? 'High' : 'Low';

    right.append(prob, badge);
    row.append(left, right);

    els.historyList.prepend(row);
    while (els.historyList.children.length > MAX_HISTORY) {
      els.historyList.lastElementChild.remove();
    }
  }

  // ---------- Actions ----------
  function applyPreset(preset) {
    Object.entries(preset).forEach(([key, value]) => {
      const el = fieldEl(key);
      if (el) el.value = value;
    });
    clearAllFieldErrors();
    updateRatio();
  }

  function resetForm() {
    els.form.reset();
    clearAllFieldErrors();
    updateRatio();
    setPanel('empty');
    renderRing(0, DEFAULT_THRESHOLD, false);
    els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    setApiStatus('idle');
  }

  // ---------- Navigation ----------
  function bindNavigation() {
    if (!els.navToggle || !els.mobileNav) return;

    const setOpen = (open) => {
      els.mobileNav.hidden = !open;
      els.navToggle.setAttribute('aria-expanded', String(open));
      els.navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    };

    els.navToggle.addEventListener('click', () => setOpen(els.mobileNav.hidden));
    els.mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.mobileNav.hidden) {
        setOpen(false);
        els.navToggle.focus();
      }
    });
  }

  // ---------- Init ----------
  function init() {
    if (els.year) els.year.textContent = String(new Date().getFullYear());

    bindFieldValidation();
    bindNavigation();
    updateRatio();
    renderRing(0, DEFAULT_THRESHOLD, false);
    els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    setPanel('empty');
    setApiStatus('idle');

    els.income.addEventListener('input', updateRatio);
    els.loan.addEventListener('input', updateRatio);

    els.presetLow.addEventListener('click', () => applyPreset(PRESET_LOW));
    els.presetHigh.addEventListener('click', () => applyPreset(PRESET_HIGH));
    els.reset.addEventListener('click', resetForm);
    els.retry.addEventListener('click', () => els.form.requestSubmit());

    els.form.addEventListener('submit', handleSubmit);
  }

  init();
})();
