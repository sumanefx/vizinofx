import 'dotenv/config';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { Telegraf, Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');
const PORT = process.env.PORT || 3000;
const DEFAULT_SETTINGS = {
  upi_id: process.env.UPI_ID || 'sumaneffx@axl',
  telegram_support: process.env.TELEGRAM_SUPPORT || 'https://t.me/sparlexhun',
  proof_channel: process.env.PROOF_CHANNEL || 'https://t.me/sparlexapi',
  whatsapp_number: process.env.WHATSAPP_NUMBER || '919907517919',
  referral_percent: '10'
};

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required in .env');

const db = new DatabaseSync('./sparlex_store.sqlite');
const bot = new Telegraf(BOT_TOKEN);
const userStates = new Map();
const adminStates = new Map();
let botUsername = 'SparlexStoreBot';

function toSqliteParams(params = []) {
  return params.map((value) => (value === undefined ? null : value));
}

const run = async (sql, params = []) => {
  const statement = db.prepare(sql);
  return statement.run(...toSqliteParams(params));
};
const get = async (sql, params = []) => {
  const statement = db.prepare(sql);
  return statement.get(...toSqliteParams(params));
};
const all = async (sql, params = []) => {
  const statement = db.prepare(sql);
  return statement.all(...toSqliteParams(params));
};

async function initDb() {
  await run('PRAGMA foreign_keys = ON');
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '', username TEXT DEFAULT '', phone TEXT DEFAULT '', verified INTEGER DEFAULT 0,
    balance REAL DEFAULT 0, banned INTEGER DEFAULT 0, referred_by TEXT DEFAULT '', referral_earned REAL DEFAULT 0,
    last_bot_message_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', price REAL NOT NULL,
    category_id INTEGER, demo_link TEXT DEFAULT 'N/A', file_id TEXT DEFAULT '', file_name TEXT DEFAULT '', delivery_type TEXT DEFAULT 'auto',
    active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, utr TEXT NOT NULL,
    screenshot_file_id TEXT DEFAULT '', status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT UNIQUE, user_id INTEGER NOT NULL, product_id INTEGER,
    product_name TEXT NOT NULL, amount REAL NOT NULL, payment_status TEXT DEFAULT 'paid', delivery_status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, reward REAL NOT NULL, usage_limit INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, coupon_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, user_id), FOREIGN KEY(coupon_id) REFERENCES coupons(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) await run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', [key, value]);
  const count = await get('SELECT COUNT(*) as c FROM categories');
  if (!count.c) {
    for (const name of ['🤖 Telegram Bots', '🌐 Website SRC', '⚙️ Tools & Scripts', '📦 Premium Files', '🔥 Trending SRC']) await run('INSERT INTO categories(name) VALUES(?)', [name]);
  }
}

const isAdmin = (ctx) => String(ctx.from?.id || '') === ADMIN_ID;
const money = (n) => Number(n || 0).toFixed(Number(n || 0) % 1 ? 2 : 0);
const orderCode = (id) => `ORD${1000 + id}`;
async function setting(key) { return (await get('SELECT value FROM settings WHERE key=?', [key]))?.value || DEFAULT_SETTINGS[key] || ''; }
async function upsertUser(ctx, ref = '') {
  const tg = String(ctx.from.id);
  const existing = await get('SELECT * FROM users WHERE telegram_id=?', [tg]);
  if (!existing) {
    const cleanRef = ref && ref !== tg ? ref : '';
    await run('INSERT INTO users(telegram_id,name,username,referred_by) VALUES(?,?,?,?)', [tg, ctx.from.first_name || '', ctx.from.username || '', cleanRef]);
  } else {
    await run('UPDATE users SET name=?, username=? WHERE telegram_id=?', [ctx.from.first_name || existing.name, ctx.from.username || existing.username, tg]);
  }
  return get('SELECT * FROM users WHERE telegram_id=?', [tg]);
}
async function requireUser(ctx) { return upsertUser(ctx); }
async function requireVerified(ctx) {
  const user = await requireUser(ctx);
  if (user.banned) { await cleanSend(ctx, '🚫 Your account is banned.'); return null; }
  if (!user.verified) { await showVerify(ctx); return null; }
  return user;
}
async function deleteLast(ctx, user) {
  if (!user?.last_bot_message_id) return;
  try { await ctx.telegram.deleteMessage(user.telegram_id, user.last_bot_message_id); } catch {}
}
async function cleanSend(ctx, text, keyboard, opts = {}) {
  const user = await get('SELECT * FROM users WHERE telegram_id=?', [String(ctx.from?.id || ctx.chat?.id)]);
  if (user && !opts.keepOld) await deleteLast(ctx, user);
  const msg = await ctx.reply(text, { parse_mode: 'HTML', disable_web_page_preview: true, ...(keyboard || {}) });
  if (user) await run('UPDATE users SET last_bot_message_id=? WHERE telegram_id=?', [msg.message_id, user.telegram_id]);
  return msg;
}
async function editOrSend(ctx, text, keyboard) {
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', disable_web_page_preview: true, ...(keyboard || {}) });
      const user = await get('SELECT * FROM users WHERE telegram_id=?', [String(ctx.from.id)]);
      if (user) await run('UPDATE users SET last_bot_message_id=? WHERE telegram_id=?', [ctx.callbackQuery.message.message_id, user.telegram_id]);
      return;
    }
  } catch {}
  await cleanSend(ctx, text, keyboard);
}
function mainText() { return `🔥 ─── <b>SPARLEX STORE</b> ─── 🔥\n⚡ Powered by Sparlex\n\n👋 Welcome Back!\n\n━━━━━━━━━━━━━━━━━━\n\n📌 <b>Why choose our store?</b>\n┣ ⚡ Instant delivery system\n┣ 🔒 Trusted & secure service\n┣ 💎 Premium quality SRC files\n┣ 💰 Best discounted prices\n┣ 🚀 Fast support response\n\n━━━━━━━━━━━━━━━━━━\n🛒 Purchase smoothly & securely.`; }
const mainKb = () => Markup.inlineKeyboard([
  [Markup.button.callback('🛒 Shop Now', 'shop')],
  [Markup.button.callback('📦 My Orders', 'orders'), Markup.button.callback('👤 Profile', 'profile')],
  [Markup.button.callback('💰 Add Balance', 'addbal'), Markup.button.url('✅ Proofs', DEFAULT_SETTINGS.proof_channel)],
  [Markup.button.callback('❓ How To Use', 'how'), Markup.button.callback('💬 Support', 'support')],
  [Markup.button.callback('🎟 Redeem Code', 'redeem_open'), Markup.button.callback('🏆 Leaderboard', 'leaderboard')],
  [Markup.button.callback('🎁 Referral – Invite & Earn', 'referral')]
]);
async function menu(ctx) { const u = await requireVerified(ctx); if (u) await editOrSend(ctx, mainText(), mainKb()); }
async function showVerify(ctx) {
  await ctx.reply('📱 Please verify your phone number to enter Sparlex Store.', Markup.keyboard([[Markup.button.contactRequest('📱 Share My Number')]]).resize().oneTime());
}
async function answer(ctx) { try { await ctx.answerCbQuery(); } catch {} }

