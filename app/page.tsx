'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { BRAND_LOGO_SIZES, PlatformLogo } from '@/components/platform-logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

const STEPS = [
  {
    icon: MessageSquare,
    title: 'Message Arrives',
    description: 'A client posts in your Slack channel',
  },
  {
    icon: Brain,
    title: 'AI Classifies',
    description: 'AI categorizes and drafts a response',
  },
  {
    icon: Bell,
    title: 'Team Notified',
    description: 'The right person gets a Telegram alert',
  },
  {
    icon: CheckCircle,
    title: 'Reply Sent',
    description: 'Approved response posted back to Slack',
  },
] as const

const FEATURES = [
  {
    icon: Zap,
    title: 'Smart AI Routing',
    description:
      'AI classifies messages into custom categories and routes to the right person',
  },
  {
    icon: Tags,
    title: 'Custom Categories',
    description:
      'Define your own categories like Bug, Feature, Design, DevOps with descriptions that guide the AI',
  },
  {
    icon: Send,
    title: 'Telegram Notifications',
    description:
      'Team members get instant Telegram alerts with approve, edit, and dismiss buttons',
  },
  {
    icon: Building2,
    title: 'Multi-Workspace',
    description:
      'Connect multiple Slack workspaces and manage everything from one dashboard',
  },
  {
    icon: Users,
    title: 'Team Transparency',
    description:
      'Shared Telegram group shows real-time task feed so everyone knows what\u2019s happening',
  },
  {
    icon: Shield,
    title: 'Security First',
    description:
      'AES-256-GCM encryption, HMAC verification, rate limiting, and row-level security',
  },
] as const

/* ── Particles ─────────────────────────────────────────────────────── */

function ParticleBackground() {
  const [particles] = useState(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x1: Math.random() * 100,
      y1: Math.random() * 100,
      x2: Math.random() * 100,
      y2: Math.random() * 100,
      scale: Math.random() * 0.5 + 0.5,
      opacity: Math.random() * 0.3 + 0.1,
      duration: Math.random() * 20 + 15,
    }))
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full bg-primary/20"
          initial={{
            left: p.x1 + '%',
            top: p.y1 + '%',
            scale: p.scale,
          }}
          animate={{
            top: [p.y1 + '%', p.y2 + '%'],
            left: [p.x1 + '%', p.x2 + '%'],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear',
          }}
          style={{ opacity: p.opacity }}
        />
      ))}
    </div>
  )
}

/* ── Pill Navbar ───────────────────────────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed z-50 left-0 right-0 mx-auto transition-all duration-500 ease-in-out ${
        scrolled
          ? 'top-4 w-[90%] max-w-2xl rounded-full border border-border/60 bg-background/80 backdrop-blur-xl shadow-lg px-6 py-2'
          : 'top-0 w-full bg-background/80 backdrop-blur-md border-b border-border/40 px-6 py-3'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-4 sm:gap-6 ${
          scrolled ? '' : 'max-w-7xl mx-auto'
        }`}
      >
        <PlatformLogo
          imageSize={scrolled ? 40 : BRAND_LOGO_SIZES.landingNav}
          textClassName={scrolled ? 'text-sm' : 'text-lg'}
          priority
        />

        <div className="flex items-center gap-2 sm:gap-4">
          {!scrolled && (
            <>
              <a
                href="#how-it-works"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
              >
                How it Works
              </a>
              <a
                href="#features"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
              >
                Features
              </a>
            </>
          )}
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild size={scrolled ? 'sm' : 'lg'}>
            <Link href="/signup">Get Started</Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}

/* ── Landing Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-20">
        {/* Gradient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(37,99,235,0.08), transparent 60%)',
          }}
        />

        <ParticleBackground />

        <div className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center sm:pt-32 lg:pt-40">
          <motion.div
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-violet-500"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            Powered by AI
          </motion.div>

          <motion.h1
            className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            AI routes your Slack messages{' '}
            <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              to the right person, automatically
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            Connect your Slack workspaces, let AI classify and draft responses,
            and notify your team via Telegram. From message to action in seconds.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          >
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base"
            >
              <a href="#how-it-works">
                See how it works
                <ChevronRight className="ml-1 size-4" />
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              How it works
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Four steps. Zero friction.
            </h2>
          </motion.div>

          <div className="relative grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-0">
            {/* Connecting line (desktop only) */}
            <div
              aria-hidden="true"
              className="absolute top-10 right-[12.5%] left-[12.5%] hidden h-px bg-gradient-to-r from-violet-300 via-blue-300 to-violet-300 dark:from-violet-700 dark:via-blue-700 dark:to-violet-700 md:block"
            />

            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                className="relative flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                {/* Step icon */}
                <div className="relative z-10 mb-4 flex size-20 items-center justify-center rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md">
                  <step.icon className="size-8 text-violet-600 dark:text-violet-400" />
                </div>

                <span className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </span>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="max-w-[200px] text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>

                {/* Connecting arrow (mobile only) */}
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="mt-6 flex flex-col items-center text-muted-foreground/40 md:hidden"
                  >
                    <div className="h-6 w-px bg-current" />
                    <ChevronRight className="size-4 rotate-90" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Features
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to route smarter
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Built for teams that handle high volumes of Slack messages and need
              a reliable system to triage, respond, and stay accountable.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="group rounded-2xl border border-border/50 bg-card/60 p-7 transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-violet-500/5 hover:scale-[1.02] dark:hover:shadow-violet-500/10"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 transition-colors group-hover:bg-violet-500/15 dark:text-violet-400">
                  <feature.icon className="size-6" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            className="relative isolate overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
            style={{
              background:
                'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(37,99,235,0.08) 100%)',
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
          >
            {/* Decorative rings */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 -z-10 size-72 rounded-full opacity-20"
              style={{
                background:
                  'radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -left-16 -z-10 size-56 rounded-full opacity-20"
              style={{
                background:
                  'radial-gradient(circle, rgba(37,99,235,0.3), transparent 70%)',
              }}
            />

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to streamline your workflow?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Start routing smarter today
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/signup">
                  Get Started &mdash; it&rsquo;s free
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <motion.footer
        className="border-t border-border/40 py-10"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 text-center">
          <PlatformLogo
            imageSize={BRAND_LOGO_SIZES.landingFooter}
            textClassName="font-medium text-foreground"
          />
          <p className="text-sm text-muted-foreground">Built with Love</p>
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} SlackFlow. All rights reserved.
          </p>
        </div>
      </motion.footer>
    </div>
  )
}
