'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'ink' | 'paper'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'ink',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('ink')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'paper') setTheme('paper')
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('paper-mode', theme === 'paper')
    localStorage.setItem('theme', theme)
  }, [theme, mounted])

  const toggle = () => setTheme(t => (t === 'ink' ? 'paper' : 'ink'))

  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