bot.start(async (ctx) => {
  const ref = ctx.startPayload || '';
  const user = await upsertUser(ctx, ref);
  if (!user.verified) return showVerify(ctx);
  return cleanSend(ctx, mainText(), mainKb());
});
bot.command('menu', menu);
bot.on('contact', async (ctx) => {
  const contact = ctx.message.contact;
  if (String(contact.user_id || ctx.from.id) !== String(ctx.from.id)) return ctx.reply('❌ Please share your own Telegram number.');
  await upsertUser(ctx);
  await run('UPDATE users SET phone=?, verified=1 WHERE telegram_id=?', [contact.phone_number, String(ctx.from.id)]);
  await ctx.reply('✅ Phone verified successfully!', Markup.removeKeyboard());
  await cleanSend(ctx, mainText(), mainKb());
});

bot.action('home', async (ctx) => { await answer(ctx); userStates.delete(ctx.from.id); await menu(ctx); });
bot.action('proofs', async (ctx) => { await answer(ctx, { url: await setting('proof_channel') }); });
bot.action('how', async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; await editOrSend(ctx, `❓ <b>HOW TO USE SPARLEX STORE</b>\n\n1️⃣ Verify your phone number.\n2️⃣ Add wallet balance using UPI.\n3️⃣ Submit UTR and screenshot.\n4️⃣ Wait for admin approval.\n5️⃣ Buy products and receive files instantly.\n\nUse /redeem CODE if you have a coupon.`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); });
bot.action('support', async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; const tg = await setting('telegram_support'); const wa = await setting('whatsapp_number'); await editOrSend(ctx, '📞 <b>OFFICIAL SUPPORT CENTER</b>', Markup.inlineKeyboard([[Markup.button.url('✈️ Telegram', tg)],[Markup.button.url('💬 WhatsApp', `https://wa.me/${wa}`)],[Markup.button.callback('⬅️ Back', 'home')]])); });

bot.action('addbal', async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; userStates.set(ctx.from.id, { flow: 'deposit_amount' }); await editOrSend(ctx, '💰 <b>ADD BALANCE</b>\n\nEnter amount to add (minimum ₹10):', Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]])); });
bot.action('cancel', async (ctx) => { await answer(ctx); userStates.delete(ctx.from.id); adminStates.delete(ctx.from.id); await menu(ctx); });

