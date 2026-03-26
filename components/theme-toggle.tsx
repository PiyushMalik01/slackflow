'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
    setIsDark(document.documentElement.classList.contains('dark'))

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current) return

    const newTheme = !isDark

    // Check if View Transitions API is supported
    if (!document.startViewTransition) {
      // Fallback: just toggle without animation
      setIsDark(newTheme)
      document.documentElement.classList.toggle('dark')
      localStorage.setItem('theme', newTheme ? 'dark' : 'light')
      return
    }

    // Circular expansion animation
    const { flushSync } = await import('react-dom')

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setIsDark(newTheme)
        document.documentElement.classList.toggle('dark')
        localStorage.setItem('theme', newTheme ? 'dark' : 'light')
      })
    })

    await transition.ready

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 500,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  }, [isDark])

  if (!mounted) return null

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
