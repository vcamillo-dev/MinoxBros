import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabaseClient'
import Friends from '../components/Friends'

const toDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const todayStr = () => toDateStr(new Date())
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEK_DAYS = ['D','S','T','Q','Q','S','S']

function calcStats(records) {
  const today = new Date()
  const totalApplied = Object.keys(records).length
  let streak = 0
  const cur = new Date(today)
  // Se hoje ainda não foi marcado, conta a partir de ontem
  // Streak só zera se um dia inteiro passou sem marcar
  if (!records[toDateStr(cur)]) cur.setDate(cur.getDate() - 1)
  while (true) {
    if (records[toDateStr(cur)]) { streak++; cur.setDate(cur.getDate() - 1) } else break
  }
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let appliedThisMonth = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (records[ds]) appliedThisMonth++
  }
  const monthPct = Math.round((appliedThisMonth / daysInMonth) * 100)
  return { streak, totalApplied, appliedThisMonth, daysInMonth, monthPct }
}

function StatCard({ label, value, suffix = '', accent = false }) {
  return (
    <div className={`flex-1 rounded-xl p-3 text-center border ${accent ? 'bg-glow-faint border-glow-dim' : 'bg-base-800 border-base-600'}`}>
      <div className={`font-mono font-bold text-xl leading-none mb-1 ${accent ? 'text-glow-bright' : 'text-base-200'}`}>
        {value}{suffix && <span className="text-xs ml-0.5 font-normal">{suffix}</span>}
      </div>
      <div className="text-base-400 text-xs font-body leading-tight">{label}</div>
    </div>
  )
}

function MonthProgress({ pct, applied, total }) {
  return (
    <div className="bg-base-800 border border-base-600 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-base-400 font-body uppercase tracking-wider">Progresso do Mês</span>
        <span className="text-xs font-mono font-semibold text-glow">{applied}/{total} dias</span>
      </div>
      <div className="h-3 bg-base-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{
          width: `${pct}%`,
          background: pct >= 80 ? 'linear-gradient(90deg, #3fb950, #56d364)' : pct >= 50 ? 'linear-gradient(90deg, #238636, #3fb950)' : 'linear-gradient(90deg, #1a4028, #238636)',
        }} />
      </div>
      <div className="text-right mt-1"><span className="text-xs font-mono text-base-500">{pct}%</span></div>
    </div>
  )
}

