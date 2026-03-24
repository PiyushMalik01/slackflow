import Image from 'next/image'
import { cn } from '@/lib/utils'

type PlatformLogoProps = {
  showText?: boolean
  imageSize?: number
  className?: string
  textClassName?: string
  priority?: boolean
}

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
        src="/logo.png"
        alt="SlackFlow logo"
        width={imageSize}
        height={imageSize}
        priority={priority}
        draggable={false}
        className="object-contain dark:hidden"
        style={{ width: imageSize, height: 'auto' }}
      />
      <Image
        src="/logo_darktheme.png"
        alt="SlackFlow logo"
        width={imageSize}
        height={imageSize}
        priority={priority}
        draggable={false}
        className="hidden object-contain dark:block"
        style={{ width: imageSize, height: 'auto' }}
      />
      {showText ? <span className={cn('font-semibold', textClassName)}>SlackFlow</span> : null}
    </div>
  )
}
