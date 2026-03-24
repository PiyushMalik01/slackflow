import Image from 'next/image'
import { cn } from '@/lib/utils'

type PlatformLogoProps = {
  showText?: boolean
  imageSize?: number
  className?: string
  textClassName?: string
  priority?: boolean
}

const LOGO_SRC = '/logo.png'

export const BRAND_LOGO_SIZES = {
  sidebar: 56,
  auth: 72,
  landingNav: 56,
  landingFooter: 40,
} as const

export function PlatformLogo({
  showText = true,
  imageSize = 64,
  className,
  textClassName,
  priority = false,
}: PlatformLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src={LOGO_SRC}
        alt="SlackFlow logo"
        width={imageSize}
        height={imageSize}
        sizes={`${imageSize}px`}
        priority={priority}
        className="object-contain"
        style={{ width: 'auto', height: 'auto' }}
      />
      {showText ? <span className={cn('font-semibold', textClassName)}>SlackFlow</span> : null}
    </div>
  )
}
