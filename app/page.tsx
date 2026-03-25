'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, useSpring } from 'framer-motion'
import {
  MessageSquare,
  Brain,
  Bell,
  CheckCircle,
  Zap,
  Tags,
  Send,
  Building2,
  Users,
  Shield,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { BRAND_LOGO_SIZES, PlatformLogo } from '@/components/platform-logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

const STEPS = [
  {
    icon: MessageSquare,
    title: 'Message Arrives',
    description: 'A client posts in your Slack channel',
    color: '#E01E5A',
  },
  {
    icon: Brain,
    title: 'AI Classifies',
    description: 'AI categorizes and drafts a response',
    color: '#8B5CF6',
  },
  {
    icon: Bell,
    title: 'Team Notified',
    description: 'The right person gets a Telegram alert',
    color: '#0088CC',
  },
  {
    icon: CheckCircle,
    title: 'Reply Sent',
    description: 'Approved response posted back to Slack',
    color: '#22C55E',
  },
] as const

const FEATURES = [
  {
    icon: Zap,
    title: 'Smart AI Routing',
    description: 'AI classifies messages into custom categories and routes to the right person',
    gradient: 'from-amber-500/10 to-orange-500/10',
    iconColor: 'text-amber-500',
  },
  {
    icon: Tags,
    title: 'Custom Categories',
    description: 'Define your own categories like Bug, Feature, Design, DevOps with descriptions that guide the AI',
    gradient: 'from-violet-500/10 to-purple-500/10',
    iconColor: 'text-violet-500',
  },
  {
    icon: Send,
    title: 'Telegram Notifications',
    description: 'Team members get instant Telegram alerts with approve, edit, and dismiss buttons',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    iconColor: 'text-blue-500',
  },
  {
    icon: Building2,
    title: 'Multi-Workspace',
    description: 'Connect multiple Slack workspaces and manage everything from one dashboard',
    gradient: 'from-emerald-500/10 to-green-500/10',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Users,
    title: 'Team Transparency',
    description: 'Shared Telegram group shows real-time task feed so everyone knows what\u2019s happening',
    gradient: 'from-pink-500/10 to-rose-500/10',
    iconColor: 'text-pink-500',
  },
  {
    icon: Shield,
    title: 'Security First',
    description: 'AES-256-GCM encryption, HMAC verification, rate limiting, and row-level security',
    gradient: 'from-slate-500/10 to-zinc-500/10',
    iconColor: 'text-slate-500',
  },
] as const

/* ── Flying Paper Planes ───────────────────────────────────────────── */

function FlyingPlanes() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Listen for theme changes via MutationObserver on <html> class
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    if (!mounted) return
    const html = document.documentElement
    setIsDark(html.classList.contains('dark'))
    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'))
    })
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [mounted])

  const planeSrc = isDark ? '/flyingasset_darktheme.png' : '/flyingassets_lighttheme.png'

  const [planes] = useState(() => {
    const yPositions = [12, 28, 44, 60, 76, 20, 52, 68, 36]
    return Array.from({ length: 14 }).map((_, i) => {
      // Alternate directions: even = right-to-left (normal image), odd = left-to-right (flipped)
      const goingLeft = i % 2 === 0
      return {
        id: i,
        goingLeft,
        // Some start already on screen so they're visible immediately
        // First 9 planes start scattered across the visible screen, rest from edges
        startX: goingLeft
          ? (i < 9 ? 10 + (i * 10) + Math.random() * 5 : 105 + Math.random() * 10)
          : (i < 9 ? 10 + (i * 10) + Math.random() * 5 : -15 - Math.random() * 10),
        endX: goingLeft ? -15 - Math.random() * 10 : 105 + Math.random() * 10,
        startY: yPositions[i % yPositions.length] + (Math.random() * 8 - 4),
        size: 35 + Math.random() * 50,
        tilt: -8 + Math.random() * 16,
        opacity: 0.15 + Math.random() * 0.2,
        duration: 40 + Math.random() * 50,
        delay: i < 9 ? 0 : Math.random() * 5,
        bobAmount: 12 + Math.random() * 25,
        bobSpeed: 5 + Math.random() * 7,
      }
    })
  })

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {planes.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            top: `${p.startY}%`,
            width: p.size,
            height: p.size,
          }}
          initial={{ left: `${p.startX}%` }}
          animate={{ left: [`${p.startX}%`, `${p.endX}%`] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <motion.div
            animate={{ y: [-p.bobAmount, p.bobAmount] }}
            transition={{
              duration: p.bobSpeed,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
          >
            <div className="relative w-full h-full">
              {/* Spark glow behind the plane — colored in light mode, white in dark */}
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{
                  background: isDark
                    ? 'radial-gradient(circle, rgba(255,255,255,0.3), rgba(255,255,255,0.08) 50%, transparent 75%)'
                    : [
                        'radial-gradient(circle, rgba(139,92,246,0.18), rgba(139,92,246,0.04) 50%, transparent 100%)',
                        'radial-gradient(circle, rgba(59,130,246,0.18), rgba(59,130,246,0.04) 50%, transparent 75%)',
                        'radial-gradient(circle, rgba(236,72,153,0.16), rgba(236,72,153,0.04) 50%, transparent 75%)',
                        'radial-gradient(circle, rgba(34,197,94,0.16), rgba(34,197,94,0.04) 50%, transparent 75%)',
                        'radial-gradient(circle, rgba(245,158,11,0.16), rgba(245,158,11,0.04) 50%, transparent 75%)',
                      ][p.id % 5],
                  transform: 'scale(1.8)',
                }}
              />
              <img
                src={planeSrc}
                alt=""
                draggable={false}
                className="relative w-full h-full object-contain select-none"
                style={{
                  opacity: isDark ? p.opacity + 0.05 : p.opacity,
                  transform: `rotate(${p.tilt}deg)${p.goingLeft ? '' : ' scaleX(-1)'}`,
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

/* ── Animated Grid Background ──────────────────────────────────────── */

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Animated dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Glowing orbs */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)',
          top: '-10%',
          left: '20%',
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)',
          bottom: '10%',
          right: '10%',
        }}
        animate={{
          x: [0, -40, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

/* ── Live Demo Animation (Hero) ──────────────────────────────────── */

const DEMO_MESSAGES = [
  { text: 'The checkout page has a bug', category: 'Bug', emoji: '🐛', color: '#EF4444' },
  { text: 'Can we add dark mode?', category: 'Feature', emoji: '✨', color: '#8B5CF6' },
  { text: 'API response times are slow', category: 'Backend', emoji: '⚡', color: '#F59E0B' },
]

function LiveDemo() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [stage, setStage] = useState<'typing' | 'classifying' | 'routed'>('typing')

  useEffect(() => {
    const cycle = () => {
      setStage('typing')
      setTimeout(() => setStage('classifying'), 1500)
      setTimeout(() => setStage('routed'), 2800)
      setTimeout(() => {
        setActiveIndex(i => (i + 1) % DEMO_MESSAGES.length)
      }, 4500)
    }

    cycle()
    const interval = setInterval(cycle, 5000)
    return () => clearInterval(interval)
  }, [])

  const msg = DEMO_MESSAGES[activeIndex]

  return (
    <div className="mx-auto mt-12 max-w-md">
      <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 shadow-lg">
        {/* Slack message simulation */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            S
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold">Client</span>
              <span className="text-[10px] text-muted-foreground">just now</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeIndex}
                className="text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.text}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Processing indicator */}
        <AnimatePresence mode="wait">
          {stage === 'classifying' && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="size-3 text-violet-500" />
              </motion.div>
              AI classifying...
            </motion.div>
          )}

          {stage === 'routed' && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-3 flex items-center justify-between"
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${msg.color}15`, color: msg.color, border: `1px solid ${msg.color}30` }}
              >
                {msg.emoji} {msg.category}
              </span>
              <span className="text-[10px] text-green-500 font-medium flex items-center gap-1">
                <CheckCircle className="size-3" />
                Routed to team
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Magnetic Card (Feature Cards) ─────────────────────────────────── */

function MagneticCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotateX = useSpring(useTransform(y, [-100, 100], [5, -5]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-100, 100], [-5, 5]), { stiffness: 300, damping: 30 })

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set(e.clientX - rect.left - rect.width / 2)
    y.set(e.clientY - rect.top - rect.height / 2)
  }

  function handleLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Animated Counter ──────────────────────────────────────────────── */

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const step = value / 40
    const timer = setInterval(() => {
      start += step
      if (start >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.floor(start))
      }
    }, 30)
    return () => clearInterval(timer)
  }, [isInView, value])

  return <span ref={ref}>{display}{suffix}</span>
}

/* ── Pill Navbar ───────────────────────────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-navbar]')) setMobileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileOpen])

  return (
    <nav
      data-navbar
      className={`fixed z-50 left-0 right-0 mx-auto transition-all duration-[800ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        scrolled
          ? 'top-4 w-[90%] max-w-2xl rounded-full border border-border/40 bg-background/60 backdrop-blur-xl shadow-lg px-4 sm:px-6 py-2'
          : 'top-0 w-full bg-background/50 backdrop-blur-lg border-b border-border/20 px-4 sm:px-6 py-3'
      }`}
    >
      <div className={`flex items-center justify-between gap-3 ${scrolled ? '' : 'max-w-7xl mx-auto'}`}>
        <PlatformLogo imageSize={scrolled ? 32 : BRAND_LOGO_SIZES.landingNav} textClassName={scrolled ? 'text-sm' : 'text-lg'} priority />

        <div className="hidden sm:flex items-center gap-4">
          {!scrolled && (
            <>
              <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it Works</a>
              <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            </>
          )}
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
          <Button asChild size={scrolled ? 'sm' : 'default'}>
            <Link href="/signup">Get Started</Link>
          </Button>
          <ThemeToggle />
        </div>

        <div className="flex sm:hidden items-center gap-1">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Menu">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="sm:hidden overflow-hidden"
          >
            <div className="flex flex-col gap-1 pt-3 pb-2 border-t border-border/40 mt-2">
              <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">How it Works</a>
              <a href="#features" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Features</a>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Sign in</Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)} className="mx-3 mt-1 flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">Get Started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

/* ── Landing Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <FlyingPlanes />
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-20">
        <GridBackground />

        <div className="mx-auto max-w-4xl px-4 pb-8 pt-20 text-center sm:px-6 sm:pt-32 lg:pt-40">
          <motion.div
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-violet-500"
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            Powered by AI
          </motion.div>

          <motion.h1
            className="text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl lg:text-7xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          >
            <span className="block">AI routes your Slack</span>
            <span className="block mt-1 bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              messages to the right person
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          >
            Connect your Slack workspaces, let AI classify and draft responses, and notify your team via Telegram. From message to action in seconds.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
          >
            <Button asChild size="lg" className="group min-w-[180px]">
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="min-w-[180px]">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </motion.div>

          {/* Live Demo */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: 'easeOut' }}
          >
            <LiveDemo />
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: 500, suffix: '+', label: 'Messages routed' },
            { value: 10, suffix: 's', label: 'Avg response time' },
            { value: 95, suffix: '%', label: 'Accuracy' },
            { value: 24, suffix: '/7', label: 'Monitoring' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="text-2xl sm:text-3xl font-bold">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-medium text-primary mb-2">How it works</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Four steps. Zero friction.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm">
              From the moment a message hits Slack to the reply going out — fully automated.
            </p>
          </motion.div>

          {/* Desktop: horizontal pipeline */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Animated connecting line */}
              <motion.div
                className="absolute top-[52px] left-[10%] right-[10%] h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border)), hsl(var(--border)), transparent)' }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
              />
              {/* Animated pulse traveling the line */}
              <motion.div
                className="absolute top-[49px] h-[8px] w-[8px] rounded-full bg-primary shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                initial={{ left: '10%' }}
                whileInView={{ left: ['10%', '90%'] }}
                viewport={{ once: true }}
                transition={{ duration: 2, delay: 0.8, ease: 'easeInOut' }}
              />

              <div className="grid grid-cols-4 gap-8">
                {STEPS.map((step, i) => {
                  const Icon = step.icon
                  return (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.2 + i * 0.2 }}
                      className="text-center"
                    >
                      {/* Glowing icon circle */}
                      <div className="relative inline-flex mb-5">
                        <motion.div
                          className="absolute inset-0 rounded-2xl blur-xl"
                          style={{ background: step.color, opacity: 0.15 }}
                          whileInView={{ opacity: [0.1, 0.2, 0.1] }}
                          viewport={{ once: true }}
                          transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                        />
                        <div
                          className="relative w-[72px] h-[72px] rounded-2xl border flex items-center justify-center bg-card"
                          style={{ borderColor: `${step.color}30` }}
                        >
                          <Icon className="size-7" style={{ color: step.color }} />
                        </div>
                        {/* Step number badge */}
                        <div
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: step.color }}
                        >
                          {i + 1}
                        </div>
                      </div>

                      <h3 className="text-base font-semibold mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Mobile/Tablet: vertical timeline */}
          <div className="lg:hidden space-y-0">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-4 items-start"
                >
                  {/* Vertical line + dot */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-xl border flex items-center justify-center bg-card relative"
                      style={{ borderColor: `${step.color}30` }}
                    >
                      <Icon className="size-5" style={{ color: step.color }} />
                      <div
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ backgroundColor: step.color }}
                      >
                        {i + 1}
                      </div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-px h-8 bg-gradient-to-b from-border to-transparent" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pt-1.5 pb-6">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-muted/20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-medium text-primary mb-2">Features</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to route smarter
            </h2>
            <p className="mt-4 mx-auto max-w-lg text-muted-foreground">
              Built for teams that handle high volumes of Slack messages and need a reliable system to triage, respond, and stay accountable.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  <MagneticCard className="h-full">
                    <div className={`h-full rounded-2xl border bg-gradient-to-br ${feature.gradient} backdrop-blur-sm p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5`}>
                      <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-background/80 border mb-4 ${feature.iconColor}`}>
                        <Icon className="size-5" />
                      </div>
                      <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </MagneticCard>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            className="relative overflow-hidden rounded-3xl border bg-card p-8 sm:p-12 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Decorative gradient */}
            <div className="absolute inset-0 -z-10 opacity-30" style={{
              background: 'radial-gradient(circle at 30% 0%, rgba(139,92,246,0.15), transparent 50%), radial-gradient(circle at 70% 100%, rgba(59,130,246,0.15), transparent 50%)',
            }} />

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to streamline your workflow?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Stop manually triaging Slack messages. Let AI handle the routing.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="group">
                <Link href="/signup">
                  Get Started — it&apos;s free
                  <ChevronRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t py-10">
        <motion.div
          className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-2">
            <PlatformLogo imageSize={24} textClassName="text-sm" />
          </div>
          <p className="text-xs text-muted-foreground">Built with love</p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SlackFlow. All rights reserved.
          </p>
        </motion.div>
      </footer>
    </div>
  )
}
