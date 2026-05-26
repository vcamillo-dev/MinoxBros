import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// ─── Helpers ──────────────────────────────────────────────────
const toDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MONTH_NAMES = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez',
]
const WEEK_DAYS = ['D','S','T','Q','Q','S','S']

function calcFriendStats(records) {
  const today = new Date()
  const total = Object.keys(records).length

  let streak = 0
  const cur = new Date(today)
  while (records[toDateStr(cur)]) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }

  return { streak, total }
}

// ─── Mini Read-Only Calendar ──────────────────────────────────
function MiniCalendar({ records, year, month }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const today = toDateStr(new Date())

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="mt-3">
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-mono text-base-500 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="aspect-square" />
          const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const applied = Boolean(records[ds])
          const isToday = ds === today
          return (
            <div
              key={ds}
              className={`aspect-square rounded flex items-center justify-center text-xs font-mono
                ${applied ? 'bg-glow text-base-900 font-semibold' : 'bg-base-700 text-base-500'}
                ${isToday && !applied ? 'ring-1 ring-glow' : ''}
              `}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Friend Card ──────────────────────────────────────────────
function FriendCard({ friend, rank, currentUserId }) {
  const [expanded, setExpanded] = useState(false)
  const [records, setRecords] = useState({})
  const [loadingRecords, setLoadingRecords] = useState(false)

  const now = new Date()
  const [viewYear] = useState(now.getFullYear())
  const [viewMonth] = useState(now.getMonth())

  const loadRecords = useCallback(async () => {
    if (loadingRecords || Object.keys(records).length > 0) return
    setLoadingRecords(true)
    const { data } = await supabase
      .from('minoxidil_registros')
      .select('data_registro')
      .eq('user_id', friend.id)
      .eq('aplicado', true)
    const map = {}
    data?.forEach(r => { map[r.data_registro] = true })
    setRecords(map)
    setLoadingRecords(false)
  }, [friend.id])

  const toggleExpanded = () => {
    if (!expanded) loadRecords()
    setExpanded(e => !e)
  }

  const medals = ['🥇', '🥈', '🥉']
  const medal = rank <= 3 ? medals[rank - 1] : `#${rank}`

  const isYou = friend.id === currentUserId

  return (
    <div className={`bg-base-800 border rounded-xl overflow-hidden transition-all duration-200
      ${isYou ? 'border-glow/40' : 'border-base-600'}
    `}>
      <div className="p-4 flex items-center gap-3">
        {/* Rank */}
        <div className="w-8 text-center text-lg flex-shrink-0">
          {medal}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-base-200 font-body truncate text-sm">
              {friend.display_name || friend.email?.split('@')[0]}
            </p>
            {isYou && (
              <span className="text-xs bg-glow-muted text-glow px-1.5 py-0.5 rounded-full font-body">
                você
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs font-mono text-base-400">
              🔥 {friend.streak} dias
            </span>
            <span className="text-xs font-mono text-base-400">
              ✅ {friend.total} total
            </span>
          </div>
        </div>

        {/* Expand button */}
        {!isYou && (
          <button
            onClick={toggleExpanded}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-base-700
                       text-base-400 hover:text-base-200 active:scale-90 transition-all flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded calendar */}
      {expanded && !isYou && (
        <div className="px-4 pb-4 border-t border-base-700 pt-3">
          <p className="text-xs text-base-500 font-body mb-1">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          {loadingRecords ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 rounded-full border-2 border-glow border-t-transparent animate-spin" />
            </div>
          ) : (
            <MiniCalendar records={records} year={viewYear} month={viewMonth} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pending Request Card ─────────────────────────────────────
function PendingCard({ request, onAccept, onReject, loading }) {
  return (
    <div className="bg-base-800 border border-yellow-600/30 rounded-xl p-4 flex items-center gap-3">
      <span className="text-xl">👤</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-base-200 font-body truncate">
          {request.profiles?.display_name || request.profiles?.email?.split('@')[0]}
        </p>
        <p className="text-xs text-base-500 font-body">quer ser seu amigo</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(request.id)}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-glow text-base-900
                     active:scale-90 transition-all text-sm font-bold"
        >
          ✓
        </button>
        <button
          onClick={() => onReject(request.id)}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-base-700 text-base-400
                     hover:bg-red-900/40 hover:text-red-400 active:scale-90 transition-all text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Main Friends Component ───────────────────────────────────
export default function Friends({ user, userProfile }) {
  const [friends, setFriends] = useState([])
  const [pendingReceived, setPendingReceived] = useState([])
  const [loading, setLoading] = useState(true)
  const [addEmail, setAddEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addMsg, setAddMsg] = useState({ type: '', text: '' })
  const [copied, setCopied] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const inviteLink = userProfile?.invite_code
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${userProfile.invite_code}`
    : ''

  // ── Load friends ─────────────────────────────────────────────
  const loadFriends = useCallback(async () => {
    setLoading(true)

    // Load accepted friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    // Get friend IDs
    const friendIds = friendships?.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    ) || []

    // Include self in ranking
    const allIds = [user.id, ...friendIds]

    // Load profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', allIds)

    // Load all their records
    const { data: allRecords } = await supabase
      .from('minoxidil_registros')
      .select('user_id, data_registro')
      .in('user_id', allIds)
      .eq('aplicado', true)

    // Build records map per user
    const recordsByUser = {}
    allRecords?.forEach(r => {
      if (!recordsByUser[r.user_id]) recordsByUser[r.user_id] = {}
      recordsByUser[r.user_id][r.data_registro] = true
    })

    // Build friends with stats
    const withStats = profiles?.map(p => {
      const recs = recordsByUser[p.id] || {}
      const { streak, total } = calcFriendStats(recs)
      return { ...p, streak, total }
    }) || []

    // Sort by streak desc, then total desc
    withStats.sort((a, b) => b.streak - a.streak || b.total - a.total)
    setFriends(withStats)

    // Load pending requests received
    const { data: pending } = await supabase
      .from('friendships')
      .select('id, requester_id, profiles!friendships_requester_id_fkey(display_name, email)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')

    setPendingReceived(pending || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadFriends() }, [loadFriends])

  // ── Add friend by email ──────────────────────────────────────
  const handleAddByEmail = async () => {
    if (!addEmail.trim()) return
    setAddLoading(true)
    setAddMsg({ type: '', text: '' })

    // Find user by email
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('email', addEmail.trim().toLowerCase())
      .limit(1)

    if (!profiles || profiles.length === 0) {
      setAddMsg({ type: 'error', text: 'Nenhum usuário encontrado com esse e-mail.' })
      setAddLoading(false)
      return
    }

    const target = profiles[0]
    if (target.id === user.id) {
      setAddMsg({ type: 'error', text: 'Você não pode se adicionar.' })
      setAddLoading(false)
      return
    }

    // Check if already friends or pending
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`)
      .limit(1)

    if (existing && existing.length > 0) {
      const status = existing[0].status
      setAddMsg({
        type: 'error',
        text: status === 'accepted' ? 'Vocês já são amigos!' : 'Pedido já enviado.',
      })
      setAddLoading(false)
      return
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: target.id, status: 'pending' })

    if (error) {
      setAddMsg({ type: 'error', text: 'Erro ao enviar pedido. Tente novamente.' })
    } else {
      setAddMsg({
        type: 'success',
        text: `Pedido enviado para ${target.display_name || target.email}! ✓`,
      })
      setAddEmail('')
    }
    setAddLoading(false)
  }

  // ── Accept friend request ────────────────────────────────────
  const handleAccept = async (friendshipId) => {
    setActionLoading(true)
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    await loadFriends()
    setActionLoading(false)
  }

  // ── Reject friend request ────────────────────────────────────
  const handleReject = async (friendshipId) => {
    setActionLoading(true)
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    await loadFriends()
    setActionLoading(false)
  }

  // ── Copy invite link ─────────────────────────────────────────
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-glow border-t-transparent animate-spin" />
        <p className="text-base-400 text-sm font-body animate-pulse">Carregando amigos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Pending requests ── */}
      {pendingReceived.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-base-400 font-body uppercase tracking-wider px-1">
            Pedidos recebidos ({pendingReceived.length})
          </h3>
          {pendingReceived.map(req => (
            <PendingCard
              key={req.id}
              request={req}
              onAccept={handleAccept}
              onReject={handleReject}
              loading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* ── Add friend ── */}
      <div className="bg-base-800 border border-base-600 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-base-200 font-body">Adicionar Amigo</h3>

        {/* By email */}
        <div className="flex gap-2">
          <input
            type="email"
            value={addEmail}
            onChange={e => { setAddEmail(e.target.value); setAddMsg({ type: '', text: '' }) }}
            onKeyDown={e => e.key === 'Enter' && handleAddByEmail()}
            placeholder="e-mail do amigo"
            className="flex-1 bg-base-900 border border-base-600 rounded-xl px-3 py-2.5 text-sm
                       text-base-200 font-body placeholder-base-500
                       focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow/30
                       transition-colors"
          />
          <button
            onClick={handleAddByEmail}
            disabled={addLoading || !addEmail.trim()}
            className="px-4 py-2.5 rounded-xl bg-glow text-base-900 font-semibold text-sm font-body
                       disabled:opacity-40 active:scale-95 transition-all whitespace-nowrap"
          >
            {addLoading ? (
              <span className="w-4 h-4 rounded-full border-2 border-base-900 border-t-transparent animate-spin inline-block" />
            ) : 'Adicionar'}
          </button>
        </div>

        {/* Feedback message */}
        {addMsg.text && (
          <p className={`text-xs font-body px-1 ${addMsg.type === 'error' ? 'text-red-400' : 'text-glow'}`}>
            {addMsg.text}
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-base-700" />
          <span className="text-xs text-base-500 font-body">ou compartilhe seu link</span>
          <div className="flex-1 h-px bg-base-700" />
        </div>

        {/* Invite link */}
        <div className="flex gap-2">
          <div className="flex-1 bg-base-900 border border-base-700 rounded-xl px-3 py-2.5 text-xs
                          text-base-500 font-mono truncate">
            {inviteLink || 'carregando...'}
          </div>
          <button
            onClick={copyInviteLink}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold font-body whitespace-nowrap
                        active:scale-95 transition-all duration-150
                        ${copied
                          ? 'bg-glow-muted text-glow border border-glow-dim'
                          : 'bg-base-700 text-base-200 hover:bg-base-600'
                        }`}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* ── Ranking ── */}
      {friends.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-base-400 font-body uppercase tracking-wider px-1">
            🏆 Ranking — {friends.length} {friends.length === 1 ? 'participante' : 'participantes'}
          </h3>
          {friends.map((friend, idx) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              rank={idx + 1}
              currentUserId={user.id}
            />
          ))}
        </div>
      )}

      {friends.length <= 1 && (
        <div className="text-center py-8">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-base-400 text-sm font-body">
            Adicione amigos para comparar a consistência!
          </p>
        </div>
      )}

    </div>
  )
}
