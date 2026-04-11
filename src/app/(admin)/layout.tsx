'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import {
  LayoutDashboard, Inbox, Building2, Globe, FileText,
  BarChart3, Settings, LogOut, Shield, Sun, Moon, Brain,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/queue', label: 'Review Queue', icon: Inbox },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/organizations', label: 'Organizations', icon: Building2 },
      { href: '/domains', label: 'Domain Lists', icon: Globe },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit', label: 'Audit Log', icon: FileText },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/ml-insights', label: 'ML Insights', icon: Brain },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login')
  }, [router])

  const logout = () => { localStorage.removeItem('token'); router.push('/login') }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-primary)] flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-700 to-blue-500 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text-primary)] text-sm">PhishGuard</div>
              <div className="text-xs text-[var(--text-tertiary)]">Admin Console</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label} className="mb-4">
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname.startsWith(item.href)
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href}
                      className={`nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                        active
                          ? 'bg-[var(--bg-active)] text-[var(--text-active)] font-medium'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                      }`}>
                      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-[var(--border-secondary)]">
          <button onClick={toggle}
            className="nav-link btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] mb-1">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={logout}
            className="nav-link btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-red-600 dark:hover:text-red-400">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-[var(--bg-secondary)]">
        <div className="page-enter">{children}</div>
      </main>
    </div>
  )
}
