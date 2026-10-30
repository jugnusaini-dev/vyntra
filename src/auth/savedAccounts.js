const STORAGE_KEY = "vyntra_saved_accounts";
const MAX_SAVED_ACCOUNTS = 3;

export function getSavedAccounts() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  let accounts;
  try {
    accounts = JSON.parse(stored);
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }

  if (!Array.isArray(accounts)) return [];
  return accounts.filter((account) =>
    account &&
    typeof account.id === "string" &&
    typeof account.email === "string" &&
    typeof account.name === "string" &&
    typeof account.username === "string"
  ).slice(0, MAX_SAVED_ACCOUNTS);
}

export function saveAccount(user) {
  const account = {
    id: user.id,
    email: user.email,
    name: user.name || user.username,
    username: user.username,
  };
  const existingAccounts = getSavedAccounts().filter(
    (savedAccount) => savedAccount.email.toLowerCase() !== account.email.toLowerCase(),
  );
  const accounts = [account, ...existingAccounts].slice(0, MAX_SAVED_ACCOUNTS);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(accounts),
  );
  return existingAccounts
    .filter((savedAccount) => !accounts.some((nextAccount) => nextAccount.id === savedAccount.id))
    .map((savedAccount) => savedAccount.id);
}

export function forgetAccount(email) {
  const accounts = getSavedAccounts().filter(
    (account) => account.email.toLowerCase() !== email.toLowerCase(),
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}
