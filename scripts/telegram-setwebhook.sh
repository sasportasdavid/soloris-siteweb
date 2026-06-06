#!/usr/bin/env bash
# ─── Enregistre le webhook Telegram (à lancer UNE fois après déploiement) ───
# Pré-requis (dans l'environnement) : TELEGRAM_BOT_TOKEN et TELEGRAM_WEBHOOK_SECRET.
# Optionnel : SITE_URL (défaut https://www.soloris.fr).
#
#   TELEGRAM_BOT_TOKEN=123:ABC TELEGRAM_WEBHOOK_SECRET=monsecret ./scripts/telegram-setwebhook.sh
#
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?manque TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?manque TELEGRAM_WEBHOOK_SECRET}"
SITE="${SITE_URL:-https://www.soloris.fr}"

echo "→ setWebhook vers ${SITE}/api/telegram/webhook"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${SITE}/api/telegram/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"callback_query\"]}"
echo
echo "→ getWebhookInfo"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
echo
