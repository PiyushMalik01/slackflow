'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GuideTipProps {
  id: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
}

export function GuideTip({ id, title, description, action, icon }: GuideTipProps) {
  const [visible, setVisible] = useState(false)
  const storageKey = `slackflow_tip_${id}`

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey)
    if (!dismissed) setVisible(true)
  }, [storageKey])

  function dismiss() {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4"
        >
          <div className="flex-shrink-0 mt-0.5">
            {icon || <Lightbulb className="size-4 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            {action && (
              <Button size="sm" variant="outline" className="mt-2 text-xs h-7" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
