# MAS Scout — Deployment Guide

## Environment Requirements

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **PM2** (process manager for production)
- **Linux** or macOS (tested on Ubuntu 22.04+)

## Configuration

### API Keys

Create a `.env` file at the project root with the following variables:

```env
# Apollo.io API key — used by the enricher module for contact search
APOLLO_API_KEY=your_apollo_api_key

# Claude API key — used by outreach and prep modules for LLM-powered content generation
CLAUDE_API_KEY=your_claude_api_key
```

These keys are required for full functionality. Without them, the enricher and outreach modules will run in stub mode (returning placeholder data).

### Cron Schedule

The watcher runs on a daily schedule. The default is once per day during Singapore business hours:

```
0 9 * * * — every day at 09:00 SGT (01:00 UTC)
```

This can be adjusted in the PM2 ecosystem config (see below).

### Notification Channels

Reports are saved to `data/reports/` as Markdown files. To integrate with notification services (Telegram, Slack, email), configure the relevant webhook URLs in `.env`:

```env
# Optional: notification integrations
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## PM2 Production Deployment

### Install PM2

```bash
npm install -g pm2
```

### Ecosystem Config

Create `ecosystem.config.cjs` at the project root:

```js
module.exports = {
  apps: [
    {
      name: 'mas-scout-watcher',
      script: 'src/watcher/index.js',
      cron_restart: '0 1 * * *',  // 09:00 SGT = 01:00 UTC
      autorestart: false,          // cron-driven, not a long-running daemon
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

### Start the Service

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Save the process list so it survives reboots
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

### Manual Run

To run the watcher manually (outside of cron):

```bash
# Full run: scrape + diff + save + report
npm run watch

# Diff-only mode: compare against the last snapshot without scraping
npm run watch:diff
```

## Cron Daily Watcher Schedule

If you prefer system cron over PM2 cron:

```bash
# Edit crontab
crontab -e

# Add this line (09:00 SGT = 01:00 UTC)
0 1 * * * cd /path/to/mas-scout && /usr/bin/node src/watcher/index.js >> data/watcher.log 2>&1
```

Make sure the cron environment has access to Node.js 20+ and the required environment variables. You can source `.env` in the cron command:

```bash
0 1 * * * cd /path/to/mas-scout && export $(cat .env | xargs) && /usr/bin/node src/watcher/index.js >> data/watcher.log 2>&1
```

## Monitoring and Logs

### PM2 Monitoring

```bash
# View running processes
pm2 list

# View real-time logs
pm2 logs mas-scout-watcher

# View last N lines of logs
pm2 logs mas-scout-watcher --lines 100

# Monitor CPU/memory usage
pm2 monit
```

### Log Files

- **PM2 logs:** `~/.pm2/logs/mas-scout-watcher-out.log` and `mas-scout-watcher-error.log`
- **Watcher reports:** `data/reports/report-YYYY-MM-DD.md`
- **Snapshots:** `data/snapshots/snapshot-YYYY-MM-DDTHH-MM-SS.json`

### Health Checks

To verify the watcher is functioning correctly:

1. Check that new snapshot files appear daily in `data/snapshots/`
2. Check that daily reports are generated in `data/reports/`
3. Monitor PM2 process status with `pm2 list` — the watcher should show status `stopped` (normal for cron-driven tasks) or `online` (during execution)

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No snapshots created | Network issue or MAS website change | Check logs, verify MAS FID URL is accessible |
| Empty institution list | HTML structure changed | Update selectors in `src/watcher/scraper.js` |
| PM2 not restarting on schedule | Cron expression wrong or PM2 not saved | Run `pm2 save` and verify `cron_restart` value |
| Missing API key errors | `.env` not configured | Copy `.env.example` to `.env` and fill in keys |