async function shopCategories(ctx) {
  if (!await requireVerified(ctx)) return;
  const rows = await all('SELECT * FROM categories WHERE active=1 ORDER BY id');
  const buttons = rows.map(c => [Markup.button.callback(c.name, `cat_${c.id}`)]);
  buttons.push([Markup.button.callback('⬅️ Back', 'home')]);
  await editOrSend(ctx, '🛒 <b>SHOP CATEGORIES</b>\n\nChoose a category:', Markup.inlineKeyboard(buttons));
}
bot.action('shop', async (ctx) => { await answer(ctx); await shopCategories(ctx); });
bot.action(/^cat_(\d+)$/, async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; const cid = ctx.match[1]; const products = await all('SELECT * FROM products WHERE active=1 AND category_id=? ORDER BY id DESC', [cid]); const buttons = products.map(p => [Markup.button.callback(`📦 ${p.name} - ₹${money(p.price)}`, `prod_${p.id}`)]); buttons.push([Markup.button.callback('⬅️ Categories', 'shop')]); await editOrSend(ctx, products.length ? '📦 <b>PRODUCTS</b>\n\nSelect a product:' : '📭 No active products in this category yet.', Markup.inlineKeyboard(buttons)); });
bot.action(/^prod_(\d+)$/, async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; const p = await get('SELECT * FROM products WHERE id=? AND active=1', [ctx.match[1]]); if (!p) return editOrSend(ctx, '❌ Product not found.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'shop')]])); await editOrSend(ctx, `📦 <b>${p.name}</b>\n💰 Price: ₹${money(p.price)}\n📝 ${p.description || 'No description'}\n🔗 Demo: ${p.demo_link || 'N/A'}\n⚙️ Delivery: ${p.delivery_type === 'auto' ? 'Auto' : 'Manual'}`, Markup.inlineKeyboard([[Markup.button.callback('🛒 Buy Now', `buy_${p.id}`)],[Markup.button.callback('⬅️ Back', `cat_${p.category_id || 0}`)]])); });
bot.action(/^buy_(\d+)$/, async (ctx) => { await answer(ctx); const u = await requireVerified(ctx); if (!u) return; const p = await get('SELECT * FROM products WHERE id=? AND active=1', [ctx.match[1]]); if (!p) return editOrSend(ctx, '❌ Product unavailable.', Markup.inlineKeyboard([[Markup.button.callback('🛒 Shop Again', 'shop')]])); if (Number(u.balance) < Number(p.price)) { const upi = await setting('upi_id'); return editOrSend(ctx, `⚠️ <b>INSUFFICIENT BALANCE</b>\n\n💰 Amount: ₹${money(p.price)}\n🔑 UPI ID: <code>${upi}</code>`, Markup.inlineKeyboard([[Markup.button.callback('💰 Add Balance', 'addbal')],[Markup.button.callback('🛒 Shop Again', 'shop')]])); }
  await run('UPDATE users SET balance=balance-? WHERE id=?', [p.price, u.id]);
  const status = p.delivery_type === 'auto' && p.file_id ? 'completed' : 'manual_pending';
  const ins = await run('INSERT INTO orders(user_id,product_id,product_name,amount,delivery_status) VALUES(?,?,?,?,?)', [u.id, p.id, p.name, p.price, status]);
  const code = orderCode(ins.lastID); await run('UPDATE orders SET order_code=? WHERE id=?', [code, ins.lastID]);
  await editOrSend(ctx, `✅ <b>Purchase Successful!</b>\n\n📦 Product: ${p.name}\n🆔 Order ID: ${code}\n\n⚡ ${status === 'completed' ? 'Instant Delivery Completed.' : 'Manual delivery pending. Admin will contact you soon.'}`, Markup.inlineKeyboard([[Markup.button.callback('🛒 Shop Again', 'shop'), Markup.button.callback('📦 My Orders', 'orders')],[Markup.button.callback('💬 Support', 'support')]]));
  if (p.delivery_type === 'auto' && p.file_id) await ctx.replyWithDocument(p.file_id, { caption: `📦 ${p.name}\n🆔 ${code}` });
  await bot.telegram.sendMessage(ADMIN_ID, `🛒 <b>New Order</b>\nUser: ${u.name}\nID: <code>${u.telegram_id}</code>\nProduct: ${p.name}\nAmount: ₹${money(p.price)}\nOrder: ${code}\nDelivery: ${status}`, { parse_mode: 'HTML' }).catch(() => {});
});

bot.action('orders', async (ctx) => { await answer(ctx); const u = await requireVerified(ctx); if (!u) return; const rows = await all('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 15', [u.id]); const buttons = rows.map(o => [Markup.button.callback(`${o.order_code} • ${o.product_name}`, `order_${o.id}`)]); buttons.push([Markup.button.callback('⬅️ Back', 'home')]); await editOrSend(ctx, rows.length ? '📦 <b>MY ORDERS</b>\n\nSelect an order:' : '📭 You have no orders yet.', Markup.inlineKeyboard(buttons)); });
bot.action(/^order_(\d+)$/, async (ctx) => { await answer(ctx); const u = await requireVerified(ctx); if (!u) return; const o = await get('SELECT * FROM orders WHERE id=? AND user_id=?', [ctx.match[1], u.id]); if (!o) return; await editOrSend(ctx, `📦 <b>ORDER DETAILS</b>\n\n🆔 Order ID: ${o.order_code}\n📦 Product: ${o.product_name}\n💰 Amount: ₹${money(o.amount)}\n📅 Date: ${o.created_at}\n💳 Payment Status: ${o.payment_status}\n🚚 Delivery Status: ${o.delivery_status}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ My Orders', 'orders')]])); });

bot.action('profile', async (ctx) => { await answer(ctx); const u = await requireVerified(ctx); if (!u) return; const stats = await get('SELECT COUNT(*) orders, COALESCE(SUM(amount),0) spent FROM orders WHERE user_id=?', [u.id]); const deps = await get("SELECT COUNT(*) deposits FROM deposits WHERE user_id=? AND status='approved'", [u.id]); const refs = await get('SELECT COUNT(*) refs FROM users WHERE referred_by=?', [u.telegram_id]); await editOrSend(ctx, `📄 <b>ACCOUNT INFORMATION</b>\n┣ 👤 Name: ${u.name || 'User'}\n┣ 📱 Phone: ${u.phone}\n\n💰 <b>YOUR BALANCE</b>\n┣ 🇮🇳 INR: ₹${money(u.balance)}\n\n📊 <b>STATISTICS</b>\n┣ 📦 Orders: ${stats.orders}\n┣ 💸 Deposits: ${deps.deposits}\n┣ 🎁 Referral Earned: ₹${money(u.referral_earned)}\n┣ 👥 Referrals: ${refs.refs}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); });
bot.action('referral', async (ctx) => { await answer(ctx); const u = await requireVerified(ctx); if (!u) return; await editOrSend(ctx, `🎁 <b>REFER & EARN</b>\n\nYour Link:\nhttps://t.me/${botUsername}?start=${u.telegram_id}\n\nReward:\n10% referral deposit commission`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); });
bot.action('leaderboard', async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; const buyers = await all('SELECT u.name, COUNT(o.id) c FROM orders o JOIN users u ON u.id=o.user_id GROUP BY u.id ORDER BY c DESC LIMIT 5'); const spenders = await all('SELECT u.name, SUM(o.amount) s FROM orders o JOIN users u ON u.id=o.user_id GROUP BY u.id ORDER BY s DESC LIMIT 5'); const referrers = await all('SELECT name, referral_earned FROM users ORDER BY referral_earned DESC LIMIT 5'); const list = (rows, f) => rows.map((r,i)=>`${i+1}. ${f(r)}`).join('\n') || 'No data yet'; await editOrSend(ctx, `🏆 <b>Top Buyers</b>\n${list(buyers,r=>`${r.name} • ${r.c} orders`)}\n\n💰 <b>Top Spenders</b>\n${list(spenders,r=>`${r.name} • ₹${money(r.s)}`)}\n\n🎁 <b>Top Referrers</b>\n${list(referrers,r=>`${r.name} • ₹${money(r.referral_earned)}`)}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); });
bot.action('redeem_open', async (ctx) => { await answer(ctx); if (!await requireVerified(ctx)) return; userStates.set(ctx.from.id, { flow: 'redeem' }); await editOrSend(ctx, '🎟 <b>REDEEM CODE</b>\n\nSend your redeem code now, or use /redeem CODE.', Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]])); });
bot.command('redeem', async (ctx) => { const u = await requireVerified(ctx); if (!u) return; const code = ctx.message.text.split(/\s+/)[1]; if (!code) { userStates.set(ctx.from.id, { flow: 'redeem' }); return cleanSend(ctx, '🎟 Send your redeem code:', Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel')]])); } await redeemCode(ctx, code, u); });
async function redeemCode(ctx, raw, u) { const code = String(raw).trim().toUpperCase(); const c = await get('SELECT * FROM coupons WHERE code=? AND active=1', [code]); if (!c) return cleanSend(ctx, '❌ Invalid redeem code.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); if (c.used_count >= c.usage_limit) return cleanSend(ctx, '❌ This redeem code has reached its usage limit.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); const used = await get('SELECT id FROM coupon_redemptions WHERE coupon_id=? AND user_id=?', [c.id, u.id]); if (used) return cleanSend(ctx, '❌ You already redeemed this code.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])); await run('INSERT INTO coupon_redemptions(coupon_id,user_id) VALUES(?,?)', [c.id, u.id]); await run('UPDATE coupons SET used_count=used_count+1 WHERE id=?', [c.id]); await run('UPDATE users SET balance=balance+? WHERE id=?', [c.reward, u.id]); userStates.delete(ctx.from.id); await cleanSend(ctx, `✅ Redeem Successful!\n\n₹${money(c.reward)} added to your wallet.`, mainKb()); }

// Admin panel
const adminKb = () => Markup.inlineKeyboard([
  [Markup.button.callback('👥 Users', 'ad_users'), Markup.button.callback('💰 Add Balance', 'ad_addbal')],
  [Markup.button.callback('💳 Deposits', 'ad_deposits'), Markup.button.callback('📂 Categories', 'ad_categories')],
  [Markup.button.callback('🛒 Store', 'ad_store'), Markup.button.callback('📦 Orders', 'ad_orders')],
  [Markup.button.callback('🎟 Coupons', 'ad_coupons'), Markup.button.callback('📢 Broadcast', 'ad_broadcast')],
  [Markup.button.callback('🏆 Leaderboard', 'ad_leaderboard'), Markup.button.callback('⚙️ Settings', 'ad_settings')]
]);
bot.command('sparlexadmin', async (ctx) => { if (!isAdmin(ctx)) return ctx.reply('❌ You are not authorized.'); await ctx.reply('🔐 <b>SPARLEX ADMIN PANEL</b>', { parse_mode: 'HTML', ...adminKb() }); });
bot.action('ad_home', async (ctx) => { await answer(ctx); if (!isAdmin(ctx)) return; adminStates.delete(ctx.from.id); await editOrSend(ctx, '🔐 <b>SPARLEX ADMIN PANEL</b>', adminKb()); });
bot.action('ad_users', async (ctx) => { await answer(ctx); if (!isAdmin(ctx)) return; const rows = await all('SELECT * FROM users ORDER BY id DESC LIMIT 20'); const buttons = rows.map(u=>[Markup.button.callback(`${u.banned?'🚫':'👤'} ${u.name || u.telegram_id}`, `ad_user_${u.id}`)]); buttons.push([Markup.button.callback('🔎 Search', 'ad_user_search'), Markup.button.callback('⬅️ Back', 'ad_home')]); await editOrSend(ctx, '👥 <b>USERS</b>\nLatest verified and unverified users:', Markup.inlineKeyboard(buttons)); });
bot.action('ad_user_search', async (ctx)=>{ await answer(ctx); if(!isAdmin(ctx)) return; adminStates.set(ctx.from.id,{flow:'user_search'}); await editOrSend(ctx,'🔎 Send name, phone, username, or Telegram ID:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_users')]])); });
bot.action(/^ad_user_(\d+)$/, async (ctx)=>{ await answer(ctx); if(!isAdmin(ctx)) return; const u=await get('SELECT * FROM users WHERE id=?',[ctx.match[1]]); if(!u)return; await editOrSend(ctx,`👤 <b>USER DETAILS</b>\nName: ${u.name}\nPhone: ${u.phone||'N/A'}\nTelegram ID: <code>${u.telegram_id}</code>\nUsername: @${u.username||'N/A'}\nBalance: ₹${money(u.balance)}\nVerified: ${u.verified?'Yes':'No'}\nStatus: ${u.banned?'Banned':'Active'}`,Markup.inlineKeyboard([[Markup.button.url('Open Chat',`tg://user?id=${u.telegram_id}`)],[Markup.button.callback(u.banned?'✅ Unban':'🚫 Ban',`ad_ban_${u.id}`),Markup.button.callback('💰 Add Balance',`ad_addbal_${u.id}`)],[Markup.button.callback('⬅️ Users','ad_users')]])); });
bot.action(/^ad_ban_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx)) return; const u=await get('SELECT * FROM users WHERE id=?',[ctx.match[1]]); await run('UPDATE users SET banned=? WHERE id=?',[u.banned?0:1,u.id]); await editOrSend(ctx, u.banned ? '✅ User unbanned.' : '🚫 User banned.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Users','ad_users')]])); });
bot.action(/^ad_addbal(?:_(\d+))?$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'admin_add_balance',userId:ctx.match?.[1]||null}); await editOrSend(ctx,'💰 Send: <code>telegram_id amount</code>\nExample: <code>123456789 500</code>',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_home')]])); });
bot.action('ad_deposits', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx)) return; const rows=await all("SELECT d.*,u.name,u.telegram_id FROM deposits d JOIN users u ON u.id=d.user_id WHERE d.status='pending' ORDER BY d.id DESC LIMIT 20"); const buttons=rows.map(d=>[Markup.button.callback(`₹${money(d.amount)} • ${d.name}`,`ad_dep_${d.id}`)]); buttons.push([Markup.button.callback('⬅️ Back','ad_home')]); await editOrSend(ctx,rows.length?'💳 <b>PENDING DEPOSITS</b>':'✅ No pending deposits.',Markup.inlineKeyboard(buttons)); });
bot.action(/^ad_dep_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const d=await get('SELECT d.*,u.name,u.phone,u.telegram_id FROM deposits d JOIN users u ON u.id=d.user_id WHERE d.id=?',[ctx.match[1]]); if(!d)return; await editOrSend(ctx,`💳 <b>DEPOSIT PROOF</b>\nUser: ${d.name}\nTelegram ID: <code>${d.telegram_id}</code>\nPhone: ${d.phone}\nAmount: ₹${money(d.amount)}\nUTR: <code>${d.utr}</code>\nStatus: ${d.status}`,Markup.inlineKeyboard([[Markup.button.callback('✅ Approve',`dep_ok_${d.id}`),Markup.button.callback('❌ Reject',`dep_no_${d.id}`)],[Markup.button.callback('⬅️ Deposits','ad_deposits')]])); if(d.screenshot_file_id) await ctx.replyWithPhoto(d.screenshot_file_id).catch(()=>ctx.replyWithDocument(d.screenshot_file_id).catch(()=>{})); });
bot.action(/^dep_ok_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await approveDeposit(ctx.match[1], true); await editOrSend(ctx,'✅ Deposit approved.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Deposits','ad_deposits')]])); });
bot.action(/^dep_no_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await approveDeposit(ctx.match[1], false); await editOrSend(ctx,'❌ Deposit rejected.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Deposits','ad_deposits')]])); });
async function approveDeposit(id, ok){ const d=await get('SELECT d.*,u.* FROM deposits d JOIN users u ON u.id=d.user_id WHERE d.id=?',[id]); if(!d||d.status!=='pending')return; await run('UPDATE deposits SET status=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?',[ok?'approved':'rejected',id]); if(ok){ await run('UPDATE users SET balance=balance+? WHERE id=?',[d.amount,d.user_id]); if(d.referred_by){ const reward=Number(d.amount)*Number(await setting('referral_percent'))/100; const ref=await get('SELECT * FROM users WHERE telegram_id=?',[d.referred_by]); if(ref){ await run('UPDATE users SET balance=balance+?, referral_earned=referral_earned+? WHERE id=?',[reward,reward,ref.id]); bot.telegram.sendMessage(ref.telegram_id,`🎁 Referral commission received: ₹${money(reward)}`).catch(()=>{}); } } await bot.telegram.sendMessage(d.telegram_id,'✅ Balance Added Successfully!').catch(()=>{}); } else await bot.telegram.sendMessage(d.telegram_id,'❌ Payment Rejected.').catch(()=>{}); }

