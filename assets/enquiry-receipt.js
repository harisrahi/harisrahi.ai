const receiptKey = 'enquiry.reply';

function rememberReceipt(receipt) {
  try {
    sessionStorage.setItem(receiptKey, JSON.stringify(receipt));
    return true;
  } catch {
    return false;
  }
}

function readReceipt(reference) {
  if (!reference) return null;
  try {
    const receipt = JSON.parse(sessionStorage.getItem(receiptKey));
    return receipt?.reference === reference && typeof receipt.email === 'string' ? receipt : null;
  } catch {
    return null;
  }
}

function prepareReceipt(form) {
  // The fragment links this tab to this submission. The email stays out of the URL.
  const destination = new URL(form.action);
  destination.hash = '';
  form.action = destination.href;
  if (!window.crypto?.randomUUID) return;
  const reference = crypto.randomUUID();
  form.elements.reference.value = reference;
  if (rememberReceipt({
    reference,
    email: form.elements.email.value.trim(),
    message: form.elements.message.value
  })) {
    destination.hash = 'receipt-' + reference;
    form.action = destination.href;
  }
}

function showReceipt(panel) {
  const incoming = location.hash.match(/^#receipt-([0-9a-f-]{36})$/i);
  const reference = incoming ? incoming[1] : history.state?.enquiryReference;
  if (incoming) {
    history.replaceState({ ...history.state, enquiryReference: reference }, '', location.pathname + location.search);
  }
  let receipt = readReceipt(reference);
  const address = document.getElementById('reply-address');
  const message = document.getElementById('submitted-message');
  const messageDetails = document.getElementById('message-details');
  const fallback = document.getElementById('correction-fallback');
  const edit = document.getElementById('change-email');
  const form = document.getElementById('email-correction');
  const input = form.elements.email;
  const send = form.querySelector('[type="submit"]');
  const cancel = document.getElementById('cancel-correction');
  const status = document.getElementById('correction-status');

  function renderReceipt() {
    form.hidden = true;
    // If a storage write failed, do not restore a stale address on reload.
    const unavailable = !receipt || (history.state?.enquiryCorrected && !receipt.corrected);
    panel.hidden = Boolean(unavailable);
    fallback.hidden = !unavailable || Boolean(history.state?.enquiryCorrected);
    if (unavailable) return;
    address.textContent = receipt.email;
    messageDetails.hidden = typeof receipt.message !== 'string';
    message.textContent = receipt.message || '';
    edit.hidden = Boolean(receipt.corrected);
    status.textContent = receipt.corrected ? 'Correction sent.' : '';
  }
  renderReceipt();
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      receipt = readReceipt(reference);
      renderReceipt();
    }
  });

  function closeEditor() {
    form.hidden = true;
    edit.hidden = false;
    edit.focus();
  }
  edit.addEventListener('click', () => {
    if (!receipt || receipt.corrected) return;
    input.value = receipt.email;
    status.textContent = '';
    edit.hidden = true;
    form.hidden = false;
    input.focus();
  });
  cancel.addEventListener('click', () => {
    status.textContent = '';
    closeEditor();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!receipt || receipt.corrected || send.disabled) return;
    const email = input.value.trim();
    if (email === receipt.email) {
      status.textContent = 'That’s already your reply email.';
      closeEditor();
      return;
    }

    form.elements.reference.value = reference;
    form.elements.message.value = 'Reply email correction for enquiry ' + reference +
      '.\nPrevious reply email: ' + receipt.email + '\nPlease reply to: ' + email;
    const body = new URLSearchParams(new FormData(form));
    body.set('form-name', form.name);
    send.disabled = cancel.disabled = input.readOnly = true;
    status.textContent = 'Sending correction…';
    try {
      const response = await fetch(form.action, { method: 'POST', body, mode: 'same-origin' });
      if (!response.ok) throw new Error('Correction was not confirmed');
      receipt.email = email;
      receipt.corrected = true;
      if (readReceipt(reference)) rememberReceipt(receipt);
      history.replaceState({ ...history.state, enquiryCorrected: true }, '');
      renderReceipt();
      status.focus();
    } catch {
      status.textContent = 'Delivery could not be confirmed. Please try again.';
    } finally {
      send.disabled = cancel.disabled = input.readOnly = false;
    }
  });
}

const enquiryForm = document.getElementById('enquiry-form');
if (enquiryForm) enquiryForm.addEventListener('submit', () => prepareReceipt(enquiryForm));
const replyPanel = document.getElementById('reply-details');
if (replyPanel) showReceipt(replyPanel);
