#!/usr/bin/env node
/**
 * tunnel.mjs — starts ngrok in the background and prints the public URL clearly.
 * Usage: node scripts/tunnel.mjs [port]
 *
 * Requires ngrok v3 to be installed and authenticated:
 *   ngrok config add-authtoken <YOUR_TOKEN>
 */

import { spawn } from 'child_process'
import { setTimeout as sleep } from 'timers/promises'

const PORT = process.argv[2] ?? '3000'

// Start ngrok as a background process
const ngrok = spawn('ngrok', ['http', PORT, '--log=stdout', '--log-format=json'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
})

let printed = false

async function fetchUrl(retries = 10) {
  while (retries-- > 0) {
    await sleep(1000)
    try {
      const res = await fetch('http://localhost:4040/api/tunnels')
      const data = await res.json()
      const tunnel = data.tunnels?.find((t) => t.proto === 'https')
      if (tunnel) return tunnel.public_url
    } catch {
      // ngrok not ready yet — retry
    }
  }
  return null
}

ngrok.stdout.on('data', async (chunk) => {
  if (printed) return
  const lines = chunk.toString().split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      if (obj.url && obj.url.startsWith('https://')) {
        printed = true
        printBanner(obj.url)
        return
      }
    } catch {}
  }
})

ngrok.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
})

ngrok.on('error', (err) => {
  console.error('❌ Failed to start ngrok:', err.message)
  console.error('   Make sure ngrok is installed and authenticated:')
  console.error('   ngrok config add-authtoken <YOUR_TOKEN>')
  process.exit(1)
})

// Fallback: poll the local API if stdout JSON parse didn't work
;(async () => {
  await sleep(1500)
  if (printed) return
  const url = await fetchUrl(15)
  if (url) {
    printed = true
    printBanner(url)
  } else {
    console.error('❌ Could not get ngrok URL. Visit http://localhost:4040 to check.')
    console.error('   If ngrok asks for auth: ngrok config add-authtoken <YOUR_TOKEN>')
  }
})()

function printBanner(url) {
  const line = '─'.repeat(60)
  console.log('\n' + line)
  console.log('🚀  ngrok tunnel is live!')
  console.log(line)
  console.log(`  Public URL : ${url}`)
  console.log(`  Local port : ${PORT}`)
  console.log(line)
  console.log('\n📋  Copy these into your config:\n')
  console.log(`  NEXT_PUBLIC_APP_URL=${url}`)
  console.log(`\n  Slack Event URL     : ${url}/api/slack/events`)
  console.log(`  Slack Redirect URI  : ${url}/api/slack/callback`)
  console.log(`  Telegram Webhook    : ${url}/api/telegram/webhook`)
  console.log('\n' + line + '\n')
}

// Keep alive and forward Ctrl+C
process.on('SIGINT', () => {
  ngrok.kill()
  process.exit(0)
})
