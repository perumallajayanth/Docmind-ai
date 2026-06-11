import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  BookOpen,
  MessageSquare,
  BrainCircuit,
  Award,
  Settings,
  Plus,
  Search,
  UploadCloud,
  Trash2,
  Mic,
  Volume2,
  Sparkles,
  ArrowRight,
  FileText,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LogOut,
  Menu,
  ChevronRight,
  TrendingUp,
  Clock,
  LayoutDashboard,
  Zap,
  Shield,
  Send,
  Layers,
  X,
  Moon,
  Sun
} from 'lucide-react'
import { extractTextFromPdf } from '../utils/pdfParser'
import { chunkText } from '../utils/chunkText'
import { askAI } from '../services/openrouter'
import { generateQuiz } from '../services/quizGenerator'
import { generateFlashcards } from '../services/flashcardGenerator'
import { retrieveRelevantChunks } from '../utils/retrieveChunks'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard, pdfs, chat, quizzes, flashcards, settings
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('docmind_theme') || 'dark')
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('')
  const [hasSavedKey, setHasSavedKey] = useState(false)
  const [activeModal, setActiveModal] = useState(null)

  const [pdfs, setPdfs] = useState([])

  const [recentChats, setRecentChats] = useState([])
  // Chat Section State
  const [selectedPdf, setSelectedPdf] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pdfPage, setPdfPage] = useState(1) // Changed initial default from 42 to 1
  const [pdfChunks, setPdfChunks] = useState([]) // State for stored PDF chunks

  const chatEndRef = useRef(null)

  // Scroll to bottom when messages change or tab switches to chat
  useEffect(() => {
    if (activeTab === 'chat') {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [chatMessages, activeTab])

  // While AI typing animation is active, automatically keep scrolling down
  useEffect(() => {
    if (activeTab === 'chat' && isTyping) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      const intervalId = setInterval(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 200)
      return () => clearInterval(intervalId)
    }
  }, [isTyping, activeTab])

  // User auth state
  const [currentUser, setCurrentUser] = useState(null)

  // Quiz Section State
  const [quizQuestions, setQuizQuestions] = useState([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [quizError, setQuizError] = useState(null)
  const [selectedQuizCount, setSelectedQuizCount] = useState(5)
  const [quizHistory, setQuizHistory] = useState([]) // For tracking quiz score history

  // Flashcards Section State
  const [flashcards, setFlashcards] = useState([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false)
  const [flashcardsError, setFlashcardsError] = useState(null)
  const [selectedFlashcardCount, setSelectedFlashcardCount] = useState(5)
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState(null)
  const [flashcardReviews, setFlashcardReviews] = useState({ correct: 0, total: 0 }) // For dynamic study retention

  // Speech TTS Voices State
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)

  // Simulated drag-and-drop state
  const [isDragging, setIsDragging] = useState(false)
  const [extractedPdf, setExtractedPdf] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isHydratingPdf, setIsHydratingPdf] = useState(false)

  const getRelativeDateLabel = (dateValue) => {
    if (!dateValue) return 'recently'

    const uploadedAt = new Date(dateValue)
    const diffMs = Date.now() - uploadedAt.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (Number.isNaN(uploadedAt.getTime())) return 'recently'
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} min ago`
    if (diffHours < 24) return `${diffHours} hr ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return uploadedAt.toLocaleDateString()
  }

  const buildPdfFromRow = (row) => ({
    id: row.id,
    name: row.file_name,
    url: row.file_url,
    storagePath: row.storage_path,
    size: row.file_size
      ? `${(row.file_size / (1024 * 1024)).toFixed(2)} MB`
      : 'Stored',
    pages: row.page_count || 0,
    chunks: row.chunk_count || 0,
    date: getRelativeDateLabel(row.created_at),
    topic: 'User Ingested',
    charCount: row.char_count || 0,
    fullText: row.full_text || '',
    pageTexts: row.page_texts || []
  })

  const getStoragePathFromPdf = (pdf) => {
    if (pdf.storagePath) return pdf.storagePath
    if (!pdf.url || pdf.url.startsWith('http')) return null

    return pdf.url
  }

  const getPublicStoragePathFromUrl = (url) => {
    if (!url || !url.startsWith('http')) return null

    const marker = '/storage/v1/object/public/pdfs/'
    const markerIndex = url.indexOf(marker)
    if (markerIndex === -1) return null

    return decodeURIComponent(url.slice(markerIndex + marker.length))
  }

  const downloadStoredPdf = async (pdf) => {
    const storagePath = getStoragePathFromPdf(pdf) || getPublicStoragePathFromUrl(pdf.url)

    if (storagePath) {
      const { data, error } = await supabase.storage
        .from('pdfs')
        .download(storagePath)

      if (!error && data) return data
    }

    if (pdf.url?.startsWith('http')) {
      const response = await fetch(pdf.url)
      if (!response.ok) {
        throw new Error(`Unable to download stored PDF (${response.status})`)
      }
      return response.blob()
    }

    throw new Error('Stored PDF file path is missing.')
  }

  const saveParsedPdfToRow = async (pdf, result, chunks) => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('pdfs')
      .update({
        page_count: result.pageCount,
        char_count: result.charCount,
        full_text: result.text,
        page_texts: result.pages,
        chunk_count: chunks.length
      })
      .eq('id', pdf.id)
      .eq('user_id', user.id)

    if (error?.code === 'PGRST204' || error?.message?.includes('column')) {
      console.warn("PDF table is missing extended persistence columns. Parsed text will only live in this browser session.", error)
      return
    }

    if (error) {
      console.error("PDF PARSED TEXT UPDATE ERROR", error)
    }
  }

  const activatePdf = async (pdf) => {
    setSelectedPdf(pdf)
    setPdfPage(1)
    setQuizQuestions([])
    setQuizSubmitted(false)
    setFlashcards([])
    setCurrentCardIndex(0)

    if (pdf.fullText) {
      const chunks = chunkText(pdf.fullText)
      setPdfChunks(chunks)
      setExtractedPdf({
        fileName: pdf.name,
        pageCount: pdf.pages,
        charCount: pdf.charCount,
        previewText: pdf.fullText.substring(0, 1000),
        fullText: pdf.fullText,
        pages: Array.isArray(pdf.pageTexts) && pdf.pageTexts.length > 0
          ? pdf.pageTexts
          : [{ pageNumber: 1, text: pdf.fullText }],
        chunkCount: chunks.length
      })
    } else {
      setIsHydratingPdf(true)

      try {
        const storedPdfBlob = await downloadStoredPdf(pdf)
        const storedPdfFile = new File([storedPdfBlob], pdf.name, { type: 'application/pdf' })
        const result = await extractTextFromPdf(storedPdfFile)
        const chunks = chunkText(result.text)

        setPdfChunks(chunks)
        setExtractedPdf({
          fileName: pdf.name,
          pageCount: result.pageCount,
          charCount: result.charCount,
          previewText: result.text.substring(0, 1000),
          fullText: result.text,
          pages: result.pages,
          chunkCount: chunks.length
        })

        setPdfs(prev => prev.map(item => (
          item.id === pdf.id
            ? {
              ...item,
              pages: result.pageCount,
              chunks: chunks.length,
              charCount: result.charCount,
              fullText: result.text,
              pageTexts: result.pages
            }
            : item
        )))

        saveParsedPdfToRow(pdf, result, chunks)
      } catch (error) {
        console.error("Error restoring saved PDF content:", error)
        setPdfChunks([])
        setExtractedPdf(null)
      } finally {
        setIsHydratingPdf(false)
      }
    }
  }

  const loadUserPdfs = async (userId) => {
    if (!userId) return

    const { data, error } = await supabase
      .from('pdfs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error loading user PDFs:", error)
      return
    }

    setPdfs((data || []).map(buildPdfFromRow))
  }

  // Load chat history filtered by active PDF chat session (chat_id)
  const loadChatHistory = async (pdfName = null) => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const docFilter = pdfName || (extractedPdf?.fileName || 'General Workspace')

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('chat_id', docFilter)
      .order('created_at')

    if (error) {
      console.error("Error loading chat history:", error)
      return
    }

    const formatted = data.map(msg => ({
      sender: msg.role === 'user' ? 'user' : 'assistant',
      text: msg.content,
      citations: []
    }))

    setChatMessages(formatted)
  }

  // Load unique chat sessions from Supabase chat_messages grouped by chat_id
  const loadRecentChats = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error loading recent chats:", error)
      return
    }

    if (!data || data.length === 0) {
      setRecentChats([])
      return
    }

    const chatsMap = {}
    data.forEach(msg => {
      const docName = msg.chat_id || 'General Workspace'
      if (!chatsMap[docName]) {
        chatsMap[docName] = {
          id: msg.id,
          title: msg.content.substring(0, 45) + (msg.content.length > 45 ? '...' : ''),
          docName: docName,
          latestMessage: msg.content,
          timestamp: msg.created_at,
          date: new Date(msg.created_at).toLocaleDateString(),
          page: 1
        }
      }
    })

    setRecentChats(Object.values(chatsMap))
  }

  // Voice selection helper
  const getStrongestVoice = (voicesList) => {
    const preferredVoices = [
      'Google UK English Male',
      'Microsoft David',
      'Microsoft Mark',
      'Google US English'
    ]
    for (const pref of preferredVoices) {
      const found = voicesList.find(v => v.name.includes(pref) || v.name === pref)
      if (found) return found
    }
    const englishVoice = voicesList.find(v => v.lang.startsWith('en'))
    return englishVoice || voicesList[0] || null
  }

  const loadUserOpenRouterKey = async (userId) => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('openrouter_key')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error

      if (data?.openrouter_key) {
        setOpenrouterKeyInput(data.openrouter_key)
        setHasSavedKey(true)
      } else {
        setOpenrouterKeyInput('')
        setHasSavedKey(false)
      }
    } catch (err) {
      console.error('Error loading OpenRouter settings:', err)
    }
  }

  // 1. Initial authentication load
  useEffect(() => {
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        loadUserPdfs(user.id)
        loadRecentChats()
        loadUserOpenRouterKey(user.id)
      }
    }
    initAuth()
  }, [])

  // 2. Load chat history when active document changes
  useEffect(() => {
    if (currentUser) {
      const docFilter = extractedPdf?.fileName || 'General Workspace'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadChatHistory(docFilter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedPdf, currentUser])

  useEffect(() => {
    const shouldRestorePdf =
      currentUser &&
      !extractedPdf &&
      !isExtracting &&
      !isHydratingPdf &&
      pdfs.length > 0 &&
      ['chat', 'quizzes', 'flashcards'].includes(activeTab)

    if (shouldRestorePdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      activatePdf(selectedPdf || pdfs[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser, extractedPdf, isExtracting, isHydratingPdf, pdfs, selectedPdf])

  // 3. Load text-to-speech voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices()
      setVoices(allVoices)

      const strongest = getStrongestVoice(allVoices)
      setSelectedVoice(strongest)
    }

    updateVoices()
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])

  // Handlers
  const handleGenerateQuiz = async () => {
    if (!currentUser) {
      setActiveModal('quiz')
      return
    }
    if (!extractedPdf?.fullText) {
      alert('Upload a PDF first')
      return
    }

    setIsGeneratingQuiz(true)
    setQuizError(null)
    setQuizSubmitted(false)

    try {
      const generated = await generateQuiz(extractedPdf.fullText, selectedQuizCount)
      setQuizQuestions(generated)
    } catch (err) {
      setQuizError(err.message || 'Failed to generate quiz. Please try again.')
    } finally {
      setIsGeneratingQuiz(false)
    }
  }
  const handleLogout = async () => {
    localStorage.removeItem('docmind_guest')
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleLoginWithGoogle = async () => {
    localStorage.removeItem('docmind_guest')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    })
    if (error) {
      console.error('Google Sign In Error:', error)
      alert(`Sign In Error: ${error.message}`)
    }
  }

  const handleSaveKey = async () => {
    const trimmed = openrouterKeyInput.trim()
    if (!trimmed) {
      alert('Please enter a valid OpenRouter API Key.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You must be logged in to save settings.')
      return
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          openrouter_key: trimmed,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setOpenrouterKeyInput(trimmed)
      setHasSavedKey(true)
      alert('OpenRouter API Key saved successfully!')
    } catch (err) {
      console.error('Error saving API key:', err)
      alert(`Error saving API key: ${err.message || err}`)
    }
  }

  const handleRemoveKey = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You must be logged in to modify settings.')
      return
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          openrouter_key: null,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setOpenrouterKeyInput('')
      setHasSavedKey(false)
      alert('OpenRouter API Key removed successfully!')
    } catch (err) {
      console.error('Error removing API key:', err)
      alert(`Error removing API key: ${err.message || err}`)
    }
  }

  const handleClearActiveChatHistory = async () => {
    const activeChatId = extractedPdf?.fileName || 'General Workspace'

    setChatMessages([
      { sender: 'assistant', text: 'History reset! Upload a PDF to start a conversational RAG session.', citations: [] }
    ])

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('chat_id', activeChatId)

    if (error) {
      console.error("Error clearing chat messages:", error)
      alert(`Error clearing chat messages: ${error.message}`)
      return
    }

    setRecentChats(prev => prev.filter(chat => chat.docName !== activeChatId))
  }

  const handleDeleteChatSession = async (docName, e) => {
    if (e) e.stopPropagation()

    const confirmDelete = window.confirm(`Are you sure you want to permanently delete the chat history for "${docName}"?`)
    if (!confirmDelete) return

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('chat_id', docName)

    if (error) {
      console.error("Error deleting chat session:", error)
      alert(`Error deleting chat session: ${error.message}`)
      return
    }

    setRecentChats(prev => prev.filter(chat => chat.docName !== docName))

    const activeChatId = extractedPdf?.fileName || 'General Workspace'
    if (docName === activeChatId) {
      setChatMessages([
        { sender: 'assistant', text: 'History reset! Upload a PDF to start a conversational RAG session.', citations: [] }
      ])
      setSelectedPdf(null)
      setExtractedPdf(null)
      setPdfChunks([])
    }
  }

  const handleClearAllChatHistory = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete ALL chat history sessions? This cannot be undone.")
    if (!confirmDelete) return

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error("Error clearing all chat history:", error)
      alert(`Error clearing all chat history: ${error.message}`)
      return
    }

    setRecentChats([])
    setChatMessages([
      { sender: 'assistant', text: 'History reset! Upload a PDF to start a conversational RAG session.', citations: [] }
    ])
    setSelectedPdf(null)
    setExtractedPdf(null)
    setPdfChunks([])
    alert('All chat history cleared successfully!')
  }

  const handleGenerateFlashcards = async () => {
    if (!currentUser) {
      setActiveModal('flashcard')
      return
    }
    if (!extractedPdf?.fullText) {
      alert('Upload a PDF first')
      return
    }

    setIsGeneratingFlashcards(true)
    setFlashcardsError(null)
    setCurrentCardIndex(0)

    try {
      const generated = await generateFlashcards(extractedPdf.fullText, selectedFlashcardCount)
      setFlashcards(generated)
    } catch (err) {
      setFlashcardsError(err.message || 'Failed to generate flashcards. Please try again.')
    } finally {
      setIsGeneratingFlashcards(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return

    const question = messageInput
    const {
      data: { user }
    } = await supabase.auth.getUser()

    const activeChatId = extractedPdf?.fileName || 'General Workspace'

    setChatMessages(prev => [
      ...prev,
      {
        sender: 'user',
        text: question,
        citations: []
      }
    ])

    if (user) {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          role: 'user',
          content: question,
          chat_id: activeChatId
        })
      if (error) {
        console.error('INSERT USER ERROR:', error)
      }
    }

    setMessageInput('')
    setIsTyping(true)

    try {
      const context = retrieveRelevantChunks(question, pdfChunks)
        .map(chunk => chunk.content)
        .join("\n\n")

      const history = chatMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }))

      const answer = await askAI(
        question,
        context,
        history
      )

      if (user) {
        const { error: aiError } = await supabase
          .from('chat_messages')
          .insert({
            user_id: user.id,
            role: 'assistant',
            content: answer,
            chat_id: activeChatId
          })
        if (aiError) {
          console.error('INSERT AI ERROR:', aiError)
        }
      }

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: answer,
          citations: []
        }
      ])

      if (user) {
        loadRecentChats() // Refresh dashboard recent chats list
      }
    } catch (error) {
      console.error(error)

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Error generating answer.',
          citations: []
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const toggleFlashcardFlip = (id) => {
    setFlashcards(prev => prev.map(card => {
      if (card.id === id) return { ...card, flipped: !card.flipped }
      return card
    }))
  }

  const selectQuizOption = (qIndex, oIndex) => {
    if (quizSubmitted) return
    setQuizQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) return { ...q, selected: oIndex }
      return q
    }))
  }

  const handleFlashcardRating = (id, rating) => {
    const isCorrect = rating === 'good' || rating === 'easy'
    setFlashcardReviews(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))

    alert(`Card rescheduled! Next review in ${rating === 'easy' ? '6 days' : rating === 'good' ? '3 days' : '1 day'} (SM-2 calculated).`)
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    } else {
      alert('You have completed reviewing all active flashcards in this deck!')
      setCurrentCardIndex(0)
    }
  }

  const handleSubmitQuiz = () => {
    if (quizSubmitted) return

    setQuizSubmitted(true)

    let score = 0
    quizQuestions.forEach(q => {
      if (q.selected === q.correct) {
        score++
      }
    })

    const total = quizQuestions.length
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0

    const newQuizRecord = {
      score,
      total,
      percentage,
      timestamp: new Date().toISOString()
    }

    setQuizHistory(prev => [newQuizRecord, ...prev])
  }

  const handleDeletePdf = async (id, e) => {
    e.stopPropagation()
    const pdfToDelete = pdfs.find(p => p.id === id)

    setPdfs(prev => prev.filter(p => p.id !== id))
    if (selectedPdf && selectedPdf.id === id) {
      setSelectedPdf(null)
      setExtractedPdf(null)
      setPdfChunks([])
    }

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: dbError } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (dbError) {
      console.error("PDF DB DELETE ERROR", dbError)
      alert(`Unable to delete PDF: ${dbError.message}`)
      loadUserPdfs(user.id)
      return
    }

    if (pdfToDelete?.storagePath) {
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .remove([pdfToDelete.storagePath])

      if (storageError) {
        console.error("PDF STORAGE DELETE ERROR", storageError)
      }
    }
  }

  const handleVoiceInput = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      setTimeout(() => {
        setMessageInput('Tell me more about quantum superposition theory.')
        setIsRecording(false)
      }, 2500)
    }
  }



  const handleTextToSpeech = (text) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.')
      return
    }

    if (currentlySpeakingText === text) {
      stopSpeech()
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.1

    // Apply the strongest or user-selected voice
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    utterance.onstart = () => {
      setCurrentlySpeakingText(text)
    }

    utterance.onend = () => {
      setCurrentlySpeakingText(null)
    }

    utterance.onerror = () => {
      setCurrentlySpeakingText(null)
    }

    window.speechSynthesis.speak(utterance)
  }

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setCurrentlySpeakingText(null)
    }
  }

  const handleRealPdfUpload = async (input) => {
    if (!currentUser) {
      setActiveModal('pdf')
      return
    }
    let file = null
    if (input instanceof File) {
      file = input
    } else if (input && input.target && input.target.files) {
      file = input.target.files[0]
    }

    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF document.')
      return
    }

    setIsExtracting(true)
    setExtractedPdf(null)
    setPdfChunks([])

    try {
      const result = await extractTextFromPdf(file)
      const chunks = chunkText(result.text)

      console.log("TOTAL CHUNKS:", chunks.length)
      setPdfChunks(chunks) // Store the generated chunks in state

      console.log("PDF Extracted Successfully")

      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        alert("Please log in first.")
        setIsExtracting(false)
        return
      }

      const filePath = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      console.log("PDF STORAGE UPLOAD SUCCESS")

      const pdfRecord = {
        user_id: user.id,
        file_name: file.name,
        file_url: filePath,
        storage_path: filePath,
        file_size: file.size,
        page_count: result.pageCount,
        char_count: result.charCount,
        full_text: result.text,
        page_texts: result.pages,
        chunk_count: chunks.length
      }

      const basePdfRecord = {
        user_id: user.id,
        file_name: file.name,
        file_url: filePath,
        page_count: result.pageCount,
        char_count: result.charCount
      }

      let { data: insertedPdf, error: dbError } = await supabase
        .from('pdfs')
        .insert(pdfRecord)
        .select()
        .single()

      if (dbError?.code === 'PGRST204' || dbError?.message?.includes('column')) {
        console.warn("PDF table is missing extended persistence columns. Falling back to base metadata insert.", dbError)
        const fallback = await supabase
          .from('pdfs')
          .insert(basePdfRecord)
          .select()
          .single()

        insertedPdf = fallback.data
        dbError = fallback.error
      }

      if (dbError) {
        console.error("PDF DB INSERT ERROR", dbError)
        alert(`PDF DB INSERT ERROR: ${dbError.message || JSON.stringify(dbError)}`)
        setIsExtracting(false)
        return
      }

      console.log("PDF DB INSERT SUCCESS")

      const newPdfItem = buildPdfFromRow({
        ...insertedPdf,
        storage_path: insertedPdf.storage_path || filePath,
        file_size: insertedPdf.file_size || file.size,
        full_text: insertedPdf.full_text || result.text,
        page_texts: insertedPdf.page_texts || result.pages,
        chunk_count: insertedPdf.chunk_count || chunks.length
      })

      setPdfs(prev => [newPdfItem, ...prev])
      setSelectedPdf(newPdfItem)

      setExtractedPdf({
        fileName: file.name,
        pageCount: result.pageCount,
        charCount: result.charCount,
        previewText: result.text.substring(0, 1000),
        fullText: result.text,
        pages: result.pages,
        chunkCount: chunks.length // Store chunk count in extracted PDF object
      })

      setPdfPage(1) // Reset view page count to first page on upload

      alert(`Success! "${file.name}" has been parsed and tokenized into ${chunks.length} chunks.`)
    } catch (error) {
      console.error(error)
      alert(`Error extracting PDF text: ${error.message}`)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleResumeChat = (chat) => {
    const matchedPdf = pdfs.find(p => p.name === chat.docName)
    if (matchedPdf) activatePdf(matchedPdf)
    setPdfPage(chat.page)
    setActiveTab('chat')
  }

  // Filtered PDFs based on search
  const filteredPdfs = pdfs.filter(pdf =>
    pdf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pdf.topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Dynamic values derived from application state
  const userFullName = currentUser?.user_metadata?.full_name || 'Guest User'
  const userEmail = currentUser?.email || 'guest@docmind.ai'
  const userInitials = userFullName
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'GU'

  // Dynamic average quiz score
  const averageQuizScore = quizHistory.length > 0
    ? Math.round(quizHistory.reduce((acc, q) => acc + q.percentage, 0) / quizHistory.length)
    : 0

  // Dynamic study retention derived from spaced repetition reviews
  const studyRetention = flashcardReviews.total > 0
    ? Math.round((flashcardReviews.correct / flashcardReviews.total) * 100)
    : 100 // Default to 100% initial retention

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('docmind_theme', nextTheme)
      return nextTheme
    })
  }

  const renderGuestBanner = () => {
    if (currentUser) return null
    return (
      <div className="p-4 sm:p-5 rounded-2xl border border-violet-900/40 bg-violet-950/10 flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6 text-left animate-fadeIn">
        <div className="space-y-2.5 max-w-2xl">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5 animate-pulse">
            <span>🎓 Guest Mode Active</span>
          </h4>
          <p className="text-xs text-neutral-300">
            You can chat with AI for free.
          </p>
          <div className="space-y-1">
            <p className="text-[11px] text-neutral-450 font-semibold uppercase tracking-wider">Login with Google to unlock:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-neutral-450">
              <li className="flex items-center gap-1.5">
                <span className="text-violet-400 font-bold">•</span> PDF Upload & Analysis
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-violet-400 font-bold">•</span> Document Q&A
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-violet-400 font-bold">•</span> AI Quiz Generation
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-violet-400 font-bold">•</span> Smart Flashcards
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-violet-400 font-bold">•</span> Progress Tracking
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-violet-400 font-bold">•</span> Saved Study History
              </li>
            </ul>
          </div>
        </div>
        <button
          onClick={handleLoginWithGoogle}
          className="shrink-0 self-start md:self-center px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/15 transition-all duration-200 cursor-pointer"
        >
          Login with Google
        </button>
      </div>
    )
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans overflow-hidden">

      {/* 1. SIDEBAR */}
      <aside className={`bg-neutral-900 border-r border-neutral-800 transition-all duration-300 flex flex-col justify-between z-30 ${sidebarCollapsed ? 'w-20' : 'w-64'} hidden md:flex shrink-0`}>
        <div>
          {/* Logo Header */}
          <div className="h-18 flex items-center justify-between px-6 border-b border-neutral-800">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/10">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                  DocMind <span className="text-violet-500">AI</span>
                </span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'dashboard'
                ? 'bg-violet-600/15 border border-violet-500/30 text-violet-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </button>

            <button
              onClick={() => setActiveTab('pdfs')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'pdfs'
                ? 'bg-violet-600/15 border border-violet-500/30 text-violet-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <Layers className="w-5 h-5" />
              {!sidebarCollapsed && <span>My PDFs</span>}
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'chat'
                ? 'bg-violet-600/15 border border-violet-500/30 text-violet-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <MessageSquare className="w-5 h-5" />
              {!sidebarCollapsed && <span>Chat Workspace</span>}
            </button>

            <button
              onClick={() => setActiveTab('quizzes')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'quizzes'
                ? 'bg-violet-600/15 border border-violet-500/30 text-violet-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <Award className="w-5 h-5" />
              {!sidebarCollapsed && <span>Quizzes</span>}
            </button>

            <button
              onClick={() => setActiveTab('flashcards')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'flashcards'
                ? 'bg-violet-600/15 border border-violet-500/30 text-violet-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <BrainCircuit className="w-5 h-5" />
              {!sidebarCollapsed && <span>Flashcards</span>}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'settings'
                ? 'bg-violet-600/15 border border-violet-500/30 text-violet-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <Settings className="w-5 h-5" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </nav>
        </div>

        {/* Sidebar User Info Widget */}
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 text-violet-400 font-bold text-sm">
              {userFullName.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{userFullName}</p>
                <p className="text-[10px] text-neutral-500 truncate">{userEmail}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* 2. TOP NAVBAR */}
        <header className="h-18 border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            {/* Sidebar toggle button (desktop) */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded-lg bg-neutral-800 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Guest/User Mode badge */}
            {currentUser ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400 select-none">
                <Shield className="w-3.5 h-3.5 fill-emerald-400/20" />
                <span>USER MODE ACTIVE</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-[10px] font-bold text-violet-400 select-none">
                <Zap className="w-3.5 h-3.5 fill-violet-400/20" />
                <span>GUEST MODE ACTIVE</span>
              </div>
            )}

            {/* API Key Status badge */}
            {hasSavedKey ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Using Personal OpenRouter Key</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-400 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                <span>Using Shared Project Key</span>
              </div>
            )}
          </div>

          {/* User Profile Widget */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-violet-500/40 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-violet-500" />
              )}
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </button>
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-neutral-200">{userFullName}</span>
              <span className="text-[10px] text-emerald-500 flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Synchronized</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-violet-500/15">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Mobile menu panel dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-18 left-0 right-0 bg-neutral-900 border-b border-neutral-800 z-50 p-4 flex flex-col gap-2 md:hidden">
            <button
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-left ${activeTab === 'dashboard' ? 'bg-violet-600/20 text-violet-400' : 'text-neutral-400'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => { setActiveTab('pdfs'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-left ${activeTab === 'pdfs' ? 'bg-violet-600/20 text-violet-400' : 'text-neutral-400'}`}
            >
              <Layers className="w-4 h-4" />
              <span>My PDFs</span>
            </button>
            <button
              onClick={() => { setActiveTab('chat'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-left ${activeTab === 'chat' ? 'bg-violet-600/20 text-violet-400' : 'text-neutral-400'}`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat Workspace</span>
            </button>
            <button
              onClick={() => { setActiveTab('quizzes'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-left ${activeTab === 'quizzes' ? 'bg-violet-600/20 text-violet-400' : 'text-neutral-400'}`}
            >
              <Award className="w-4 h-4" />
              <span>Quizzes</span>
            </button>
            <button
              onClick={() => { setActiveTab('flashcards'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-left ${activeTab === 'flashcards' ? 'bg-violet-600/20 text-violet-400' : 'text-neutral-400'}`}
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Flashcards</span>
            </button>
            <button
              onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-left ${activeTab === 'settings' ? 'bg-violet-600/20 text-violet-400' : 'text-neutral-400'}`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        )}

        {/* 3. MAIN CONTENT LAYOUT SPLIT / SCROLLABLE VIEW */}
        <main className="flex-1 overflow-y-auto bg-neutral-950 p-6 relative">

          {/* TAB: DASHBOARD (PRIMARY SUMMARY PANELS) */}
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn text-left">
              {renderGuestBanner()}

              {/* Header Title Greeting */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Welcome Back, Learner</span>
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </h1>
                <p className="text-xs text-neutral-400 mt-1">
                  Ready to continue studying? Upload a document or pick up where you left off.
                </p>
              </div>

              {/* A. STATISTICS CARDS GRID */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat 1 */}
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/25 flex flex-col justify-between gap-3 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Documents</span>
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">{pdfs.length}</h3>
                    <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-violet-400" />
                      <span>{pdfs.reduce((acc, p) => acc + p.pages, 0)} total pages parsed</span>
                    </p>
                  </div>
                </div>

                {/* Stat 2 */}
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/25 flex flex-col justify-between gap-3 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Active Flashcards</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">{flashcards.length}</h3>
                    <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Optimized SM-2 scheduling</span>
                    </p>
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/25 flex flex-col justify-between gap-3 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Quizzes Taken</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">{quizHistory.length}</h3>
                    <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{averageQuizScore}% average score</span>
                    </p>
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/25 flex flex-col justify-between gap-3 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Study Retention</span>
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">{studyRetention}%</h3>
                    <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-400" />
                      <span>High memory optimization</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* B. MAIN CORE WORKSPACE: UPLOAD CARD & RECENT CHATS LIST */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Side: Drag-and-Drop Ingestion PDF Card */}
                <div className="lg:col-span-7 space-y-4">
                  <h3 className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Quick Ingest Tool</h3>

                  {/* Extraction Loader */}
                  {isExtracting && (
                    <div className="p-8 rounded-2xl border border-violet-900/40 bg-violet-950/10 flex flex-col items-center justify-center gap-3 animate-pulse text-center">
                      <div className="w-9 h-9 rounded-full border-3 border-violet-500 border-t-transparent animate-spin" />
                      <p className="text-xs font-bold text-violet-400">Extracting and tokenizing PDF text page-by-page directly in-browser...</p>
                    </div>
                  )}

                  {/* Extracted Metadata Card */}
                  {extractedPdf && !isExtracting && (
                    <div className="p-5 rounded-2xl border border-violet-900/40 bg-violet-950/5 space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4.5 h-4.5 text-violet-400" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Latest Parsed PDF Analysis</h3>
                        </div>
                        <button
                          onClick={() => setExtractedPdf(null)}
                          className="p-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          title="Clear Analysis"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">File Name</span>
                          <span className="text-xs font-bold text-white truncate block mt-1" title={extractedPdf.fileName}>{extractedPdf.fileName}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Page Volume</span>
                          <span className="text-xs font-bold text-white block mt-1">{extractedPdf.pageCount} pages</span>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Characters</span>
                          <span className="text-xs font-bold text-white block mt-1">{extractedPdf.charCount.toLocaleString()} chars</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Text Preview (First 1,000 chars)</span>
                        <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-900 text-[10px] text-neutral-400 font-mono leading-relaxed h-32 overflow-y-auto scrollbar-thin whitespace-pre-wrap select-all">
                          {extractedPdf.previewText}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload PDF Card */}
                  <div
                    className={`rounded-2xl border border-dashed p-8 text-center flex flex-col items-center justify-center transition-all duration-300 relative group overflow-hidden cursor-pointer ${isDragging
                      ? 'border-violet-500 bg-violet-600/5'
                      : 'border-neutral-800 bg-neutral-900/20 hover:border-violet-500/30'
                      }`}
                    onClick={() => document.getElementById('pdf-upload')?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDragging(false)

                      const file = e.dataTransfer.files?.[0]

                      if (file) {
                        handleRealPdfUpload(file)
                      }
                    }}
                  >
                    <input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleRealPdfUpload}
                    />

                    <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6 animate-pulse" />
                    </div>

                    <h4 className="text-sm font-bold text-white mb-1">
                      Drag and drop textbook PDF
                    </h4>

                    <p className="text-[11px] text-neutral-500 max-w-sm mb-4 leading-normal">
                      Click anywhere in this box or drag a PDF here to upload.
                    </p>

                    <button
                      type="button"
                      className="text-xs font-semibold px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700/60 hover:bg-neutral-700 hover:text-white transition-colors inline-flex items-center gap-1.5 shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Select Local File</span>
                    </button>
                  </div>
                </div>

                {/* Right Side: Recent Chats interactive grid */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Recent Chats</h3>
                    <div className="flex gap-3 items-center">
                      {recentChats.length > 0 && (
                        <button
                          onClick={handleClearAllChatHistory}
                          className="text-[10px] font-bold text-red-500 hover:text-red-400 transition-colors"
                        >
                          Clear All History
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab('chat')}
                        className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-0.5"
                      >
                        <span>View All</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {recentChats.length === 0 ? (
                      <div className="p-8 rounded-xl border border-neutral-900 bg-neutral-900/10 text-center flex flex-col items-center justify-center gap-2">
                        <MessageSquare className="w-6 h-6 text-neutral-700 animate-pulse" />
                        <span className="text-xs text-neutral-500 font-semibold">No recent chats</span>
                        <p className="text-[10px] text-neutral-600 leading-normal max-w-[200px]">
                          Upload a PDF and ask a question to start your first study workspace session.
                        </p>
                      </div>
                    ) : (
                      recentChats.map(chat => (
                        <div
                          key={chat.id}
                          onClick={() => handleResumeChat(chat)}
                          className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 hover:bg-neutral-900/40 hover:border-violet-500/35 transition-all duration-200 cursor-pointer flex justify-between items-center group relative overflow-hidden"
                        >
                          <div className="flex items-start gap-3.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="font-semibold text-xs text-white truncate group-hover:text-violet-400 transition-colors">
                                {chat.title}
                              </h4>
                              <span className="text-[9px] text-neutral-500 block truncate mt-1">
                                {chat.docName} • Page {chat.page}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 relative z-10">
                            <span className="text-[9px] text-neutral-500 font-mono hidden sm:inline">{chat.date}</span>
                            <button
                              onClick={(e) => handleDeleteChatSession(chat.docName, e)}
                              className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-800 hover:bg-red-950 hover:border-red-900 text-neutral-400 hover:text-red-400 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Delete Chat Session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* C. RECENT UPLOADED PDFs SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-wider text-neutral-400 uppercase">My PDFs</h3>
                  <button
                    onClick={() => setActiveTab('pdfs')}
                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-0.5"
                  >
                    <span>Manage Library</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pdfs.map(pdf => (
                    <div
                      key={pdf.id}
                      onClick={() => {
                        activatePdf(pdf)
                        setActiveTab('chat')
                      }}
                      className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/20 hover:bg-neutral-900/40 hover:border-violet-500/35 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group relative"
                    >
                      <div className="flex gap-4 items-start relative z-10">
                        <div className="w-10 h-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                          <FileText className="w-5.5 h-5.5" />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-semibold text-xs sm:text-sm text-white truncate pr-6 group-hover:text-violet-400 transition-colors">
                            {pdf.name}
                          </h4>
                          <span className="text-[10px] text-neutral-500 block mt-1">Uploaded {pdf.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-900 relative z-10">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-[9px] text-neutral-300 font-medium uppercase tracking-wider">{pdf.topic}</span>
                        <span className="font-mono">{pdf.pages} Pages</span>
                      </div>

                      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                        <button
                          onClick={(e) => handleDeletePdf(pdf.id, e)}
                          className="p-1.5 rounded bg-neutral-800 hover:bg-red-950 border border-neutral-800 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete PDF"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: MY PDFs */}
          {activeTab === 'pdfs' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Ingested Document Library</h3>
                  <p className="text-xs text-neutral-500 mt-1">Upload and manage textbooks, studies, or guidelines.</p>
                </div>

                {/* Hidden local uploader input */}
                <label className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white cursor-pointer flex items-center gap-1.5 shadow-lg shadow-violet-500/10">
                  <Plus className="w-4 h-4" />
                  <span>Upload PDF</span>
                  <input type="file" accept="application/pdf" className="hidden" onChange={handleRealPdfUpload} />
                </label>
              </div>

              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PDFs or topics..."
                  className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-550 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Grid lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPdfs.map(pdf => (
                  <div
                    key={pdf.id}
                    onClick={() => {
                      activatePdf(pdf)
                      setActiveTab('chat')
                    }}
                    className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/20 hover:bg-neutral-900/40 hover:border-violet-500/35 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group relative"
                  >
                    <div className="flex gap-4 items-start relative z-10">
                      <div className="w-10 h-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                        <FileText className="w-5.5 h-5.5" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-semibold text-xs sm:text-sm text-white truncate pr-6 group-hover:text-violet-400 transition-colors">
                          {pdf.name}
                        </h4>
                        <span className="text-[10px] text-neutral-500 block mt-1">Uploaded {pdf.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-900 relative z-10">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-[9px] font-medium uppercase tracking-wider">{pdf.topic}</span>
                      <span className="font-mono">{pdf.pages} Pages</span>
                    </div>

                    <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                      <button
                        onClick={(e) => handleDeletePdf(pdf.id, e)}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-red-950 border border-neutral-800 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete PDF"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: CHAT WORKSPACE (SPLIT LAYOUT) */}
          {activeTab === 'chat' && (
            <div className="max-w-7xl mx-auto h-[calc(100vh-12rem)] flex flex-col gap-4 animate-fadeIn overflow-hidden">
              {renderGuestBanner()}
              <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">

                {/* Left Column: PDF Text View */}
                <div className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900/20 flex flex-col justify-between overflow-hidden">
                  <div className="px-5 py-3.5 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                        {selectedPdf ? selectedPdf.name : 'No PDF Selected'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="px-2 py-1 rounded bg-neutral-800 border border-neutral-800 text-neutral-400 font-mono">
                        Page {pdfPage} of {extractedPdf ? extractedPdf.pageCount : 1}
                      </span>
                      <button
                        onClick={() => setPdfPage(prev => Math.max(1, prev - 1))}
                        className="p-1 px-2 rounded bg-neutral-800 border border-neutral-800 hover:bg-neutral-800 font-bold"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setPdfPage(prev => {
                          const maxPage = extractedPdf ? extractedPdf.pageCount : 1
                          return Math.min(maxPage, prev + 1)
                        })}
                        className="p-1 px-2 rounded bg-neutral-800 border border-neutral-800 hover:bg-neutral-800 font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto text-left space-y-4 scrollbar-thin">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Page {pdfPage} Content</span>
                    <div className="flex-1 p-6 overflow-y-auto">
                      {extractedPdf ? (
                        extractedPdf.pages && extractedPdf.pages[pdfPage - 1] ? (
                          <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                            {extractedPdf.pages[pdfPage - 1].text}
                          </p>
                        ) : (
                          <div className="text-center text-neutral-500 mt-20">
                            Empty page or invalid page index.
                          </div>
                        )
                      ) : (
                        <div className="text-center text-neutral-550 mt-20 flex flex-col items-center gap-3">
                          <FileText className="w-8 h-8 text-neutral-700" />
                          <p className="text-xs font-semibold">Upload a PDF to view content</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Chat Window Widget */}
                <div className="w-full md:w-96 lg:w-[450px] rounded-2xl border border-neutral-800 bg-neutral-900/20 flex flex-col justify-between overflow-hidden">
                  <div className="px-5 py-3.5 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-neutral-300">RAG Assistant Online</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClearActiveChatHistory}
                        className="text-[10px] hover:text-white text-neutral-500 font-bold transition-colors cursor-pointer"
                      >
                        Clear History
                      </button>
                      <button
                        onClick={handleClearAllChatHistory}
                        className="text-[10px] hover:text-red-400 text-red-500 font-bold transition-colors cursor-pointer"
                      >
                        Clear All History
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4 text-left scrollbar-thin">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end animate-slideUp' : 'items-start'}`}
                      >
                        <div className={`p-3.5 text-xs text-neutral-200 leading-relaxed max-w-[85%] relative rounded-2xl ${msg.sender === 'user'
                          ? 'rounded-tr-sm bg-neutral-800 border border-neutral-800'
                          : 'rounded-tl-sm bg-violet-600/10 border border-violet-900/35'
                          }`}>

                          <div className="whitespace-pre-line">{msg.text}</div>

                          {msg.citations.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-violet-900/25 flex flex-wrap gap-1.5">
                              {msg.citations.map((cit, cIdx) => (
                                <button
                                  key={cIdx}
                                  onClick={() => setPdfPage(cit.page)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/25 border border-violet-500/30 text-[9px] font-bold text-violet-300 hover:bg-violet-500/35 transition-colors cursor-pointer"
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>Citation Page {cit.page}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 px-1.5">
                          <span className="text-[9px] text-neutral-500">
                            {msg.sender === 'user' ? 'You' : 'DocMind AI'}
                          </span>
                          {msg.sender === 'assistant' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleTextToSpeech(msg.text)}
                                className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-violet-400 transition-all cursor-pointer"
                                title="Listen"
                              >
                                <Volume2 className="w-3 h-3" />
                              </button>

                              <button
                                onClick={stopSpeech}
                                className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
                                title="Stop"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isTyping && (
                      <div className="flex flex-col items-start">
                        <div className="rounded-2xl rounded-tl-sm bg-violet-600/10 border border-violet-900/35 px-4 py-3 flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-3 bg-neutral-900/30 border-t border-neutral-800 shrink-0">
                    <div className="flex items-center gap-2 relative">
                      <button
                        onClick={handleVoiceInput}
                        className={`p-2.5 rounded-xl border flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${isRecording
                          ? 'bg-red-600/25 border-red-500 text-red-400 animate-pulse'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700/60 text-neutral-400 hover:text-white'
                          }`}
                        title="Voice Speech Input"
                      >
                        <Mic className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask your document a question..."
                        className="flex-1 bg-neutral-950 border border-neutral-800 hover:border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
                      />

                      <button
                        onClick={handleSendMessage}
                        className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title="Send Message"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}          {/* TAB: QUIZZES */}
          {activeTab === 'quizzes' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
              {renderGuestBanner()}
              {isHydratingPdf ? (
                <div className="p-16 rounded-2xl border border-violet-900/40 bg-violet-950/5 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full border-3 border-violet-500 border-t-transparent animate-spin mb-2" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Preparing Your Saved PDF...</h3>
                    <p className="text-xs text-violet-400 mt-1">
                      Restoring document text so the quiz generator can use your uploaded PDF.
                    </p>
                  </div>
                </div>
              ) : !extractedPdf ? (
                <div className="p-12 rounded-2xl border border-neutral-800 bg-neutral-900/10 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-450">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Upload a PDF first</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      Please upload a document using the "Quick Ingest Tool" on the Dashboard before generating study quizzes.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-violet-500/10"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : isGeneratingQuiz ? (
                <div className="p-16 rounded-2xl border border-violet-900/40 bg-violet-950/5 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full border-3 border-violet-500 border-t-transparent animate-spin mb-2" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Generating Your Study Quiz...</h3>
                    <p className="text-xs text-violet-400 mt-1">
                      Our AI assistant is reading the PDF and writing {selectedQuizCount} high-quality MCQs for you.
                    </p>
                  </div>
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="p-12 rounded-2xl border border-neutral-800 bg-neutral-900/10 flex flex-col items-center justify-center text-center gap-5">
                  <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Generate Dynamic Study Quiz</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      We will extract concepts from <strong>{extractedPdf.fileName}</strong> and create challenging multiple choice questions.
                    </p>
                  </div>

                  {/* Count Selector above Generate button */}
                  <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px]">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Questions Count</label>
                    <select
                      value={selectedQuizCount}
                      onChange={(e) => setSelectedQuizCount(Number(e.target.value))}
                      disabled={isGeneratingQuiz}
                      className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'Question' : 'Questions'}</option>
                      ))}
                    </select>
                  </div>

                  {quizError && (
                    <p className="text-xs text-red-400 font-semibold">{quizError}</p>
                  )}
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="text-xs font-semibold px-5 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BrainCircuit className="w-4 h-4" />
                    <span>Generate {selectedQuizCount} MCQs</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                    <div>
                      <h3 className="text-base font-bold text-white">Active Textbook Study Quiz</h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        Generated dynamically from <strong>{extractedPdf.fileName}</strong>.
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select
                        value={selectedQuizCount}
                        onChange={(e) => setSelectedQuizCount(Number(e.target.value))}
                        disabled={isGeneratingQuiz}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-250 focus:outline-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>{n} MCQs</option>
                        ))}
                      </select>
                      <button
                        onClick={handleGenerateQuiz}
                        disabled={isGeneratingQuiz}
                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700/60 hover:bg-neutral-700 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        title="Regenerate"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-violet-450" />
                        <span>Regenerate</span>
                      </button>
                      <button
                        onClick={() => {
                          setQuizQuestions(prev => prev.map(q => ({ ...q, selected: null })))
                          setQuizSubmitted(false)
                        }}
                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700/60 hover:bg-neutral-700 transition-all cursor-pointer"
                      >
                        Reset Quiz
                      </button>
                      <button
                        onClick={handleSubmitQuiz}
                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer"
                      >
                        Submit Answers
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {quizQuestions.map((q, qIdx) => (
                      <div key={q.id} className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/20 text-left space-y-4">
                        <div className="flex gap-3 items-start justify-between">
                          <div className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {qIdx + 1}
                            </span>
                            <h4 className="text-sm font-semibold text-white leading-relaxed">{q.question}</h4>
                          </div>

                          {/* Speak / Stop Buttons side-by-side */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleTextToSpeech(q.question)}
                              className={`p-1.5 px-2.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${currentlySpeakingText === q.question
                                ? 'bg-violet-600/25 text-violet-400 border border-violet-500/40'
                                : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-450 hover:text-white border border-neutral-700/60'
                                }`}
                              title="Speak question"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Speak</span>
                            </button>
                            <button
                              onClick={stopSpeech}
                              className="p-1.5 px-2.5 rounded bg-neutral-800 hover:bg-red-950 text-[10px] font-bold text-neutral-450 hover:text-red-405 border border-neutral-700/60 transition-all flex items-center gap-1 cursor-pointer"
                              title="Stop speaking"
                            >
                              <X className="w-3 h-3" />
                              <span>Stop</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-9">
                          {q.options.map((option, oIdx) => {
                            let btnStyle = "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-800"
                            let feedbackIcon = null

                            if (q.selected === oIdx) {
                              btnStyle = "bg-violet-600/15 border-violet-500 text-violet-400"
                            }

                            if (quizSubmitted) {
                              if (oIdx === q.correct) {
                                btnStyle = "bg-emerald-600/10 border-emerald-500/40 text-emerald-400"
                                feedbackIcon = <CheckCircle2 className="w-4 h-4 shrink-0" />
                              } else if (q.selected === oIdx) {
                                btnStyle = "bg-red-600/10 border-red-500/40 text-red-400"
                                feedbackIcon = <XCircle className="w-4 h-4 shrink-0" />
                              }
                            }

                            return (
                              <button
                                key={oIdx}
                                onClick={() => selectQuizOption(qIdx, oIdx)}
                                className={`w-full p-3.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between gap-3 transition-all cursor-pointer ${btnStyle}`}
                              >
                                <span>{option}</span>
                                {feedbackIcon}
                              </button>
                            )
                          })}
                        </div>

                        {quizSubmitted && (
                          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 pl-9 flex gap-3 text-xs text-neutral-400 leading-normal animate-slideDown">
                            <AlertCircle className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-white">Explanation:</strong> {q.explanation}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: FLASHCARDS */}
          {activeTab === 'flashcards' && (
            <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
              {renderGuestBanner()}
              {isHydratingPdf ? (
                <div className="p-16 rounded-2xl border border-violet-900/40 bg-violet-950/5 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full border-3 border-violet-500 border-t-transparent animate-spin mb-2" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Preparing Your Saved PDF...</h3>
                    <p className="text-xs text-violet-400 mt-1">
                      Restoring document text so flashcards can use your uploaded PDF.
                    </p>
                  </div>
                </div>
              ) : !extractedPdf ? (
                <div className="p-12 rounded-2xl border border-neutral-800 bg-neutral-900/10 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-450">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Upload a PDF first</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      Please upload a document using the "Quick Ingest Tool" on the Dashboard before generating study flashcards.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-violet-500/10"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : isGeneratingFlashcards ? (
                <div className="p-16 rounded-2xl border border-violet-900/40 bg-violet-950/5 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full border-3 border-violet-500 border-t-transparent animate-spin mb-2" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Generating Your Flashcards...</h3>
                    <p className="text-xs text-violet-400 mt-1">
                      Our AI assistant is reading the PDF and building {selectedFlashcardCount} optimized study flashcards.
                    </p>
                  </div>
                </div>
              ) : flashcards.length === 0 ? (
                <div className="p-12 rounded-2xl border border-neutral-800 bg-neutral-900/10 flex flex-col items-center justify-center text-center gap-5">
                  <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Generate Study Flashcards</h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      We will extract concepts from <strong>{extractedPdf.fileName}</strong> and create custom study flashcards.
                    </p>
                  </div>

                  {/* Count Selector above Generate button */}
                  <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px]">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Flashcards Count</label>
                    <select
                      value={selectedFlashcardCount}
                      onChange={(e) => setSelectedFlashcardCount(Number(e.target.value))}
                      disabled={isGeneratingFlashcards}
                      className="w-full bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'Flashcard' : 'Flashcards'}</option>
                      ))}
                    </select>
                  </div>

                  {flashcardsError && (
                    <p className="text-xs text-red-400 font-semibold">{flashcardsError}</p>
                  )}
                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={isGeneratingFlashcards}
                    className="text-xs font-semibold px-5 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BrainCircuit className="w-4 h-4" />
                    <span>Generate {selectedFlashcardCount} Flashcards</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl border border-neutral-800 bg-neutral-900/10 text-left">
                    <div>
                      <span className="text-xs font-bold text-violet-500 uppercase tracking-widest block">Spaced Repetition Review</span>
                      <h3 className="text-base font-bold text-white mt-1">Review Active Flashcards</h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        Reviewing cards from <strong>{extractedPdf.fileName}</strong>.
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select
                        value={selectedFlashcardCount}
                        onChange={(e) => setSelectedFlashcardCount(Number(e.target.value))}
                        disabled={isGeneratingFlashcards}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-[11px] text-neutral-250 focus:outline-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>{n} Cards</option>
                        ))}
                      </select>
                      <button
                        onClick={handleGenerateFlashcards}
                        disabled={isGeneratingFlashcards}
                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700/60 hover:bg-neutral-700 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        title="Regenerate Flashcards"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-violet-455" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-6">
                    <div
                      onClick={() => toggleFlashcardFlip(flashcards[currentCardIndex].id)}
                      className="w-full h-72 cursor-pointer perspective"
                    >
                      <div className={`relative w-full h-full duration-500 preserve-3d ${flashcards[currentCardIndex].flipped ? 'rotate-y-180' : ''
                        }`}>
                        {/* Front */}
                        <div className="absolute inset-0 rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col justify-between p-6 backface-hidden shadow-2xl text-left">
                          <div className="flex items-center justify-between text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
                            <span>Card {currentCardIndex + 1} of {flashcards.length}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTextToSpeech(`Front: ${flashcards[currentCardIndex].front}. Back: ${flashcards[currentCardIndex].back}.`)
                                }}
                                className={`p-1 px-2 rounded text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${currentlySpeakingText === `Front: ${flashcards[currentCardIndex].front}. Back: ${flashcards[currentCardIndex].back}.`
                                  ? 'bg-violet-600/25 text-violet-400 border border-violet-500/40'
                                  : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-450 hover:text-white border border-neutral-700/60'
                                  }`}
                                title="Speak front and back"
                              >
                                <Volume2 className="w-2.5 h-2.5" />
                                <span>Speak</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  stopSpeech()
                                }}
                                className="p-1 px-2 rounded bg-neutral-850 hover:bg-red-950 text-[9px] font-bold text-neutral-450 hover:text-red-405 border border-neutral-700/60 transition-all flex items-center gap-1 cursor-pointer"
                                title="Stop speaking"
                              >
                                <X className="w-2.5 h-2.5" />
                                <span>Stop</span>
                              </button>
                            </div>
                          </div>
                          <div className="text-center px-4">
                            <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                              {flashcards[currentCardIndex].front}
                            </p>
                          </div>
                          <div className="text-center text-[10px] text-neutral-500 uppercase tracking-wider animate-pulse">
                            Click card to flip and view explanation
                          </div>
                        </div>

                        {/* Back */}
                        <div className="absolute inset-0 rounded-2xl border border-violet-900/40 bg-neutral-900 flex flex-col justify-between p-6 rotate-y-180 backface-hidden shadow-2xl text-left">
                          <div className="flex items-center justify-between text-[10px] text-violet-450 uppercase tracking-wider font-mono">
                            <span>Answer explanation</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTextToSpeech(`Front: ${flashcards[currentCardIndex].front}. Back: ${flashcards[currentCardIndex].back}.`)
                                }}
                                className={`p-1 px-2 rounded text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${currentlySpeakingText === `Front: ${flashcards[currentCardIndex].front}. Back: ${flashcards[currentCardIndex].back}.`
                                  ? 'bg-violet-600/25 text-violet-400 border border-violet-500/40'
                                  : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-450 hover:text-white border border-neutral-700/60'
                                  }`}
                                title="Speak front and back"
                              >
                                <Volume2 className="w-2.5 h-2.5" />
                                <span>Speak</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  stopSpeech()
                                }}
                                className="p-1 px-2 rounded bg-neutral-850 hover:bg-red-950 text-[9px] font-bold text-neutral-450 hover:text-red-405 border border-neutral-700/60 transition-all flex items-center gap-1 cursor-pointer"
                                title="Stop speaking"
                              >
                                <X className="w-2.5 h-2.5" />
                                <span>Stop</span>
                              </button>
                            </div>
                          </div>
                          <div className="text-center px-4 overflow-y-auto max-h-36 scrollbar-none">
                            <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-medium">
                              {flashcards[currentCardIndex].back}
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTextToSpeech(`Front: ${flashcards[currentCardIndex].front}. Back: ${flashcards[currentCardIndex].back}.`)
                              }}
                              className={`p-1 px-3 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${currentlySpeakingText === `Front: ${flashcards[currentCardIndex].front}. Back: ${flashcards[currentCardIndex].back}.`
                                ? 'bg-violet-600/25 text-violet-400 border border-violet-500/40'
                                : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-450 hover:text-white border border-neutral-700/60'
                                }`}
                              title="Speak front and back text together"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Speak Both</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                stopSpeech()
                              }}
                              className="p-1 px-3 rounded bg-neutral-800 hover:bg-red-950 text-[10px] font-bold text-neutral-450 hover:text-red-405 border border-neutral-700/60 transition-all flex items-center gap-1 cursor-pointer"
                              title="Stop Speaking"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Stop</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {flashcards[currentCardIndex].flipped && (
                      <div className="w-full grid grid-cols-3 gap-3 animate-slideDown">
                        <button
                          onClick={() => handleFlashcardRating(flashcards[currentCardIndex].id, 'again')}
                          className="p-3.5 rounded-xl border border-red-900 bg-red-950/20 text-red-400 text-xs font-semibold hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          Again (1d)
                        </button>
                        <button
                          onClick={() => handleFlashcardRating(flashcards[currentCardIndex].id, 'good')}
                          className="p-3.5 rounded-xl border border-violet-900 bg-violet-950/20 text-violet-400 text-xs font-semibold hover:bg-violet-950/40 transition-colors cursor-pointer"
                        >
                          Good (3d)
                        </button>
                        <button
                          onClick={() => handleFlashcardRating(flashcards[currentCardIndex].id, 'easy')}
                          className="p-3.5 rounded-xl border border-emerald-900 bg-emerald-950/20 text-emerald-450 text-xs font-semibold hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        >
                          Easy (6d)
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 text-left animate-fadeIn">
              {!currentUser ? (
                <div className="p-8 rounded-2xl border border-neutral-800 bg-neutral-900/20 text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <User className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">LLM Gating Active</h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Login to use your own OpenRouter API key.
                    </p>
                  </div>
                  <button
                    onClick={handleLoginWithGoogle}
                    className="text-xs font-semibold px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-violet-500/10"
                  >
                    Login with Google
                  </button>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/20 space-y-6">
                  <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-violet-400" />
                    <span>Profile Settings</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Username</label>
                      <input
                        type="text"
                        value={userFullName}
                        readOnly
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-450 focus:outline-none transition-colors cursor-default"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Email Address</label>
                      <input
                        type="email"
                        value={userEmail}
                        readOnly
                        disabled
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-600 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Speech Voice Settings block */}
              <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/20 space-y-6">
                <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-violet-400" />
                  <span>Speech Voice Settings</span>
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Select TTS Voice</label>
                    <select
                      value={selectedVoice?.name || ''}
                      onChange={(e) => {
                        const found = voices.find(v => v.name === e.target.value)
                        if (found) setSelectedVoice(found)
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      {voices.length === 0 ? (
                        <option value="">No voices available</option>
                      ) : (
                        voices.map((voice, idx) => (
                          <option key={idx} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-[10px] text-neutral-600 leading-normal">
                      Select your preferred text-to-speech voice for study explanations. By default, the strongest English voice available on your system is pre-selected.
                    </p>
                  </div>
                </div>
              </div>

              {currentUser && (
                <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/20 space-y-6">
                  <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-violet-450 text-violet-400" />
                    <span>LLM Provider Credentials</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">OpenRouter API Key (Optional Override)</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="sk-or-v1-..."
                          value={openrouterKeyInput}
                          onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                          className="flex-1 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-violet-500 rounded-lg p-2.5 text-xs focus:outline-none transition-colors text-white"
                        />
                        <button
                          onClick={handleSaveKey}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer"
                        >
                          Save
                        </button>
                        {hasSavedKey && (
                          <button
                            onClick={handleRemoveKey}
                            className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-600 leading-normal mt-1.5">
                        Exposing custom credentials allows you to use personal high-token budgets. By default, the system routes through the private shared API client keys.
                      </p>
                      <div className="mt-3">
                        {hasSavedKey ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400 select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Using Personal OpenRouter Key</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-850 border border-neutral-800 text-[10px] font-bold text-neutral-450 select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                            <span>Using Shared Project Key</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Warning Modal Overlay for Guest Users */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6 text-left animate-scaleIn">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {activeModal === 'pdf' && 'PDF Study Features Require Login'}
                {activeModal === 'quiz' && 'Quiz Generation Requires Login'}
                {activeModal === 'flashcard' && 'Flashcards Require Login'}
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                {activeModal === 'pdf' && 'Sign in with Google to upload documents, analyze PDFs, and ask questions about your study materials.'}
                {activeModal === 'quiz' && 'Sign in to generate personalized quizzes from uploaded documents and track your performance.'}
                {activeModal === 'flashcard' && 'Sign in to create smart flashcards from your documents and improve retention using spaced repetition.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleLoginWithGoogle}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-500/10 transition-colors cursor-pointer"
              >
                Login with Google
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-350 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