function Calendar({ year, month, records, onToggle, toggling }) {
  const today = todayStr()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  return (
    <div className="bg-base-800 border border-base-600 rounded-xl p-4">
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d, i) => <div key={i} className="text-center text-xs font-mono font-medium text-base-500 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="aspect-square" />
          const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isApplied = Boolean(records[ds])
          const isToday = ds === today
          const isToggling = toggling === ds
          return (
            <button key={ds} onClick={() => onToggle(ds)} disabled={isToggling}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-mono font-semibold select-none no-tap-highlight transition-all duration-150 active:scale-90
                ${isToggling ? 'opacity-60 scale-95' : ''}
                ${isApplied ? 'bg-glow text-base-900 shadow-md shadow-glow/25 hover:bg-glow-bright' : 'bg-base-700 text-base-400 hover:bg-base-600 hover:text-base-300'}
                ${isToday && !isApplied ? 'ring-2 ring-glow ring-offset-1 ring-offset-base-800 text-glow' : ''}
                ${isToday && isApplied ? 'ring-2 ring-white/30 ring-offset-1 ring-offset-base-800' : ''}
              `}
            >{day}</button>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [records, setRecords] = useState({})
  const [pageLoading, setPageLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [activeTab, setActiveTab] = useState('calendar')
  const [signOutLoading, setSignOutLoading] = useState(false)

  // Lê o parâmetro ?tab=friends da URL (vindo do link de convite)
  useEffect(() => {
    if (router.query.tab === 'friends') {
      setActiveTab('friends')
    }
  }, [router.query.tab])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      await Promise.all([loadAllRecords(session.user.id), loadProfile(session.user.id)])
      setPageLoading(false)
    }
    init()
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('id, email, display_name, invite_code').eq('id', userId).single()
    if (data) setUserProfile(data)
  }

  const loadAllRecords = async (userId) => {
    const { data } = await supabase.from('minoxidil_registros').select('data_registro').eq('user_id', userId).eq('aplicado', true)
    const map = {}
    data?.forEach(r => { map[r.data_registro] = true })
    setRecords(map)
  }

  const handleToggle = useCallback(async (dateStr) => {
    if (toggling) return
    setToggling(dateStr)
    const isApplied = Boolean(records[dateStr])
    setRecords(prev => { const next = { ...prev }; if (isApplied) { delete next[dateStr] } else { next[dateStr] = true }; return next })
    try {
      if (isApplied) {
        const { error } = await supabase.from('minoxidil_registros').delete().eq('user_id', user.id).eq('data_registro', dateStr)
        if (error) throw error
      } else {
        const { error } = await supabase.from('minoxidil_registros').upsert({ user_id: user.id, data_registro: dateStr, aplicado: true }, { onConflict: 'user_id,data_registro' })
        if (error) throw error
      }
    } catch {
      setRecords(prev => { const next = { ...prev }; if (isApplied) { next[dateStr] = true } else { delete next[dateStr] }; return next })
    } finally { setToggling(null) }
  }, [records, toggling, user])

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }
  const goToToday = () => { const now = new Date(); setViewYear(now.getFullYear()); setViewMonth(now.getMonth()) }
  const handleSignOut = async () => { setSignOutLoading(true); await supabase.auth.signOut() }

  if (pageLoading) {
    return (
      <div className="min-h-dvh bg-base-900 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-glow border-t-transparent animate-spin" />
        <p className="text-base-400 text-sm font-body animate-pulse">Carregando...</p>
      </div>
    )
  }

  const { streak, totalApplied, appliedThisMonth, daysInMonth, monthPct } = calcStats(records)

  return (
    <>
      <Head><title>Minox Tracker</title></Head>
      <div className="min-h-dvh bg-base-900 flex flex-col">

        {/* Header */}
        <header className="sticky top-0 z-10 bg-base-900/95 backdrop-blur-sm border-b border-base-700">
          <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌿</span>
              <span className="font-display text-lg font-bold text-base-200 tracking-tight">MINOX</span>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-base-500 font-body truncate max-w-[140px]">{user?.email}</p>
              <button onClick={handleSignOut} disabled={signOutLoading} title="Sair"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-base-800 border border-base-600 text-base-400 hover:text-base-200 active:scale-90 transition-all">
                {signOutLoading
                  ? <span className="w-4 h-4 rounded-full border-2 border-base-400 border-t-transparent animate-spin" />
                  : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-base-700 max-w-lg mx-auto">
            {[{ key: 'calendar', label: '📅 Calendário' }, { key: 'friends', label: '👥 Amigos' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 text-sm font-semibold font-body transition-all duration-150
                  ${activeTab === tab.key ? 'text-glow border-b-2 border-glow' : 'text-base-400 hover:text-base-300 border-b-2 border-transparent'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">

          {activeTab === 'calendar' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex gap-3">
                <StatCard label="🔥 Sequência" value={streak} suffix=" dias" accent={streak > 0} />
                <StatCard label="✅ Total" value={totalApplied} />
                <StatCard label="📅 Este Mês" value={appliedThisMonth} suffix={`/${daysInMonth}`} />
              </div>
              <MonthProgress pct={monthPct} applied={appliedThisMonth} total={daysInMonth} />
              {streak >= 7 && (
                <div className="bg-glow-faint border border-glow-dim rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">{streak >= 30 ? '🏆' : streak >= 14 ? '⚡' : '🔥'}</span>
                  <div>
                    <p className="text-glow-bright text-sm font-semibold font-body">
                      {streak >= 30 ? `Incrível! ${streak} dias seguidos!` : streak >= 14 ? `Excelente! ${streak} dias seguidos!` : `Ótimo! ${streak} dias em sequência!`}
                    </p>
                    <p className="text-base-400 text-xs font-body">Continue assim 💪</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-base-800 border border-base-600 text-base-400 hover:text-base-200 active:scale-90 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={goToToday} className="flex flex-col items-center group">
                  <span className="font-display text-lg font-bold text-base-200 group-hover:text-glow transition-colors">{MONTH_NAMES[viewMonth]}</span>
                  <span className="font-mono text-xs text-base-500">{viewYear}</span>
                </button>
                <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-base-800 border border-base-600 text-base-400 hover:text-base-200 active:scale-90 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <Calendar year={viewYear} month={viewMonth} records={records} onToggle={handleToggle} toggling={toggling} />
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-glow" /><span className="text-xs text-base-400 font-body">Aplicado</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-base-700 border border-base-600" /><span className="text-xs text-base-400 font-body">Não aplicado</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-base-700 ring-2 ring-glow ring-offset-1 ring-offset-base-900" /><span className="text-xs text-base-400 font-body">Hoje</span></div>
              </div>
              <div className="bg-base-800/50 border border-base-700 rounded-xl px-4 py-3">
                <p className="text-xs text-base-500 font-body text-center leading-relaxed">💡 Toque em qualquer dia para marcar ou desmarcar a aplicação.</p>
              </div>
              <div className="h-4" />
            </div>
          )}

          {activeTab === 'friends' && (
            <Friends user={user} userProfile={userProfile} />
          )}

        </main>
      </div>
    </>
  )
}
