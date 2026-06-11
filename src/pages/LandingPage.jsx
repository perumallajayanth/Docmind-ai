import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  MessageSquare,
  BrainCircuit,
  Sparkles,
  Mic,
  ArrowRight,
  Globe,
  FileText,
  Award,
  Volume2,
  Layers
} from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleContinueAsGuest = async () => {
    // 1. Terminate any active Supabase sessions to ensure no data leak
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out before Guest access:', err)
    }
    // 2. Set the guest mode flag
    localStorage.setItem('docmind_guest', 'true')
    navigate('/dashboard')
  }

  const handleContinueWithGoogle = async () => {
    setGoogleLoading(true)
    // Clear any guest state
    localStorage.removeItem('docmind_guest')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    })

    if (error) {
      console.error(error)
      setGoogleLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-x-hidden font-sans relative">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      {/* Header / Navigation */}
      <header className="border-b border-neutral-800/50 backdrop-blur-md sticky top-0 z-50 bg-neutral-950/80">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <BrainCircuit className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              DocMind <span className="text-violet-500">AI</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={handleContinueAsGuest}
              className="text-sm font-medium hover:text-white text-neutral-300 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleContinueAsGuest}
              className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700/60 hover:bg-neutral-700 hover:text-white transition-all duration-200"
            >
              Guest Access
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-6 text-center max-w-5xl mx-auto z-10">
        {/* Sparkles / Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-400 mb-8 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Transform the way you study PDFs</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight text-white mb-8">
          Supercharge Your Learning with{' '}
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Conversational PDF AI
          </span>
        </h1>

        {/* Hero Subheading */}
        <p className="text-base sm:text-lg md:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed mb-12">
          Upload textbooks, research articles, or manuals. Instantly generate quizzes, review active flashcards with optimized spaced repetition, and chat directly with your files using high-fidelity browser-native speech.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-20">
          <button
            onClick={handleContinueAsGuest}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-xl shadow-violet-600/30 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Continue as Guest</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={handleContinueWithGoogle}
            disabled={googleLoading}
            className="w-full sm:w-auto px-8 py-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-neutral-200 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
            ) : (
              <Globe className="w-5 h-5" />
            )}
            <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Interactive Workspace Mockup */}
        <div className="relative rounded-2xl border border-neutral-800/80 bg-neutral-900/30 backdrop-blur-xl p-4 shadow-2xl shadow-violet-950/20 overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/5 via-transparent to-indigo-600/5 opacity-50 pointer-events-none" />

          {/* Header Bar Mockup */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="text-xs text-neutral-500 font-mono ml-2">physics_quantum_mechanics.pdf</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <span className="px-2.5 py-1 rounded bg-neutral-800 border border-neutral-700/50">Page 12 of 342</span>
            </div>
          </div>

          {/* Double-Panel Split Layout Mockup */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[350px] sm:h-[450px]">
            {/* Left Page Render Mockup */}
            <div className="md:col-span-6 rounded-xl border border-neutral-850 bg-neutral-950/50 p-6 flex flex-col justify-between overflow-y-auto text-left relative scrollbar-none">
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Section 3.2</span>
                <h3 className="text-lg font-bold text-white leading-snug">Quantum Superposition Mechanics</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Superposition is a fundamental principle of quantum mechanics. It states that any physical system—such as an electron—exists in all its theoretically possible states simultaneously.
                </p>
                <div className="p-3.5 rounded-lg bg-violet-950/25 border border-violet-900/35 text-[11px] text-violet-300 leading-normal">
                  <strong className="text-white">Equation 3.4:</strong> $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$ representing the state vector of a simple two-level qubit system.
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Only upon measurement does the system collapse into one of the definite basis eigenstates, determined by the probability coefficients amplitude square.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-900 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                <span>© MIT Physics Laboratory Course</span>
                <span>Page 12</span>
              </div>
            </div>

            {/* Right Chat Render Mockup */}
            <div className="md:col-span-6 rounded-xl border border-neutral-850 bg-neutral-950/50 p-4 flex flex-col justify-between overflow-hidden relative">
              <div className="space-y-3 overflow-y-auto flex-1 text-left pr-1 scrollbar-none">
                {/* User Message */}
                <div className="flex flex-col items-end">
                  <div className="rounded-2xl rounded-tr-sm bg-neutral-850 border border-neutral-850 px-3.5 py-2 text-xs text-neutral-200 max-w-[85%]">
                    Can you explain superposition in simple terms?
                  </div>
                  <span className="text-[9px] text-neutral-500 mt-1 mr-1">10:42 AM</span>
                </div>

                {/* Assistant Response with Citation */}
                <div className="flex flex-col items-start">
                  <div className="rounded-2xl rounded-tl-sm bg-violet-600/10 border border-violet-900/30 px-3.5 py-2.5 text-xs text-neutral-200 max-w-[85%] leading-relaxed">
                    Quantum superposition is like a spinning coin. While spinning, it's in a state of both heads and tails at once. Only when you stop it (measurement) does it land on head or tail.
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-[10px] font-bold text-violet-300 ml-1.5 cursor-pointer hover:bg-violet-500/30 transition-colors">
                      <FileText className="w-2.5 h-2.5" />
                      <span>Page 12</span>
                    </span>
                  </div>
                  <span className="text-[9px] text-neutral-500 mt-1 ml-1">DocMind AI • Streaming</span>
                </div>
              </div>

              {/* Chat Input Mockup */}
              <div className="pt-3 border-t border-neutral-850 flex gap-2">
                <div className="flex-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-left text-neutral-500 text-xs flex items-center justify-between">
                  <span>Ask a question about page 12...</span>
                  <Mic className="w-3.5 h-3.5 text-neutral-400 hover:text-violet-400 cursor-pointer" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center justify-center cursor-pointer text-white">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="border-t border-neutral-900 bg-neutral-950 py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-18">
            <span className="text-xs font-bold text-violet-500 uppercase tracking-widest">Active Study Hub</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 leading-tight">
              Unleash the Power of Interactive Study
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base mt-4 leading-relaxed">
              We combine advanced contextual document parsing with active learning models so you remember more in less time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl border border-neutral-850 bg-neutral-900/20 backdrop-blur hover:border-violet-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Conversational PDF Chat</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Interact with your PDFs in natural conversations. Extract specific insights and track source assertions directly back to original page coordinates.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl border border-neutral-850 bg-neutral-900/20 backdrop-blur hover:border-violet-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                <Award className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Quiz Generator</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Test your knowledge by generating structured multiple-choice quizzes automatically from any page or custom text range. Log scores to review progress.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl border border-neutral-850 bg-neutral-900/20 backdrop-blur hover:border-violet-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <BrainCircuit className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Spaced Repetition</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Turn your PDFs into custom study cards. Our dynamic backend schedules active recall sessions using the highly optimized SuperMemo-2 scheduling model.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-2xl border border-neutral-850 bg-neutral-900/20 backdrop-blur hover:border-violet-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <Mic className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Speech-to-Text Input</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Use your voice to ask follow-up questions. Hands-free transcription integrates directly with browser-native recording APIs for fast responses.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-2xl border border-neutral-850 bg-neutral-900/20 backdrop-blur hover:border-violet-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                <Volume2 className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Voice Synthesis Readout</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Listen to answers while studying the document. Choose between a wide variety of hardware voices for natural-sounding readouts.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-2xl border border-neutral-850 bg-neutral-900/20 backdrop-blur hover:border-violet-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Layers className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Multi-Document Library</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Manage all your textbooks, journals, and slides in one workspace. Upload files, review details, and delete items with ease.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-12 px-6 relative z-10 text-neutral-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center">
              <BrainCircuit className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-neutral-300">DocMind AI</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} DocMind AI Inc. All rights reserved. Built for modern student success.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
