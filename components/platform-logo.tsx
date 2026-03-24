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
        priority={priority}
        className="object-contain"
      />
      {showText ? <span className={cn('font-semibold', textClassName)}>SlackFlow</span> : null}
    </div>
  )
}