bot.action('ad_categories', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const rows=await all('SELECT * FROM categories ORDER BY id'); const buttons=rows.map(c=>[Markup.button.callback(`${c.active?'✅':'❌'} ${c.name}`,`ad_cat_${c.id}`)]); buttons.push([Markup.button.callback('➕ Add Category','ad_cat_add'),Markup.button.callback('⬅️ Back','ad_home')]); await editOrSend(ctx,'📂 <b>CATEGORIES</b>',Markup.inlineKeyboard(buttons)); });
bot.action('ad_cat_add', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'cat_add'}); await editOrSend(ctx,'➕ Send category name:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_categories')]])); });
bot.action(/^ad_cat_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const c=await get('SELECT * FROM categories WHERE id=?',[ctx.match[1]]); await editOrSend(ctx,`📂 ${c.name}`,Markup.inlineKeyboard([[Markup.button.callback(c.active?'Disable':'Enable',`ad_cat_toggle_${c.id}`),Markup.button.callback('🗑 Delete',`ad_cat_del_${c.id}`)],[Markup.button.callback('✏️ Rename',`ad_cat_ren_${c.id}`)],[Markup.button.callback('⬅️ Back','ad_categories')]])); });
bot.action(/^ad_cat_toggle_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const c=await get('SELECT * FROM categories WHERE id=?',[ctx.match[1]]); await run('UPDATE categories SET active=? WHERE id=?',[c.active?0:1,c.id]); await ctx.answerCbQuery('Updated'); });
bot.action(/^ad_cat_del_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await run('DELETE FROM categories WHERE id=?',[ctx.match[1]]); await editOrSend(ctx,'🗑 Category deleted.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Categories','ad_categories')]])); });
bot.action(/^ad_cat_ren_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'cat_rename',id:ctx.match[1]}); await editOrSend(ctx,'✏️ Send new category name:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_categories')]])); });

