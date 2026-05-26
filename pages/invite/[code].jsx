import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabaseClient'

export default function InvitePage() {
  const router = useRouter()
  const { code } = router.query
  const [status, setStatus] = useState('loading') // loading | connecting | success | error | login_needed
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!code) return
    handleInvite()
  }, [code])

  const handleInvite = async () => {
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Save invite code and redirect to login
      localStorage.setItem('pending_invite_code', code)
      setStatus('login_needed')
      return
    }

    await processInvite(session.user.id, code)
  }

  const processInvite = async (userId, inviteCode) => {
    setStatus('connecting')

    // Find the owner of this invite code
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('invite_code', inviteCode)
      .limit(1)

    if (!profiles || profiles.length === 0) {
      setStatus('error')
      setMessage('Link de convite inválido ou expirado.')
      return
    }

    const inviter = profiles[0]

    if (inviter.id === userId) {
      setStatus('error')
      setMessage('Este é o seu próprio link de convite!')
      return
    }

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${inviter.id}),and(requester_id.eq.${inviter.id},addressee_id.eq.${userId})`)
      .limit(1)

    if (existing && existing.length > 0) {
      const s = existing[0].status

      // Já são amigos
      if (s === 'accepted') {
        setStatus('error')
        setMessage('Vocês já são amigos! 🎉')
        setTimeout(() => router.push('/dashboard?tab=friends'), 2500)
        return
      }

      // Pedido pendente — aceita automaticamente via link de convite
      if (s === 'pending') {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', existing[0].id)

        const name = inviter.display_name || inviter.email?.split('@')[0]
        if (error) {
          setStatus('error')
          setMessage('Erro ao aceitar convite. Tente novamente.')
        } else {
          setStatus('success')
          setMessage(`Você e ${name} agora são amigos! 🎉`)
          localStorage.removeItem('pending_invite_code')
          setTimeout(() => router.push('/dashboard?tab=friends'), 2500)
        }
        return
      }
    }

    // Create friendship as accepted directly (invite link = auto-accept)
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: inviter.id, addressee_id: userId, status: 'accepted' })

    if (error) {
      setStatus('error')
      setMessage('Erro ao conectar. Tente novamente.')
      return
    }

    const name = inviter.display_name || inviter.email?.split('@')[0]
    setStatus('success')
    setMessage(`Você e ${name} agora são amigos! 🎉`)
    localStorage.removeItem('pending_invite_code')
    setTimeout(() => router.push('/dashboard?tab=friends'), 2500)
  }

  const goToLogin = () => {
    router.push('/')
  }

  return (
    <>
      <Head><title>Convite — Minox Tracker</title></Head>
      <div className="min-h-dvh bg-base-900 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center animate-slide-up">

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-glow-muted border border-glow-dim mb-6">
            <span className="text-3xl">🌿</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-base-200 mb-2">MINOX</h1>

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 mt-8">
              <div className="w-8 h-8 rounded-full border-2 border-glow border-t-transparent animate-spin" />
              <p className="text-base-400 font-body text-sm">Verificando convite...</p>
            </div>
          )}

          {status === 'connecting' && (
            <div className="flex flex-col items-center gap-3 mt-8">
              <div className="w-8 h-8 rounded-full border-2 border-glow border-t-transparent animate-spin" />
              <p className="text-base-400 font-body text-sm">Conectando amizade...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-glow-faint border border-glow-dim rounded-2xl p-6 mt-6">
              <p className="text-4xl mb-3">🤝</p>
              <p className="text-glow-bright font-semibold font-body text-lg">{message}</p>
              <p className="text-base-400 text-sm font-body mt-2">Redirecionando...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-base-800 border border-base-600 rounded-2xl p-6 mt-6 space-y-4">
              <p className="text-base-300 font-body">{message}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3 rounded-xl bg-glow text-base-900 font-semibold font-body active:scale-95 transition-all"
              >
                Ir para o Dashboard
              </button>
            </div>
          )}

          {status === 'login_needed' && (
            <div className="bg-base-800 border border-base-600 rounded-2xl p-6 mt-6 space-y-4">
              <p className="text-base-300 font-body text-sm">
                Você precisa estar logado para aceitar este convite.
              </p>
              <p className="text-base-500 font-body text-xs">
                O convite será processado automaticamente após o login.
              </p>
              <button
                onClick={goToLogin}
                className="w-full py-3 rounded-xl bg-glow text-base-900 font-semibold font-body active:scale-95 transition-all"
              >
                Entrar ou Criar Conta
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
