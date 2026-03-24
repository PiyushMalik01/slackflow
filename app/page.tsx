import Link from 'next/link'
import { ArrowRight, Zap, Bell, CheckCircle, Shield, GitBranch, Activity } from 'lucide-react'
import { BRAND_LOGO_SIZES, PlatformLogo } from '@/components/platform-logo'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <PlatformLogo imageSize={BRAND_LOGO_SIZES.landingNav} textClassName="text-lg" priority />
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-primary/20">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          Powered by GPT-4o-mini
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
          Route client Slack messages<br />
          <span className="text-primary">to the right person, instantly</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Connect multiple Slack workspaces. When a client asks for help, SlackFlow classifies the request,
          generates an AI draft reply, and pings the right team member on Telegram — with one-tap approve.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-all hover:gap-3"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/api/slack/install"
            className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-lg font-medium hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            Add to Slack
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-semibold mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              icon: <GitBranch className="w-5 h-5" />,
              title: 'Client sends a Slack message',
              desc: 'Any message in your connected Slack channels is automatically captured and classified as Bug, Feature, or General.',
            },
            {
              step: '02',
              icon: <Zap className="w-5 h-5" />,
              title: 'AI drafts a reply',
              desc: 'GPT-4o-mini generates a professional, context-aware draft reply and routes it to the right team member via Telegram.',
            },
            {
              step: '03',
              icon: <CheckCircle className="w-5 h-5" />,
              title: 'One-tap approval',
              desc: 'The assignee sees the draft in Telegram and taps Approve, Edit, or Dismiss. Approved replies post instantly to Slack.',
            },
          ].map((item) => (
            <div key={item.step} className="relative p-6 rounded-xl border border-border/50 bg-card hover:border-border transition-colors">
              <div className="text-xs font-mono text-muted-foreground mb-4">{item.step}</div>
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-center text-2xl font-semibold mb-12">Everything you need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Activity className="w-5 h-5" />, title: 'Multi-workspace', desc: 'Connect unlimited Slack workspaces and manage them all from one dashboard.' },
            { icon: <Bell className="w-5 h-5" />, title: 'Telegram alerts', desc: 'Instant notifications with inline buttons. No app switching needed.' },
            { icon: <Zap className="w-5 h-5" />, title: 'AI drafts', desc: 'GPT-4o-mini generates empathetic, professional replies for each request type.' },
            { icon: <GitBranch className="w-5 h-5" />, title: 'Role routing', desc: 'Bugs go to builders, features to PMs. Fully configurable per workspace.' },
            { icon: <Shield className="w-5 h-5" />, title: 'Secure', desc: 'AES-256-GCM encrypted tokens. HMAC-verified webhooks. No compromises.' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Audit trail', desc: 'Every action logged. See who approved what and when, forever.' },
          ].map((f) => (
            <div key={f.title} className="p-5 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all group">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-medium mb-1 text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Start routing smarter today</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Set up in minutes. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-all"
          >
            Create your account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-8 text-center text-xs text-muted-foreground max-w-7xl mx-auto">
        <PlatformLogo className="justify-center mb-2" imageSize={BRAND_LOGO_SIZES.landingFooter} textClassName="font-medium text-foreground" />
        <p>Automation pipeline for client request routing.</p>
      </footer>
    </div>
  )
}
