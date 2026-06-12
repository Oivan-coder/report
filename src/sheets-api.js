const API_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export async function fetchBootstrapFromSheets() {
  if (!API_URL) return null;
  return getFromSheets('bootstrap');
}

export async function fetchTransactionsFromSheets() {
  if (!API_URL) return null;
  return getFromSheets('transactions');
}

export async function appendTransactionToSheets(transaction) {
  if (!API_URL) return { skipped: true };
  return postToSheets('appendTransaction', transaction);
}

export async function updateTransactionInSheets(transaction) {
  if (!API_URL) return { skipped: true };
  return postToSheets('updateTransaction', transaction);
}

export async function updateAccountInSheets(account) {
  if (!API_URL) return { skipped: true };
  return postToSheets('updateAccount', account);
}

export async function answerMonthlyReviewInSheets(answer) {
  if (!API_URL) return { skipped: true };
  return postToSheets('answerMonthlyReview', answer);
}

async function getFromSheets(action) {
  const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const data = await res.json();
  if (data && data.ok === false) throw new Error(data.error || 'Sheets API error');
  return data;
}

async function postToSheets(action, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const data = await res.json();
  if (data && data.ok === false) throw new Error(data.error || 'Sheets API error');
  return data;
}