bot.action('ad_store', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const rows=await all('SELECT p.*,c.name cat FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.id DESC LIMIT 20'); const buttons=rows.map(p=>[Markup.button.callback(`${p.active?'✅':'❌'} ${p.name} ₹${money(p.price)}`,`ad_prod_${p.id}`)]); buttons.push([Markup.button.callback('➕ Add Product','ad_prod_add'),Markup.button.callback('⬅️ Back','ad_home')]); await editOrSend(ctx,'🛒 <b>STORE PRODUCTS</b>',Markup.inlineKeyboard(buttons)); });
bot.action('ad_prod_add', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const cats=await all('SELECT * FROM categories ORDER BY id'); adminStates.set(ctx.from.id,{flow:'prod_cat',data:{}}); await editOrSend(ctx,'➕ Select product category:',Markup.inlineKeyboard([...cats.map(c=>[Markup.button.callback(c.name,`ad_prod_cat_${c.id}`)]),[Markup.button.callback('⬅️ Back','ad_store')]])); });
bot.action(/^ad_prod_cat_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'prod_name',data:{category_id:ctx.match[1]}}); await editOrSend(ctx,'📦 Send product name:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_store')]])); });
bot.action(/^ad_prod_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const p=await get('SELECT * FROM products WHERE id=?',[ctx.match[1]]); await editOrSend(ctx,`📦 <b>${p.name}</b>\nPrice: ₹${money(p.price)}\nDelivery: ${p.delivery_type}\nActive: ${p.active?'Yes':'No'}\nFile: ${p.file_id?'Uploaded':'Missing'}`,Markup.inlineKeyboard([[Markup.button.callback('🔁 Toggle Active',`ad_prod_toggle_${p.id}`),Markup.button.callback('🗑 Delete',`ad_prod_del_${p.id}`)],[Markup.button.callback('📤 Replace File',`ad_prod_file_${p.id}`),Markup.button.callback('✏️ Price',`ad_prod_price_${p.id}`)],[Markup.button.callback('⬅️ Store','ad_store')]])); });
bot.action(/^ad_prod_toggle_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const p=await get('SELECT * FROM products WHERE id=?',[ctx.match[1]]); await run('UPDATE products SET active=? WHERE id=?',[p.active?0:1,p.id]); await editOrSend(ctx,'✅ Product updated.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Store','ad_store')]])); });
bot.action(/^ad_prod_del_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await run('DELETE FROM products WHERE id=?',[ctx.match[1]]); await editOrSend(ctx,'🗑 Product deleted.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Store','ad_store')]])); });
bot.action(/^ad_prod_file_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'prod_replace_file',id:ctx.match[1]}); await editOrSend(ctx,'📤 Upload replacement Telegram document/file:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Store','ad_store')]])); });
bot.action(/^ad_prod_price_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'prod_price_edit',id:ctx.match[1]}); await editOrSend(ctx,'💰 Send new price:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Store','ad_store')]])); });

