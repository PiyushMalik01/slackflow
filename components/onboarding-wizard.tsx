'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Rocket, Tags, Users, Radio, PartyPopper,
  ChevronRight, X, ArrowRight, MessageSquare,
} from 'lucide-react'

const STORAGE_KEY = 'slackflow_onboarding_complete'

interface OnboardingWizardProps {
  hasWorkspace: boolean
  hasRoles: boolean
  hasCategories: boolean
}

interface StepConfig {
  icon: React.ReactNode
  title: string
  description: string
  primaryLabel: string
  primaryAction: () => void
  skipLabel: string | null
  tip?: string
  categories?: boolean
  showFlow?: boolean
}

export function OnboardingWizard({ hasWorkspace, hasRoles, hasCategories }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed && !hasWorkspace) {
      setVisible(true)
    }
  }, [hasWorkspace])

  function complete() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  function skipAll() {
    complete()
  }

  if (!visible) return null

  const steps: StepConfig[] = [
    // Step 0: Welcome
    {
      icon: <Rocket className="size-10 text-primary" />,
      title: 'Welcome to SlackFlow!',
      description:
        'SlackFlow automatically routes your Slack messages to the right team member using AI. Let\u2019s get you set up in a few quick steps.',
      primaryLabel: "Let's Go",
      primaryAction: () => setStep(1),
      skipLabel: null,
    },
    // Step 1: Connect Slack
    {
      icon: (
        <div className="size-12 rounded-xl bg-[#4A154B]/10 flex items-center justify-center">
          <MessageSquare className="size-6 text-[#4A154B] dark:text-[#E01E5A]" />
        </div>
      ),
      title: 'Connect your Slack workspace',
      description:
        'This lets SlackFlow read messages from your channels and post AI-drafted replies back as thread responses.',
      primaryLabel: 'Add to Slack',
      primaryAction: () => {
        router.push('/api/slack/install')
        complete()
      },
      skipLabel: "I'll do this later",
      tip: "You'll be redirected to Slack to authorize, then brought back here.",
    },
    // Step 2: Categories
    {
      icon: <Tags className="size-10 text-violet-500" />,
      title: 'Your message categories',
      description:
        'The AI uses categories to classify incoming messages and route them to the right person. We\u2019ve set up defaults for you.',
      primaryLabel: 'Customize Categories',
      primaryAction: () => {
        router.push('/dashboard/settings')
        complete()
      },
      skipLabel: 'Defaults are fine, next \u2192',
      categories: true,
    },
    // Step 3: Team
    {
      icon: <Users className="size-10 text-blue-500" />,
      title: 'Add your team members',
      description:
        'Create team members and invite them via Telegram. They\u2019ll get task notifications with Approve, Edit, and Dismiss buttons.',
      primaryLabel: 'Add First Member',
      primaryAction: () => {
        router.push('/dashboard/teams')
        complete()
      },
      skipLabel: "I'll do this later",
      tip: 'Share invite links via QR code, WhatsApp, or email.',
    },
    // Step 4: Monitor
    {
      icon: <Radio className="size-10 text-green-500" />,
      title: 'Start monitoring channels',
      description:
        'Toggle on the Slack channels you want to monitor. The bot automatically joins the channel and starts routing messages.',
      primaryLabel: 'Go to Workspaces',
      primaryAction: () => {
        router.push('/dashboard/workspaces')
        complete()
      },
      skipLabel: "I'll do this later",
    },
    // Step 5: Done
    {
      icon: <PartyPopper className="size-10 text-yellow-500" />,
      title: "You're all set!",
      description:
        'Your pipeline is ready: Slack message \u2192 AI classifies & drafts \u2192 Team member notified on Telegram \u2192 Approved reply posted to Slack.',
      primaryLabel: 'Go to Dashboard',
      primaryAction: () => complete(),
      skipLabel: null,
      showFlow: true,
    },
  ]

  const currentStep = steps[step]
  const totalSteps = steps.length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={skipAll} />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl border shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Skip button */}
        <button
          onClick={skipAll}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Skip setup"
        >
          <X className="size-5" />
        </button>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-primary'
                  : i < step
                    ? 'w-1.5 bg-primary/40'
                    : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="p-8 pt-6 text-center"
          >
            {/* Icon */}
            <div className="flex justify-center mb-5">{currentStep.icon}</div>

            {/* Title */}
            <h2 className="text-xl font-bold mb-2">{currentStep.title}</h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {currentStep.description}
            </p>

            {/* Category preview cards (step 2 only) */}
            {currentStep.categories && (
              <div className="flex justify-center gap-3 mb-6 flex-wrap">
                {[
                  { emoji: '\uD83D\uDC1B', name: 'Bug', color: '#EF4444' },
                  { emoji: '\u2728', name: 'Feature', color: '#8B5CF6' },
                  { emoji: '\uD83D\uDCAC', name: 'General', color: '#6B7280' },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="px-4 py-2.5 rounded-lg border text-sm font-medium"
                    style={{
                      backgroundColor: `${c.color}10`,
                      borderColor: `${c.color}30`,
                    }}
                  >
                    {c.emoji} {c.name}
                  </div>
                ))}
              </div>
            )}

            {/* Visual flow (last step) */}
            {currentStep.showFlow && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6 flex-wrap">
                <span className="px-2 py-1 rounded bg-muted">Slack</span>
                <ArrowRight className="size-3" />
                <span className="px-2 py-1 rounded bg-muted">AI</span>
                <ArrowRight className="size-3" />
                <span className="px-2 py-1 rounded bg-muted">Telegram</span>
                <ArrowRight className="size-3" />
                <span className="px-2 py-1 rounded bg-muted">Reply</span>
              </div>
            )}

            {/* Tip */}
            {currentStep.tip && (
              <p className="text-xs text-muted-foreground/70 mb-4 italic">
                {currentStep.tip}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col items-center gap-3">
              <Button size="lg" onClick={currentStep.primaryAction} className="min-w-[200px]">
                {currentStep.primaryLabel}
                <ChevronRight className="size-4 ml-1" />
              </Button>
              {currentStep.skipLabel && (
                <button
                  onClick={() => setStep((s) => Math.min(s + 1, totalSteps - 1))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {currentStep.skipLabel}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
