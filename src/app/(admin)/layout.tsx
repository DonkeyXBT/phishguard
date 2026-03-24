'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login')
  }, [router])

  const logout = () => { localStorage.removeItem('token'); router.push('/login') }

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/queue', label: 'Review Queue', icon: '📥' },
    { href: '/organizations', label: 'Organizations', icon: '🏢' },
    { href: '/domains',       label: 'Domain Lists',  icon: '🌐' },
  ]

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">PG</div>
            <div>
              <div className="font-semibold text-white">PhishGuard</div>
              <div className="text-xs text-gray-400">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(item.href) ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={logout}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <span>🚪</span>Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