bot.action('ad_orders', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const rows=await all('SELECT o.*,u.name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 20'); const buttons=rows.map(o=>[Markup.button.callback(`${o.order_code} • ${o.name} • ${o.delivery_status}`,`ad_order_${o.id}`)]); buttons.push([Markup.button.callback('⬅️ Back','ad_home')]); await editOrSend(ctx,'📦 <b>ORDERS</b>',Markup.inlineKeyboard(buttons)); });
bot.action(/^ad_order_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const o=await get('SELECT o.*,u.name,u.telegram_id FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?',[ctx.match[1]]); await editOrSend(ctx,`📦 <b>ORDER</b>\n${o.order_code}\nUser: ${o.name} (<code>${o.telegram_id}</code>)\nProduct: ${o.product_name}\nAmount: ₹${money(o.amount)}\nPayment: ${o.payment_status}\nDelivery: ${o.delivery_status}`,Markup.inlineKeyboard([[Markup.button.callback('✅ Mark Delivered',`ad_order_done_${o.id}`),Markup.button.callback('🗑 Delete',`ad_order_del_${o.id}`)],[Markup.button.callback('⬅️ Orders','ad_orders')]])); });
bot.action(/^ad_order_done_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await run("UPDATE orders SET delivery_status='completed' WHERE id=?",[ctx.match[1]]); await editOrSend(ctx,'✅ Order marked delivered.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orders','ad_orders')]])); });
bot.action(/^ad_order_del_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await run('DELETE FROM orders WHERE id=?',[ctx.match[1]]); await editOrSend(ctx,'🗑 Order deleted.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orders','ad_orders')]])); });

