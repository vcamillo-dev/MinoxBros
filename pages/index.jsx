import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        setCheckingSession(false)
      }
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMsg('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(traduzirErro(error.message))
      } else {
        const pendingCode = localStorage.getItem('pending_invite_code')
        if (pendingCode) {
          router.push(`/invite/${pendingCode}`)
        } else {
          router.push('/dashboard')
        }
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(traduzirErro(error.message))
      } else {
        setSuccessMsg('Cadastro realizado! Verifique seu e-mail para confirmar a conta.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  const traduzirErro = (msg) => {
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
    if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
    if (msg.includes('User already registered')) return 'Este e-mail já possui uma conta.'
    if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.'
    return msg
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setSuccessMsg('')
  }

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-base-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-glow border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Minox Tracker — Entrar</title>
      </Head>

      <div className="min-h-dvh bg-base-900 flex flex-col items-center justify-center px-5 py-10">

        {/* Background subtle pattern */}
        <div
          className="fixed inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(63,185,80,0.08) 0%, transparent 60%),
                              radial-gradient(circle at 80% 80%, rgba(63,185,80,0.05) 0%, transparent 60%)`,
          }}
        />

        <div className="w-full max-w-sm relative animate-slide-up">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-glow-muted border border-glow-dim mb-4 shadow-lg shadow-glow/10">
              <span className="text-3xl">🌿</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-base-200 tracking-tight">
              MINOX
            </h1>
            <p className="text-base-400 text-sm font-body mt-1">
              Rastreie sua consistência diária
            </p>
          </div>

          {/* Card */}
          <div className="bg-base-800 border border-base-600 rounded-2xl p-6 shadow-2xl shadow-black/50">

            {/* Mode tabs */}
            <div className="flex bg-base-700 rounded-xl p-1 mb-6">
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`
                    flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 font-body
                    ${mode === m
                      ? 'bg-base-900 text-base-200 shadow-sm'
                      : 'text-base-400 hover:text-base-300'
                    }
                  `}
                >
                  {m === 'login' ? 'Entrar' : 'Criar Conta'}
                </button>
              ))}
            </div>

            {/* Success message */}
            {successMsg && (
              <div className="mb-4 px-4 py-3 bg-glow-faint border border-glow-dim rounded-xl text-glow-bright text-sm font-body">
                {successMsg}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-400 text-sm font-body">
                {error}
              </div>
            )}

            {/* Form */}
            <div onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-base-400 mb-1.5 font-body uppercase tracking-wider">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="w-full bg-base-900 border border-base-600 rounded-xl px-4 py-3.5 text-base-200
                               text-base font-body placeholder-base-500
                               focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow/30
                               transition-colors duration-150"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-base-400 mb-1.5 font-body uppercase tracking-wider">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full bg-base-900 border border-base-600 rounded-xl px-4 py-3.5 text-base-200
                               text-base font-body placeholder-base-500
                               focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow/30
                               transition-colors duration-150"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading || !email || !password}
                  className={`
                    w-full py-3.5 rounded-xl font-semibold text-base font-body
                    transition-all duration-200 active:scale-95 mt-2
                    ${loading || !email || !password
                      ? 'bg-glow-muted text-glow-dim cursor-not-allowed opacity-60'
                      : 'bg-glow text-base-900 hover:bg-glow-bright shadow-lg shadow-glow/20 active:shadow-sm'
                    }
                  `}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-base-900 border-t-transparent animate-spin inline-block" />
                      Carregando...
                    </span>
                  ) : (
                    mode === 'login' ? 'Entrar' : 'Criar Conta'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-base-500 text-xs mt-6 font-body">
            Seus dados são privados e seguros 🔒
          </p>
        </div>
      </div>
    </>
  )
}
