import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'SlackFlow — AI-powered Slack request routing',
    template: '%s | SlackFlow',
  },
  description:
    'Automatically route client Slack messages to the right team member with AI-drafted replies and Telegram approval.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
