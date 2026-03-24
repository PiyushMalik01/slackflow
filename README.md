# SlackFlow

SlackFlow is an intelligent workflow automation platform that bridges Slack and Telegram using AI. It ingests messages from monitored Slack channels, categorizes them automatically (e.g., Bug, Feature Request), drafts intelligent responses using OpenAI, and routes them to specific team members via Telegram for approval.

## 🚀 Features
- **Multi-tenant Architecture:** Secure workspace isolation and data privacy.
- **AI Classification & Drafting:** Automatically classifies incoming Slack messages and drafts contextual responses.
- **Telegram Approval Pipeline:** Routes tasks to designated team members (e.g., PMs, Developers) via Telegram bots.
- **Flexible Role Routing:** Map different message categories (Bug, Feature, Support, Custom) to specific roles per workspace.
- **Interactive Dashboard:** Managing workspaces, Slack connections, roles, and open tasks.

---

## 🛠️ Local Development Setup

### 1. Requirements
- Node.js 18+
- [Supabase](https://supabase.com/) account (or local CLI)
- [Slack API](https://api.slack.com/apps) App
- [Telegram Bot](https://core.telegram.org/bots/tutorial) Token
- [OpenAI API](https://platform.openai.com) Key
- [ngrok](https://ngrok.com/) (for receiving local webhooks)

### 2. Clone and Install
```bash
git clone https://github.com/PiyushMalik01/slackflow.git
cd slackflow
npm install
```

### 3. Database Setup (Supabase)
1. Create a new project in Supabase.
2. Go to the SQL Editor and run the migration files located in `supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `002_flexible_roles.sql`
   - `003_flexible_categories.sql`
3. Note your Supabase URL, Anon Key, and Service Role Key.

### 4. Environment Configuration
Copy the `.env.example` file to `.env.local`:
```bash
cp .env.example .env.local
```
Fill out the variables in `.env.local`.

> **Note on App URLs for Local Dev:**
> Because Slack and Telegram require public HTTPS webhook URLs, you must use `ngrok`. 
> Run `npm run tunnel` to expose port 3000, and copy the `https://xxxx.ngrok.app` URL to `NEXT_PUBLIC_APP_URL` and `SLACK_REDIRECT_URI` in `.env.local`.

### 5. Run the Server
```bash
# Terminal 1: Run the Next.js App
npm run dev

# Terminal 2: Run the Webhook Tunnel (if not already running)
npm run tunnel
```

---

## 🚀 Deployment (Vercel)

SlackFlow is optimized for Vercel deployment. 

1. Push your code to GitHub.
2. Go to **Vercel** -> **Add New Project** -> Select your SlackFlow repository.
3. In the **Environment Variables** section, copy the exact keys from `.env.example`.
4. Be sure to set your `NEXT_PUBLIC_APP_URL` to your Vercel production domain (e.g., `https://my-slackflow.vercel.app`).
5. Set `SLACK_REDIRECT_URI` to `https://my-slackflow.vercel.app/api/slack/callback`.
6. Click **Deploy**.

### Webhook Configuration
Once your Vercel URL is live, update your webhooks:
1. **Slack App:** Navigate to *Event Subscriptions* and set the URL to `https://YOUR_VERCEL_DOMAIN/api/slack/events`.
2. **Slack App:** Navigate to *OAuth & Permissions* and set the Redirect URL to `https://YOUR_VERCEL_DOMAIN/api/slack/callback`.
3. **Telegram:** Register your Vercel webhook by opening this URL in your browser:
   `https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR_VERCEL_DOMAIN/api/telegram/webhook`

### Using the App (Crucial Step!)
For SlackFlow to actually read your messages, **you must invite the bot to your channels**. 
In your Slack workspace, go to the channel you want to monitor and type:
`/invite @YourBotName`

---

## Architecture Stack
- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS / Lucide React
- **AI Integration**: OpenAI (gpt-4o-mini)
- **Integrations**: Slack Events API / OAuth, Telegram Bot API