bot.action('ad_coupons', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const rows=await all('SELECT * FROM coupons ORDER BY id DESC LIMIT 20'); const buttons=rows.map(c=>[Markup.button.callback(`${c.active?'✅':'❌'} ${c.code} ₹${money(c.reward)} ${c.used_count}/${c.usage_limit}`,`ad_coupon_${c.id}`)]); buttons.push([Markup.button.callback('➕ Create Coupon','ad_coupon_add'),Markup.button.callback('⬅️ Back','ad_home')]); await editOrSend(ctx,'🎟 <b>COUPONS</b>',Markup.inlineKeyboard(buttons)); });
bot.action('ad_coupon_add', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'coupon_add'}); await editOrSend(ctx,'🎟 Send: <code>CODE reward usage_limit</code>\nExample: <code>SPARLEX50 50 10</code>',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_coupons')]])); });
bot.action(/^ad_coupon_(\d+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; await run('DELETE FROM coupons WHERE id=?',[ctx.match[1]]); await editOrSend(ctx,'🗑 Coupon deleted.',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Coupons','ad_coupons')]])); });
bot.action('ad_broadcast', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'broadcast'}); await editOrSend(ctx,'📢 Send broadcast message for all verified users:',Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_home')]])); });
bot.action('ad_leaderboard', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const buyers=await all('SELECT u.name, COUNT(o.id) c FROM orders o JOIN users u ON u.id=o.user_id GROUP BY u.id ORDER BY c DESC LIMIT 10'); const spenders=await all('SELECT u.name, SUM(o.amount) s FROM orders o JOIN users u ON u.id=o.user_id GROUP BY u.id ORDER BY s DESC LIMIT 10'); const referrers=await all('SELECT name, referral_earned FROM users ORDER BY referral_earned DESC LIMIT 10'); const list=(rows,f)=>rows.map((r,i)=>`${i+1}. ${f(r)}`).join('\n')||'No data yet'; await editOrSend(ctx, `🏆 <b>ADMIN LEADERBOARD</b>\n\n<b>Top Buyers</b>\n${list(buyers,r=>`${r.name} • ${r.c} orders`)}\n\n<b>Top Spenders</b>\n${list(spenders,r=>`${r.name} • ₹${money(r.s)}`)}\n\n<b>Top Referrers</b>\n${list(referrers,r=>`${r.name} • ₹${money(r.referral_earned)}`)}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_home')]])); });
bot.action('ad_settings', async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; const upi=await setting('upi_id'), tg=await setting('telegram_support'), pc=await setting('proof_channel'), wa=await setting('whatsapp_number'); await editOrSend(ctx,`⚙️ <b>SETTINGS</b>\nUPI: <code>${upi}</code>\nSupport: ${tg}\nProofs: ${pc}\nWhatsApp: ${wa}`,Markup.inlineKeyboard([[Markup.button.callback('UPI','ad_set_upi_id'),Markup.button.callback('Support','ad_set_telegram_support')],[Markup.button.callback('Proofs','ad_set_proof_channel'),Markup.button.callback('WhatsApp','ad_set_whatsapp_number')],[Markup.button.callback('⬅️ Back','ad_home')]])); });
bot.action(/^ad_set_(.+)$/, async(ctx)=>{ await answer(ctx); if(!isAdmin(ctx))return; adminStates.set(ctx.from.id,{flow:'setting',key:ctx.match[1]}); await editOrSend(ctx,`⚙️ Send new value for ${ctx.match[1]}:`,Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back','ad_settings')]])); });

bot.on('photo', async(ctx)=>{ const st=userStates.get(ctx.from.id); if(st?.flow==='deposit_screenshot'){ const u=await requireVerified(ctx); const file=ctx.message.photo.at(-1).file_id; const ins=await run('INSERT INTO deposits(user_id,amount,utr,screenshot_file_id) VALUES(?,?,?,?)',[u.id,st.amount,st.utr,file]); userStates.delete(ctx.from.id); const processing=await ctx.reply('⏳ Processing your proof...'); setTimeout(()=>ctx.telegram.deleteMessage(ctx.chat.id,processing.message_id).catch(()=>{}),1500); await cleanSend(ctx,'📸 <b>Proof Submitted Successfully!</b>\n\n✅ Your payment is under review.\n⏳ Please wait 5-10 minutes.',Markup.inlineKeyboard([[Markup.button.callback('🛒 Shop Again','shop')],[Markup.button.callback('❌ Cancel','cancel')]])); await bot.telegram.sendPhoto(ADMIN_ID,file,{caption:`💳 <b>New Deposit Proof</b>\nUser: ${u.name}\nTelegram ID: <code>${u.telegram_id}</code>\nPhone: ${u.phone}\nAmount: ₹${money(st.amount)}\nUTR: <code>${st.utr}</code>`,parse_mode:'HTML',...Markup.inlineKeyboard([[Markup.button.callback('✅ Approve',`dep_ok_${ins.lastID}`),Markup.button.callback('❌ Reject',`dep_no_${ins.lastID}`)]])}).catch(()=>{}); }});
bot.on('document', async(ctx)=>{ const st=adminStates.get(ctx.from.id); if(!isAdmin(ctx)||!st)return; const doc=ctx.message.document; if(st.flow==='prod_file'){ const d=st.data; await run('INSERT INTO products(name,description,price,category_id,demo_link,file_id,file_name,delivery_type,active) VALUES(?,?,?,?,?,?,?,?,1)',[d.name,d.description,d.price,d.category_id,d.demo_link,doc.file_id,doc.file_name,d.delivery_type]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Product added successfully.',adminKb()); } if(st.flow==='prod_replace_file'){ await run('UPDATE products SET file_id=?, file_name=?, delivery_type="auto" WHERE id=?',[doc.file_id,doc.file_name,st.id]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Product file updated.',adminKb()); }});

bot.on('text', async(ctx)=>{ const text=ctx.message.text.trim(); if(text.startsWith('/')) return; const aid=ctx.from.id; const ast=adminStates.get(aid); if(ast&&isAdmin(ctx)) return handleAdminText(ctx,text,ast); const u=await requireVerified(ctx); if(!u)return; const st=userStates.get(ctx.from.id); if(!st)return; if(st.flow==='deposit_amount'){ const amount=Number(text); if(!Number.isFinite(amount)||amount<10)return ctx.reply('❌ Enter a valid amount (minimum ₹10).'); userStates.set(ctx.from.id,{flow:'deposit_utr',amount}); return ctx.reply('🧾 Send UTR / Transaction ID:',Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','cancel')]])); } if(st.flow==='deposit_utr'){ userStates.set(ctx.from.id,{...st,flow:'deposit_screenshot',utr:text}); return ctx.reply('📸 Upload payment screenshot now:',Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel','cancel')]])); } if(st.flow==='redeem') return redeemCode(ctx,text,u); });
async function handleAdminText(ctx,text,st){ if(st.flow==='user_search'){ const q=`%${text}%`; const rows=await all('SELECT * FROM users WHERE telegram_id LIKE ? OR phone LIKE ? OR username LIKE ? OR name LIKE ? LIMIT 20',[q,q,q,q]); adminStates.delete(ctx.from.id); return ctx.reply(rows.map(u=>`${u.name} • ${u.phone||'N/A'} • ${u.telegram_id}`).join('\n')||'No users found.',adminKb()); } if(st.flow==='admin_add_balance'){ const parts=text.split(/\s+/); const tid=st.userId ? st.userId : parts[0]; const amount=Number(st.userId ? parts[0] : parts[1]); const u=await get('SELECT * FROM users WHERE telegram_id=? OR id=?',[tid,tid]); if(!u||!Number.isFinite(amount)||amount<=0)return ctx.reply(st.userId?'❌ Send a valid amount.':'❌ Invalid. Send telegram_id amount.'); await run('UPDATE users SET balance=balance+? WHERE id=?',[amount,u.id]); adminStates.delete(ctx.from.id); await bot.telegram.sendMessage(u.telegram_id,`✅ Balance Added Successfully!\n₹${money(amount)} added by admin.`).catch(()=>{}); return ctx.reply('✅ Balance added.',adminKb()); } if(st.flow==='cat_add'){ await run('INSERT INTO categories(name) VALUES(?)',[text]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Category added.',adminKb()); } if(st.flow==='cat_rename'){ await run('UPDATE categories SET name=? WHERE id=?',[text,st.id]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Category renamed.',adminKb()); } if(st.flow==='prod_name'){ st.data.name=text; st.flow='prod_desc'; adminStates.set(ctx.from.id,st); return ctx.reply('📝 Send description:'); } if(st.flow==='prod_desc'){ st.data.description=text; st.flow='prod_price'; adminStates.set(ctx.from.id,st); return ctx.reply('💰 Send price:'); } if(st.flow==='prod_price'){ const price=Number(text); if(!Number.isFinite(price)||price<0)return ctx.reply('❌ Send valid price.'); st.data.price=price; st.flow='prod_demo'; adminStates.set(ctx.from.id,st); return ctx.reply('🔗 Send demo link or N/A:'); } if(st.flow==='prod_demo'){ st.data.demo_link=text; st.flow='prod_delivery'; adminStates.set(ctx.from.id,st); return ctx.reply('⚙️ Send delivery type: auto or manual'); } if(st.flow==='prod_delivery'){ st.data.delivery_type=text.toLowerCase()==='manual'?'manual':'auto'; st.flow='prod_file'; adminStates.set(ctx.from.id,st); return ctx.reply(st.data.delivery_type==='auto'?'📤 Upload Telegram document/file for auto delivery:':'📤 Upload file anyway for records, or send /skip not supported; upload a file.'); } if(st.flow==='prod_price_edit'){ const price=Number(text); if(!Number.isFinite(price))return ctx.reply('❌ Invalid price.'); await run('UPDATE products SET price=? WHERE id=?',[price,st.id]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Price updated.',adminKb()); } if(st.flow==='coupon_add'){ const [code,reward,limit]=text.split(/\s+/); await run('INSERT OR REPLACE INTO coupons(code,reward,usage_limit,active) VALUES(?,?,?,1)',[code.toUpperCase(),Number(reward),Number(limit||1)]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Coupon saved.',adminKb()); } if(st.flow==='broadcast'){ const users=await all('SELECT telegram_id FROM users WHERE verified=1 AND banned=0'); let sent=0; for(const u of users){ try{ await bot.telegram.sendMessage(u.telegram_id,text,{parse_mode:'HTML'}); sent++; }catch{} } adminStates.delete(ctx.from.id); return ctx.reply(`✅ Broadcast sent to ${sent}/${users.length} users.`,adminKb()); } if(st.flow==='setting'){ await run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',[st.key,text]); adminStates.delete(ctx.from.id); return ctx.reply('✅ Setting updated.',adminKb()); } }

bot.catch((err, ctx) => { console.error('Bot error', err, ctx.update); });

const app = express();
app.get('/', (_req, res) => res.send('Sparlex Store Bot Online'));
app.listen(PORT, () => console.log(`Keep-alive server running on ${PORT}`));

await initDb();
const me = await bot.telegram.getMe();
botUsername = me.username;
bot.launch();
console.log(`Sparlex Store bot running as @${botUsername}`);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
