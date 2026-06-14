const themeToggle = document.getElementById('toggleTheme');
const themeToggleApp = document.getElementById('toggleThemeApp');
const root = document.documentElement;

function setTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const label = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
  if (themeToggle) themeToggle.textContent = label;
  if (themeToggleApp) themeToggleApp.textContent = label;
}

function loadTheme() {
  const saved = localStorage.getItem('theme');
  setTheme(saved || 'light');
}

if (themeToggle) themeToggle.addEventListener('click', () => {
  const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
});

if (themeToggleApp) themeToggleApp.addEventListener('click', () => {
  const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
});

window.addEventListener('load', () => {
  loadTheme();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service Worker falhou:', error);
    });
  }
});
