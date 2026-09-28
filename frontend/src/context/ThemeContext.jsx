import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'city546-theme';
const ThemeContext = createContext(null);

const currentTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export function ThemeProvider({ children }) {
  // public/theme-init.js already applied the initial theme before paint.
  const [theme, setTheme] = useState(currentTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable — theme still applies for this visit */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
