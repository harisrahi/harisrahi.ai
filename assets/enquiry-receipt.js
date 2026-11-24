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
  if (rememberReceipt({ reference, email: form.elements.email.value.trim() })) {
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
  const receipt = readReceipt(reference);
  if (!receipt) return;

  const summary = document.getElementById('reply-summary');
  const address = document.getElementById('reply-address');
  const edit = document.getElementById('change-email');
  const form = document.getElementById('email-correction');
  const input = form.elements.email;
  const send = form.querySelector('[type="submit"]');
  const cancel = document.getElementById('cancel-correction');
  const status = document.getElementById('correction-status');

  address.textContent = receipt.email;
  document.getElementById('correction-fallback').hidden = true;
  panel.hidden = false;

  function closeEditor() {
    form.hidden = true;
    summary.hidden = false;
    edit.focus();
  }
  edit.addEventListener('click', () => {
    input.value = receipt.email;
    status.textContent = '';
    summary.hidden = true;
    form.hidden = false;
    input.focus();
  });
  cancel.addEventListener('click', () => {
    status.textContent = '';
    closeEditor();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (send.disabled) return;
    const email = input.value.trim();
    if (email === receipt.email) {
      status.textContent = 'That’s already your reply email.';
      closeEditor();
      return;
    }

    const body = new URLSearchParams({
      'form-name': 'inquiry',
      'bot-field': form.elements['bot-field'].value,
      reference,
      email,
      message: 'Reply email correction for enquiry ' + reference + '.\nPrevious reply email: ' +
        receipt.email + '\nPlease reply to: ' + email
    });
    send.disabled = cancel.disabled = input.readOnly = true;
    status.textContent = 'Sending correction…';
    try {
      const response = await fetch(form.action, { method: 'POST', body, mode: 'same-origin' });
      if (!response.ok) throw new Error('Correction was not confirmed');
      receipt.email = email;
      address.textContent = email;
      if (readReceipt(reference)) rememberReceipt(receipt);
      status.textContent = 'Correction sent.';
      closeEditor();
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
