'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export function FlyingPlanes() {
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
              {/* Spark glow behind the plane */}
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
