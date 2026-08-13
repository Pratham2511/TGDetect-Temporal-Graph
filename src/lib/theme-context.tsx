'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useSyncExternalStore } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): Theme {
  return (localStorage.getItem('tgdetect-theme') as Theme) || 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const externalTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localTheme, setLocalTheme] = useState<Theme | null>(null);

  const theme = localTheme ?? externalTheme;

  const toggleTheme = useCallback(() => {
    const next = (localTheme ?? externalTheme) === 'dark' ? 'light' : 'dark';
    localStorage.setItem('tgdetect-theme', next);
    setLocalTheme(next);
  }, [localTheme, externalTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
