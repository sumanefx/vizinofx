# Sparlex Store

A complete premium Telegram SRC Store Bot built with **Node.js 22.5+**, **Telegraf**, built-in **SQLite** (`node:sqlite`), **dotenv**, and **Express**. The bot sells SRC files, bot source codes, website source codes, scripts, tools, ZIP files, and other digital products directly inside Telegram.

## Features

- Phone verification with Telegram contact request before any feature is available.
- Modern inline Telegram UI with clean navigation and message cleanup.
- SQLite wallet system with admin-approved deposits using Node's built-in `node:sqlite` module.
- UPI payment proof flow: amount, UTR / transaction ID, screenshot, pending review.
- Hidden Telegram admin panel via `/sparlexadmin`.
- Admin deposit approval/rejection with user notifications.
- Category and product management from Telegram.
- Telegram file/document upload for automatic product delivery using `file_id`.
- Purchase flow with wallet deduction, order IDs like `ORD1001`, and instant delivery.
- Manual delivery status support for products that require admin handling.
- My Orders and detailed order tracking.
- Profile page with balance, deposits, referrals, and order stats.
- One-time redeem/coupon system with usage limits.
- Referral links and 10% referral deposit commission.
- Leaderboards for buyers, spenders, and referrers.
- Broadcast messages to verified users.
- Settings editor for UPI, support, proofs channel, and WhatsApp from Telegram.
- Express keep-alive endpoint for hosting checks.

## Required Environment Variables

Create a `.env` file in the project root:

```env
BOT_TOKEN=
ADMIN_ID=
UPI_ID=sumaneffx@axl
TELEGRAM_SUPPORT=https://t.me/sparlexhun
PROOF_CHANNEL=https://t.me/sparlexapi
WHATSAPP_NUMBER=919907517919
PORT=3000
```

- `BOT_TOKEN`: Telegram bot token from BotFather.
- `ADMIN_ID`: Numeric Telegram user ID of the store admin.
- `UPI_ID`: UPI ID shown during insufficient balance/add balance flows.
- `TELEGRAM_SUPPORT`: Official Telegram support link.
- `PROOF_CHANNEL`: Sales proof channel link. The Proofs button opens this only.
- `WHATSAPP_NUMBER`: WhatsApp support number without `+`.
- `PORT`: Express keep-alive server port.

## Install

Use Node.js 22.5+ because this bot uses the built-in `node:sqlite` module instead of the native `sqlite3` npm package.

```bash
npm install telegraf dotenv express
```

## Run

```bash
node index.js
```

Or:

```bash
npm start
```

The Express keep-alive server responds at:

```text
GET / -> Sparlex Store Bot Online
```

## User Flow

1. User starts the bot with `/start`.
2. If not verified, the bot only shows `📱 Share My Number`.
3. After sharing their Telegram contact, the user enters the main store menu.
4. Users can add wallet balance, submit proof, shop by category, buy products, track orders, redeem codes, invite referrals, and contact support.
5. Digital files are delivered directly as Telegram documents when products are configured for auto delivery.

## Admin Panel

Open the hidden admin panel with:

```text
/sparlexadmin
```

Only `ADMIN_ID` can access it. Other users receive:

```text
❌ You are not authorized.
```

Admin tools include:

- Users: view/search users, see phone and Telegram ID, open chat, ban/unban.
- Add Balance: manually credit a user wallet.
- Deposits: approve/reject UPI proofs.
- Categories: add, rename, toggle, delete categories.
- Store: add, toggle, delete products, edit price, replace delivery file.
- Orders: view, mark delivered, delete orders.
- Coupons: create/delete redeem codes.
- Broadcast: send messages to verified users.
- Leaderboard: admin leaderboard view.
- Settings: update UPI/support/proof/WhatsApp values.

## Hosting Notes

Replit free projects may sleep when inactive, which can stop long polling bots until the repl wakes again.

Best 24/7 hosting options:

- Railway
- Render
- Paid Replit Deployments
- VPS

For production, use a stable always-on Node.js host and keep the `.env` values private.
