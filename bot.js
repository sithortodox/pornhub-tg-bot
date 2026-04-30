import { Bot, session, InlineKeyboard, InputFile } from "grammy";
import pornhub from "pornhub";
import { load } from "cheerio";
import axios from "axios";
import FormData from "form-data";
import { spawn } from "child_process";
import { createWriteStream, createReadStream, existsSync, statSync, unlinkSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const TMP_DIR = join(tmpdir(), "pornhub-bot");
if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}

const DATA_DIR = "/app/data";
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const POSTED_VIDEOS_FILE = join(DATA_DIR, "posted_videos.json");
const POST_STATS_FILE = join(DATA_DIR, "post_stats.json");
const SUBMISSIONS_FILE = join(DATA_DIR, "submissions.json");
const SUBSCRIBERS_FILE = join(DATA_DIR, "subscribers.json");
const SETTINGS_FILE = join(DATA_DIR, "settings.json");
const CHANNEL_ID = process.env.CHANNEL_ID;
const BOT_API_URL = process.env.BOT_API_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID || "0");

const WATERMARK_TEXT = "PornHub на ладони";
const CHANNEL_USERNAME = "@pornhub_on_your_palm";

function loadSettings() {
  if (existsSync(SETTINGS_FILE)) {
    try {
      return JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    } catch (e) {
      return {
        autoPostEnabled: true,
        interval: 30,
        watermarkEnabled: false,
        maxVideoSize: 500,
        sourcePreference: "mixed"
      };
    }
  }
  return {
    autoPostEnabled: true,
    interval: 30,
    watermarkEnabled: false,
    maxVideoSize: 500,
    sourcePreference: "mixed"
  };
}

function saveSettings(settings) {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings));
}

const settings = loadSettings();

function loadPostedVideos() {
  if (existsSync(POSTED_VIDEOS_FILE)) {
    try {
      return JSON.parse(readFileSync(POSTED_VIDEOS_FILE, "utf8"));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function savePostedVideos(videos) {
  writeFileSync(POSTED_VIDEOS_FILE, JSON.stringify(videos.slice(-1000)));
}

function loadPostStats() {
  if (existsSync(POST_STATS_FILE)) {
    try {
      return JSON.parse(readFileSync(POST_STATS_FILE, "utf8"));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function savePostStats(stats) {
  writeFileSync(POST_STATS_FILE, JSON.stringify(stats));
}

function loadSubmissions() {
  if (existsSync(SUBMISSIONS_FILE)) {
    try {
      return JSON.parse(readFileSync(SUBMISSIONS_FILE, "utf8"));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveSubmissions(submissions) {
  writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions.slice(-100)));
}

function loadSubscribers() {
  if (existsSync(SUBSCRIBERS_FILE)) {
    try {
      return JSON.parse(readFileSync(SUBSCRIBERS_FILE, "utf8"));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveSubscribers(subscribers) {
  writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([...new Set(subscribers)]));
}

const bot = new Bot(BOT_TOKEN, {
  client: BOT_API_URL ? { apiUrl: BOT_API_URL } : undefined
});

console.log("Using Bot API URL:", BOT_API_URL || "https://api.telegram.org");

bot.catch((err) => {
  console.error("Bot error:", err);
});

bot.on("channel_post", async (ctx) => {
  return;
});

const CATEGORIES_CACHE = { data: null, timestamp: 0 };

const EXCLUDED_CATEGORIES = ["gay", "transgender", "trans", "twink", "bisexual"];

function filterVideoByCategories(video) {
  const categories = video.categories || [];
  const tags = video.tags || [];
  const allTerms = [...categories, ...tags].map(t => t.toLowerCase());
  
  for (const excluded of EXCLUDED_CATEGORIES) {
    if (allTerms.some(term => term.includes(excluded))) {
      return false;
    }
  }
  return true;
}

bot.use(
  session({
    initial: () => ({ state: null, adminPage: 0 }),
  })
);

const mainKeyboard = {
  keyboard: [
    [{ text: "Search videos" }, { text: "Popular" }],
    [{ text: "Categories" }, { text: "New" }],
    [{ text: "Submit video" }, { text: "Top videos" }],
  ],
  resize_keyboard: true,
};

async function getCategories() {
  const now = Date.now();
  if (CATEGORIES_CACHE.data && now - CATEGORIES_CACHE.timestamp < 3600000) {
    return CATEGORIES_CACHE.data;
  }
  
  try {
    const response = await axios.get("https://www.pornhub.com/categories", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      }
    });
    
    const $ = load(response.data);
    const categories = [];
    
    $("a.item[href*='/categories/']").each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr("href") || "";
      const slug = href.split("/categories/")[1]?.split("?")[0];
      
      if (name && slug && !categories.find(c => c.slug === slug)) {
        categories.push({ name, slug });
      }
    });
    
    if (categories.length === 0) {
      return getDefaultCategories();
    }
    
    CATEGORIES_CACHE.data = categories;
    CATEGORIES_CACHE.timestamp = now;
    return categories;
  } catch (error) {
    console.error("Categories fetch error:", error.message);
    return getDefaultCategories();
  }
}

function getDefaultCategories() {
  return [
    { name: "Amateur", slug: "amateur" },
    { name: "Anal", slug: "anal" },
    { name: "Asian", slug: "asian" },
    { name: "Babe", slug: "babe" },
    { name: "BBW", slug: "bbw" },
    { name: "Big Ass", slug: "big-ass" },
    { name: "Big Dick", slug: "big-dick" },
    { name: "Big Tits", slug: "big-tits" },
    { name: "Blonde", slug: "blonde" },
    { name: "Blowjob", slug: "blowjob" },
    { name: "Bondage", slug: "bondage" },
    { name: "Brunette", slug: "brunette" },
    { name: "Bukkake", slug: "bukkake" },
    { name: "Cartoon", slug: "cartoon" },
    { name: "Casting", slug: "casting" },
    { name: "Celebrity", slug: "celebrity" },
    { name: "College", slug: "college" },
    { name: "Creampie", slug: "creampie" },
    { name: "Cumshot", slug: "cumshot" },
    { name: "Ebony", slug: "ebony" },
    { name: "Euro", slug: "euro" },
    { name: "Fetish", slug: "fetish" },
    { name: "Fisting", slug: "fisting" },
    { name: "Gangbang", slug: "gangbang" },
    { name: "German", slug: "german" },
    { name: "Group", slug: "group" },
    { name: "Handjob", slug: "handjob" },
    { name: "Hardcore", slug: "hardcore" },
    { name: "HD Porn", slug: "hd-porn" },
    { name: "Indian", slug: "indian" },
    { name: "Interracial", slug: "interracial" },
    { name: "Japanese", slug: "japanese" },
    { name: "Latina", slug: "latina" },
    { name: "Lesbian", slug: "lesbian" },
    { name: "Massage", slug: "massage" },
    { name: "Masturbation", slug: "masturbation" },
    { name: "Mature", slug: "mature" },
    { name: "MILF", slug: "milf" },
    { name: "Orgy", slug: "orgy" },
    { name: "Party", slug: "party" },
    { name: "Pornstar", slug: "pornstar" },
    { name: "Public", slug: "public" },
    { name: "Pussy Licking", slug: "pussy-licking" },
    { name: "Red Head", slug: "red-head" },
    { name: "Rough Sex", slug: "rough-sex" },
    { name: "Russian", slug: "russian" },
    { name: "School", slug: "school" },
    { name: "Small Tits", slug: "small-tits" },
    { name: "Squirt", slug: "squirt" },
    { name: "Striptease", slug: "striptease" },
    { name: "Teen", slug: "teen" },
    { name: "Threesome", slug: "threesome" },
    { name: "Vintage", slug: "vintage" },
    { name: "Webcam", slug: "webcam" },
  ];
}

function isAdmin(ctx) {
  return ctx.from?.id === ADMIN_ID;
}

async function showAdminPanel(ctx) {
  if (!isAdmin(ctx)) {
    await ctx.reply("Admin only.");
    return;
  }
  
  const stats = loadPostStats();
  const postedVideos = loadPostedVideos();
  const subscribers = loadSubscribers();
  const submissions = loadSubmissions();
  const settings = loadSettings();
  
  let totalLikes = 0;
  let totalDislikes = 0;
  
  for (const msgId in stats) {
    totalLikes += stats[msgId].likes || 0;
    totalDislikes += stats[msgId].dislikes || 0;
  }
  
  const rating = totalLikes + totalDislikes > 0 
    ? ((totalLikes / (totalLikes + totalDislikes)) * 100).toFixed(1) 
    : 0;
  
  const statusEmoji = settings.autoPostEnabled ? "✅" : "❌";
  const watermarkEmoji = settings.watermarkEnabled ? "✅" : "❌";
  
  const text = `🎛 <b>Admin Panel</b>

📊 <b>Statistics</b>
├ 📤 Posts: ${postedVideos.length}
├ 👥 Subscribers: ${subscribers.length}
├ 📝 Submissions: ${submissions.length}
├ 👍 Likes: ${totalLikes}
├ 👎 Dislikes: ${totalDislikes}
└ ⭐ Rating: ${rating}%

⚙️ <b>Settings</b>
├ 📢 Auto-post: ${statusEmoji}
├ ⏱ Interval: ${settings.interval} min
├ 🏷 Watermark: ${watermarkEmoji}
└ 📦 Max size: ${settings.maxVideoSize} MB`;

  const keyboard = new InlineKeyboard()
    .text(`${settings.autoPostEnabled ? "⏸ Stop" : "▶️ Start"} Auto`, "admin_toggle_auto")
    .row()
    .text("⏱ -5min", "admin_interval_-5")
    .text(`${settings.interval} min`, "admin_noop")
    .text("⏱ +5min", "admin_interval_+5")
    .row()
    .text("📝 Submissions", "admin_submissions")
    .text("👥 Subscribers", "admin_subscribers")
    .row()
    .text("🏆 Top Videos", "admin_top")
    .text("📊 Analytics", "admin_analytics")
    .row()
    .text("🏷 Watermark", "admin_toggle_watermark")
    .text("🔄 Post Now", "admin_post_now")
    .row()
    .text("📢 Broadcast", "admin_broadcast")
    .text("🗑 Clear Data", "admin_clear");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

bot.callbackQuery(/^admin_/, async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Admin only." });
    return;
  }
  
  const action = ctx.callbackQuery.data.slice(6);
  const settings = loadSettings();
  
  if (action === "toggle_auto") {
    settings.autoPostEnabled = !settings.autoPostEnabled;
    saveSettings(settings);
    await ctx.answerCallbackQuery({ text: settings.autoPostEnabled ? "Auto-post enabled" : "Auto-post disabled" });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "toggle_watermark") {
    settings.watermarkEnabled = !settings.watermarkEnabled;
    saveSettings(settings);
    await ctx.answerCallbackQuery({ text: settings.watermarkEnabled ? "Watermark enabled" : "Watermark disabled" });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "interval_-5") {
    settings.interval = Math.max(5, settings.interval - 5);
    saveSettings(settings);
    await ctx.answerCallbackQuery({ text: `Interval: ${settings.interval} min` });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "interval_+5") {
    settings.interval = Math.min(120, settings.interval + 5);
    saveSettings(settings);
    await ctx.answerCallbackQuery({ text: `Interval: ${settings.interval} min` });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "submissions") {
    const submissions = loadSubmissions();
    if (submissions.length === 0) {
      await ctx.answerCallbackQuery({ text: "No submissions", show_alert: true });
      return;
    }
    
    let msg = "📝 <b>Submitted Videos</b>\n\n";
    submissions.slice(-10).forEach((s, i) => {
      msg += `${i + 1}. ${s.title?.substring(0, 35) || "No title"}...\n`;
      msg += `   by: @${s.username || "anonymous"}\n`;
      msg += `   ${s.url}\n\n`;
    });
    
    const keyboard = new InlineKeyboard()
      .text("✅ Approve All", "admin_approve_all")
      .text("🗑 Clear", "admin_clear_submissions")
      .row()
      .text("◀️ Back", "admin_back");
    
    await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    return;
  }
  
  if (action === "subscribers") {
    const subscribers = loadSubscribers();
    let msg = `👥 <b>Subscribers: ${subscribers.length}</b>\n\n`;
    
    if (subscribers.length > 0) {
      msg += "Recent subscribers:\n";
      subscribers.slice(-10).forEach((id, i) => {
        msg += `${i + 1}. ID: ${id}\n`;
      });
    }
    
    const keyboard = new InlineKeyboard()
      .text("◀️ Back", "admin_back");
    
    await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    return;
  }
  
  if (action === "top") {
    const stats = loadPostStats();
    const topVideos = [];
    
    for (const msgId in stats) {
      if (stats[msgId].title) {
        topVideos.push({
          title: stats[msgId].title,
          likes: stats[msgId].likes || 0,
          dislikes: stats[msgId].dislikes || 0,
        });
      }
    }
    
    if (topVideos.length === 0) {
      await ctx.answerCallbackQuery({ text: "No data yet", show_alert: true });
      return;
    }
    
    topVideos.sort((a, b) => b.likes - a.likes);
    
    let msg = "🏆 <b>Top-10 Videos</b>\n\n";
    topVideos.slice(0, 10).forEach((v, i) => {
      const ratio = v.likes + v.dislikes > 0 
        ? ((v.likes / (v.likes + v.dislikes)) * 100).toFixed(0) 
        : 0;
      msg += `${i + 1}. ${v.title.substring(0, 30)}...\n`;
      msg += `   👍 ${v.likes} | 👎 ${v.dislikes} | ⭐ ${ratio}%\n\n`;
    });
    
    const keyboard = new InlineKeyboard()
      .text("◀️ Back", "admin_back");
    
    await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    return;
  }
  
  if (action === "analytics") {
    const stats = loadPostStats();
    const postedVideos = loadPostedVideos();
    const subscribers = loadSubscribers();
    const submissions = loadSubmissions();
    
    let totalLikes = 0;
    let totalDislikes = 0;
    
    for (const msgId in stats) {
      totalLikes += stats[msgId].likes || 0;
      totalDislikes += stats[msgId].dislikes || 0;
    }
    
    const avgLikes = postedVideos.length > 0 ? (totalLikes / postedVideos.length).toFixed(1) : 0;
    
    let msg = `📊 <b>Detailed Analytics</b>\n\n`;
    msg += `<b>Content</b>\n`;
    msg += `├ Total posts: ${postedVideos.length}\n`;
    msg += `├ Submissions pending: ${submissions.length}\n`;
    msg += `└ Posts this week: ~${Math.min(postedVideos.length, 7 * (60 / settings.interval))}\n\n`;
    msg += `<b>Engagement</b>\n`;
    msg += `├ Total reactions: ${totalLikes + totalDislikes}\n`;
    msg += `├ 👍 Likes: ${totalLikes}\n`;
    msg += `├ 👎 Dislikes: ${totalDislikes}\n`;
    msg += `├ Avg likes/post: ${avgLikes}\n`;
    msg += `└ Approval rate: ${totalLikes + totalDislikes > 0 ? ((totalLikes / (totalLikes + totalDislikes)) * 100).toFixed(1) : 0}%\n\n`;
    msg += `<b>Audience</b>\n`;
    msg += `└ Newsletter subs: ${subscribers.length}`;
    
    const keyboard = new InlineKeyboard()
      .text("◀️ Back", "admin_back");
    
    await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    return;
  }
  
  if (action === "post_now") {
    await ctx.answerCallbackQuery({ text: "Posting video..." });
    await postVideoToChannel();
    await ctx.answerCallbackQuery({ text: "Video posted!", show_alert: true });
    return;
  }
  
  if (action === "broadcast") {
    ctx.session.state = "admin_broadcast";
    await ctx.editMessageText("📢 <b>Broadcast</b>\n\nEnter message to send to all subscribers:", { parse_mode: "HTML" });
    return;
  }
  
  if (action === "clear") {
    const keyboard = new InlineKeyboard()
      .text("🗑 Clear Posts History", "admin_clear_posts")
      .row()
      .text("🗑 Clear Submissions", "admin_clear_submissions")
      .row()
      .text("🗑 Clear Subscribers", "admin_clear_subscribers")
      .row()
      .text("◀️ Back", "admin_back");
    
    await ctx.editMessageText("🗑 <b>Clear Data</b>\n\nSelect what to clear:", { parse_mode: "HTML", reply_markup: keyboard });
    return;
  }
  
  if (action === "clear_posts") {
    savePostedVideos([]);
    savePostStats({});
    await ctx.answerCallbackQuery({ text: "Posts history cleared!" });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "clear_submissions") {
    saveSubmissions([]);
    await ctx.answerCallbackQuery({ text: "Submissions cleared!" });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "clear_subscribers_confirm") {
    saveSubscribers([]);
    await ctx.answerCallbackQuery({ text: "Subscribers cleared!" });
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "back") {
    await showAdminPanel(ctx);
    return;
  }
  
  if (action === "noop") {
    await ctx.answerCallbackQuery();
    return;
  }
  
  await ctx.answerCallbackQuery();
});

bot.command("start", async (ctx) => {
  ctx.session.state = null;
  
  if (isAdmin(ctx)) {
    const keyboard = {
      keyboard: [
        [{ text: "🎛 Admin Panel" }],
        [{ text: "Search videos" }, { text: "Popular" }],
        [{ text: "Categories" }, { text: "New" }],
      ],
      resize_keyboard: true,
    };
    
    await ctx.reply(
      `Hi! I'm a Pornhub content search bot.\n\n<b>Admin mode enabled</b>`,
      { parse_mode: "HTML", reply_markup: keyboard }
    );
  } else {
    await ctx.reply(
      `Hi! I'm a Pornhub content search bot.\n\nAvailable commands:\n/start - Main menu\n/search - Search videos\n/popular - Popular videos\n/newest - New videos\n/submit - Submit your video\n/top - Top videos by likes\n/subscribe - Subscribe to announcements\n/help - Help`,
      { reply_markup: mainKeyboard }
    );
  }
});

bot.command("admin", async (ctx) => {
  await showAdminPanel(ctx);
});

bot.hears("🎛 Admin Panel", async (ctx) => {
  await showAdminPanel(ctx);
});

bot.command("help", async (ctx) => {
  ctx.session.state = null;
  await ctx.reply(
    `How to use the bot:\n\n1. Search videos - enter a search query\n2. Popular - view popular videos\n3. New - view new videos\n4. By link - get video info by link\n5. Submit video - send a link for channel publication`
  );
});

bot.command("analytics", async (ctx) => {
  const stats = loadPostStats();
  const postedVideos = loadPostedVideos();
  const subscribers = loadSubscribers();
  const submissions = loadSubmissions();
  
  let totalLikes = 0;
  let totalDislikes = 0;
  const topVideos = [];
  
  for (const msgId in stats) {
    totalLikes += stats[msgId].likes || 0;
    totalDislikes += stats[msgId].dislikes || 0;
    
    if (stats[msgId].title) {
      topVideos.push({
        title: stats[msgId].title,
        likes: stats[msgId].likes || 0,
        dislikes: stats[msgId].dislikes || 0,
      });
    }
  }
  
  topVideos.sort((a, b) => b.likes - a.likes);
  
  let msg = `📊 Channel Analytics ${CHANNEL_USERNAME}\n\n`;
  msg += `📈 Metrics:\n`;
  msg += `├ 📤 Total posts: ${postedVideos.length}\n`;
  msg += `├ 👥 Subscribers: ${subscribers.length}\n`;
  msg += `├ 📝 Submissions: ${submissions.length}\n`;
  msg += `├ 👍 Likes: ${totalLikes}\n`;
  msg += `├ 👎 Dislikes: ${totalDislikes}\n`;
  msg += `└ ⭐ Rating: ${totalLikes > 0 ? ((totalLikes / (totalLikes + totalDislikes)) * 100).toFixed(1) : 0}%\n\n`;
  
  if (topVideos.length > 0) {
    msg += `🏆 Top-3 videos:\n`;
    topVideos.slice(0, 3).forEach((v, i) => {
      msg += `${i + 1}. ${v.title.substring(0, 40)}... (${v.likes}👍)\n`;
    });
  }
  
  await ctx.reply(msg);
});

bot.command("top", async (ctx) => {
  const stats = loadPostStats();
  const topVideos = [];
  
  for (const msgId in stats) {
    if (stats[msgId].title) {
      topVideos.push({
        msgId,
        title: stats[msgId].title,
        likes: stats[msgId].likes || 0,
        dislikes: stats[msgId].dislikes || 0,
      });
    }
  }
  
  if (topVideos.length === 0) {
    await ctx.reply("No data for top videos yet.");
    return;
  }
  
  topVideos.sort((a, b) => b.likes - a.likes);
  
  let msg = `🏆 Top-10 videos by likes:\n\n`;
  topVideos.slice(0, 10).forEach((v, i) => {
    const ratio = v.likes + v.dislikes > 0 ? ((v.likes / (v.likes + v.dislikes)) * 100).toFixed(0) : 0;
    msg += `${i + 1}. ${v.title.substring(0, 35)}...\n`;
    msg += `   👍 ${v.likes} | 👎 ${v.dislikes} | ⭐ ${ratio}%\n\n`;
  });
  
  await ctx.reply(msg);
});

bot.command("submit", async (ctx) => {
  ctx.session.state = "submit";
  await ctx.reply("Send a Pornhub video link for channel publication:");
});

bot.command("subscribe", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  const subscribers = loadSubscribers();
  if (subscribers.includes(userId)) {
    await ctx.reply("You're already subscribed!");
    return;
  }
  
  subscribers.push(userId);
  saveSubscribers(subscribers);
  await ctx.reply("Thanks for subscribing! You'll receive announcements.");
});

bot.command("unsubscribe", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  const subscribers = loadSubscribers();
  const idx = subscribers.indexOf(userId);
  if (idx > -1) {
    subscribers.splice(idx, 1);
    saveSubscribers(subscribers);
  }
  await ctx.reply("You unsubscribed from announcements.");
});

bot.command("broadcast", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Admin only command.");
    return;
  }
  
  const text = ctx.message?.text?.split(" ").slice(1).join(" ");
  if (!text) {
    await ctx.reply("Usage: /broadcast Text message");
    return;
  }
  
  const subscribers = loadSubscribers();
  let sent = 0;
  
  for (const userId of subscribers) {
    try {
      await bot.api.sendMessage(userId, `📢 ${text}`);
      sent++;
    } catch (e) {}
  }
  
  await ctx.reply(`Broadcast sent to ${sent}/${subscribers.length} subscribers.`);
});

bot.hears("Submit video", async (ctx) => {
  ctx.session.state = "submit";
  await ctx.reply("Send a Pornhub video link for channel publication:");
});

bot.hears("Top videos", async (ctx) => {
  await ctx.triggerCommand("top");
});

bot.hears("Search videos", async (ctx) => {
  ctx.session.state = "search";
  await ctx.reply("Enter search query:");
});

bot.hears("Categories", async (ctx) => {
  ctx.session.state = null;
  try {
    const categories = await getCategories();
    await showCategoriesPage(ctx, categories, 0);
  } catch (error) {
    console.error("Categories error:", error);
    await ctx.reply("Error getting categories.");
  }
});

async function showCategoriesPage(ctx, categories, page) {
  const perPage = 20;
  const start = page * perPage;
  const end = start + perPage;
  const pageCategories = categories.slice(start, end);
  const totalPages = Math.ceil(categories.length / perPage);
  
  const keyboard = new InlineKeyboard();
  const columns = 2;
  
  for (let i = 0; i < pageCategories.length; i++) {
    keyboard.text(pageCategories[i].name, `cat_${pageCategories[i].slug}`);
    if ((i + 1) % columns === 0) {
      keyboard.row();
    }
  }
  
  keyboard.row();
  
  if (page > 0) {
    keyboard.text("◀️ Back", `catpage_${page - 1}`);
  }
  
  keyboard.text(`${page + 1}/${totalPages}`, "noop");
  
  if (end < categories.length) {
    keyboard.text("Next ▶️", `catpage_${page + 1}`);
  }
  
  const text = page === 0 && !ctx.callbackQuery
    ? "Select category:"
    : `Categories (page ${page + 1}/${totalPages})`;
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } else {
    await ctx.reply(text, { reply_markup: keyboard });
  }
}

bot.callbackQuery(/^catpage_/, async (ctx) => {
  const page = parseInt(ctx.callbackQuery.data.slice(8));
  const categories = await getCategories();
  await ctx.answerCallbackQuery();
  await showCategoriesPage(ctx, categories, page);
});

bot.callbackQuery("noop", async (ctx) => {
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^cat_/, async (ctx) => {
  const slug = ctx.callbackQuery.data.slice(4);
  
  try {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`Loading videos from "${slug}"...`);
    
    const result = await pornhub.videos.search({ 
      search: slug.replace(/-/g, " "),
      page: 1 
    });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Could not get videos from this category.");
    }
  } catch (error) {
    console.error("Category videos error:", error);
    await ctx.reply("Error getting videos.");
  }
});

bot.hears("Popular", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Loading popular videos...");
    const result = await pornhub.videos.mostViewed({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Could not get videos.");
    }
  } catch (error) {
    console.error("Popular error:", error);
    await ctx.reply("Error getting videos.");
  }
});

bot.hears("New", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Loading new videos...");
    const result = await pornhub.videos.newest({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Could not get videos.");
    }
  } catch (error) {
    console.error("Newest error:", error);
    await ctx.reply("Error getting videos.");
  }
});

bot.command("popular", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Loading popular videos...");
    const result = await pornhub.videos.mostViewed({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Could not get videos.");
    }
  } catch (error) {
    console.error("Popular error:", error);
    await ctx.reply("Error getting videos.");
  }
});

bot.command("newest", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Loading new videos...");
    const result = await pornhub.videos.newest({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Could not get videos.");
    }
  } catch (error) {
    console.error("Newest error:", error);
    await ctx.reply("Error getting videos.");
  }
});

bot.command("search", async (ctx) => {
  ctx.session.state = "search";
  await ctx.reply("Enter search query:");
});

bot.command("post", async (ctx) => {
  if (!CHANNEL_ID) {
    await ctx.reply("CHANNEL_ID not configured");
    return;
  }
  
  await ctx.reply("Posting video to channel...");
  await postVideoToChannel();
  await ctx.reply("Done!");
});

bot.on("message:text", async (ctx) => {
  if (ctx.message.text?.startsWith("/")) {
    return;
  }
  
  const state = ctx.session.state;
  
  if (state === "admin_broadcast") {
    ctx.session.state = null;
    const subscribers = loadSubscribers();
    let sent = 0;
    
    for (const userId of subscribers) {
      try {
        await bot.api.sendMessage(userId, `📢 ${ctx.message.text}`);
        sent++;
      } catch (e) {}
    }
    
    await ctx.reply(`Broadcast sent to ${sent}/${subscribers.length} subscribers.`);
    await showAdminPanel(ctx);
    return;
  }
  
  if (state === "submit") {
    const url = ctx.message.text;
    ctx.session.state = null;
    
    if (!url.includes("pornhub.com")) {
      await ctx.reply("Please send a link from pornhub.com");
      return;
    }
    
    const postedVideos = loadPostedVideos();
    const submissions = loadSubmissions();
    const videoId = url.match(/viewkey=([a-z0-9]+)/i)?.[1];
    
    if (videoId && (postedVideos.includes(videoId) || submissions.some(s => s.url.includes(videoId)))) {
      await ctx.reply("This video has already been submitted or published.");
      return;
    }
    
    try {
      const video = await pornhub.videos.details({ url });
      submissions.push({
        url,
        videoId,
        title: video.title,
        username: ctx.from?.username || ctx.from?.first_name,
        userId: ctx.from?.id,
        date: Date.now()
      });
      saveSubmissions(submissions);
      await ctx.reply("Video submitted for review!");
    } catch (e) {
      await ctx.reply("Error: could not get video info.");
    }
    return;
  }
  
  if (state === "search") {
    const query = ctx.message.text;
    ctx.session.state = null;
    
    try {
      await ctx.reply(`Searching for "${query}"...`);
      const result = await pornhub.videos.search({ search: query, page: 1 });
      
      if (result.videos && result.videos.length > 0) {
        for (const video of result.videos.slice(0, 5)) {
          await sendVideoInfo(ctx, video);
        }
      } else {
        await ctx.reply("Nothing found.");
      }
    } catch (error) {
      console.error("Search error:", error);
      await ctx.reply("Search error.");
    }
    return;
  }
  
  await ctx.reply("Use menu buttons or commands /search, /popular, /newest");
});

async function sendVideoInfo(ctx, video) {
  const title = video.title || "Untitled";
  const duration = video.duration || "Unknown";
  const views = video.watchCount ? formatNumber(video.watchCount) : "Unknown";
  const url = video.url;
  const videoId = video.videoId;
  
  const text = 
    `<b>${escapeHtml(title)}</b>\n\n` +
    `⏱ Duration: ${duration}\n` +
    `👁 Views: ${views}` +
    (url ? `\n\n🔗 <a href="${url}">Watch on Pornhub</a>` : "");
  
  const keyboard = new InlineKeyboard()
    .url("🎬 Watch", url || `https://www.pornhub.com/view_video.php?viewkey=${videoId}`)
    .row()
    .text("📥 Download", `download_${videoId}`);
  
  const thumbnail = video.thumbnailUrl;
  
  if (thumbnail) {
    try {
      await ctx.replyWithPhoto(thumbnail, {
        caption: text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    } catch (e) {
      console.error("Photo error:", e);
    }
  }
  
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
}

bot.callbackQuery(/^download_/, async (ctx) => {
  const videoId = ctx.callbackQuery.data.slice(9);
  
  try {
    await ctx.answerCallbackQuery({ text: "Downloading...", show_alert: false });
    await ctx.reply("⏳ Downloading video, please wait...");
    
    const video = await pornhub.videos.details({ 
      url: `https://www.pornhub.com/view_video.php?viewkey=${videoId}` 
    });
    
    const files = video.files || {};
    let hlsUrl = files.HLS;
    if (hlsUrl && hlsUrl.startsWith("//")) {
      hlsUrl = "https:" + hlsUrl;
    }
    
    let videoUrl = files.low || files.high;
    if (videoUrl && videoUrl.startsWith("//")) {
      videoUrl = "https:" + videoUrl;
    }
    
    if (!videoUrl && !hlsUrl) {
      await ctx.reply(
        "Could not get video.\n\n" +
        "Try downloading via online service:\n" +
        `https://www.p2mp4.com/video/${videoId}`
      );
      return;
    }
    
    const title = video.title || `video_${videoId}`;
    const safeTitle = title.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, "").substring(0, 50);
    const inputFile = join(TMP_DIR, `${videoId}.mp4`);
    
    console.log(`Downloading video: ${videoId}`);
    
    let downloadSuccess = false;
    
    if (hlsUrl) {
      console.log("Trying HLS download...");
      try {
        await downloadHLS(hlsUrl, inputFile);
        if (existsSync(inputFile)) {
          const stats = statSync(inputFile);
          if (stats.size > 10000) {
            downloadSuccess = true;
            console.log(`HLS download success: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          }
        }
      } catch (e) {
        console.log("HLS download failed:", e.message);
      }
    }
    
    if (!downloadSuccess && videoUrl) {
      console.log("Trying direct download...");
      
      try {
        const response = await axios({
          method: "get",
          url: videoUrl,
          responseType: "stream",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.pornhub.com/"
          }
        });
        
        const writer = createWriteStream(inputFile);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
        
        downloadSuccess = true;
      } catch (e) {
        console.log("Direct download failed:", e.message);
      }
    }
    
    if (!downloadSuccess) {
      await ctx.reply(
        "❌ Could not download video.\n\n" +
        "Try via online service:\n" +
        `https://www.p2mp4.com/video/${videoId}`
      );
      return;
    }
    
    const stats = statSync(inputFile);
    const sizeMB = stats.size / (1024 * 1024);
    
    console.log(`Downloaded: ${sizeMB.toFixed(2)} MB`);
    
    if (sizeMB > 50 && !BOT_API_URL) {
      await ctx.reply(`⚠️ Video too large (${sizeMB.toFixed(1)} MB) for sending in DM.`);
      cleanup([inputFile]);
      return;
    }
    
    await ctx.replyWithVideo(new InputFile(inputFile), {
      caption: `🎬 ${safeTitle}\n\n📦 Size: ${sizeMB.toFixed(1)} MB`,
      supports_streaming: true
    });
    
    cleanup([inputFile]);
    
  } catch (error) {
    console.error("Download error:", error);
    await ctx.reply(
      `❌ Download error: ${error.message}\n\n` +
      "Try via online service:\n" +
      `https://www.p2mp4.com/video/${videoId}`
    );
  }
});

bot.callbackQuery(/^like_/, async (ctx) => {
  const msgId = ctx.callbackQuery.data.slice(5);
  const stats = loadPostStats();
  
  if (!stats[msgId]) {
    stats[msgId] = { likes: 0, dislikes: 0 };
  }
  
  stats[msgId].likes++;
  savePostStats(stats);
  
  const keyboard = new InlineKeyboard()
    .text(`👍 ${stats[msgId].likes}`, `like_${msgId}`)
    .text(`👎 ${stats[msgId].dislikes}`, `dislike_${msgId}`);
  
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
  } catch (e) {}
  
  await ctx.answerCallbackQuery({ text: "👍 Thanks!", show_alert: false });
});

bot.callbackQuery(/^dislike_/, async (ctx) => {
  const msgId = ctx.callbackQuery.data.slice(8);
  const stats = loadPostStats();
  
  if (!stats[msgId]) {
    stats[msgId] = { likes: 0, dislikes: 0 };
  }
  
  stats[msgId].dislikes++;
  savePostStats(stats);
  
  const keyboard = new InlineKeyboard()
    .text(`👍 ${stats[msgId].likes}`, `like_${msgId}`)
    .text(`👎 ${stats[msgId].dislikes}`, `dislike_${msgId}`);
  
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
  } catch (e) {}
  
  await ctx.answerCallbackQuery({ text: "👎 Thanks for feedback!", show_alert: false });
});

function downloadHLS(hlsUrl, output) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "-headers", "Referer: https://www.pornhub.com/\r\n",
      "-i", hlsUrl,
      "-y",
      "-c", "copy",
      "-bsf:a", "aac_adtstoasc",
      "-movflags", "+faststart",
      output
    ]);
    
    ffmpeg.stderr.on("data", (data) => {
      const str = data.toString();
      if (str.includes("frame=") || str.includes("Duration:")) {
        console.log("ffmpeg:", str.substring(0, 100));
      }
    });
    
    ffmpeg.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`FFmpeg HLS download exited with code ${code}`));
      }
    });
    
    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
}

function addWatermark(input, output) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", input,
      "-vf", `drawtext=text='${WATERMARK_TEXT}':fontcolor=white@0.5:fontsize=18:x=w-tw-10:y=h-th-10`,
      "-c:a", "copy",
      "-y",
      output
    ]);
    
    const timeout = setTimeout(() => {
      ffmpeg.kill();
      reject(new Error("Watermark timeout"));
    }, 300000);
    
    ffmpeg.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Watermark failed with code ${code}`));
      }
    });
    
    ffmpeg.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function cleanup(files) {
  for (const file of files) {
    try {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
}

function cleanupAllTempFiles() {
  try {
    const files = readdirSync(TMP_DIR);
    for (const file of files) {
      try {
        unlinkSync(join(TMP_DIR, file));
        console.log(`Cleaned up: ${file}`);
      } catch (e) {}
    }
  } catch (e) {
    console.log("No temp files to clean");
  }
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generateEnglishCaption(title, duration, views, sizeMB, categories) {
  const escTitle = escapeHtml(title);
  const hashtags = categories?.slice(0, 5).map(c => `#${c.replace(/[^a-zA-Z0-9]/g, "")}`).join(" ") || "";
  return `🔥 <b>${escTitle}</b>\n\n⏱ ${duration} | 👁 ${views} | 📦 ${sizeMB.toFixed(1)} MB\n\n${hashtags}`;
}

async function getUnpostedVideo(maxAttempts = 20) {
  const postedVideos = loadPostedVideos();
  
  const submissions = loadSubmissions();
  if (submissions.length > 0 && Math.random() > 0.7) {
    const pending = submissions.filter(s => !postedVideos.includes(s.videoId));
    if (pending.length > 0) {
      const random = pending[Math.floor(Math.random() * pending.length)];
      try {
        const details = await pornhub.videos.details({ url: random.url });
        return { video: { ...details, url: random.url }, source: "user" };
      } catch (e) {}
    }
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sources = ["popular", "newest"];
    const source = sources[attempt % 2];
    
    try {
      let videos = [];
      if (source === "popular") {
        const result = await pornhub.videos.mostViewed({ page: Math.floor(Math.random() * 3) + 1 });
        videos = result.videos || [];
      } else {
        const result = await pornhub.videos.newest({ page: Math.floor(Math.random() * 3) + 1 });
        videos = result.videos || [];
      }
      
      for (const video of videos) {
        if (postedVideos.includes(video.videoId)) continue;
        console.log(`Found video: ${video.title} (${video.duration})`);
        return { video, source };
      }
    } catch (e) {
      console.error(`Error getting videos from ${source}:`, e.message);
    }
  }
  
  return null;
}

async function sendVideoViaFormData(chatId, filePath, caption, messageId) {
  const apiUrl = BOT_API_URL || "https://api.telegram.org";
  const url = `${apiUrl}/bot${BOT_TOKEN}/sendVideo`;
  
  const keyboard = new InlineKeyboard()
    .text(`👍 0`, `like_${messageId}`)
    .text(`👎 0`, `dislike_${messageId}`);
  
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("video", createReadStream(filePath));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("supports_streaming", "true");
  form.append("reply_markup", JSON.stringify(keyboard));
  
  const response = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  
  return response.data;
}

let isPostingLocked = false;

async function postVideoToChannel() {
  if (isPostingLocked) {
    console.log("Auto-post already in progress, skipping...");
    return;
  }
  
  const settings = loadSettings();
  if (!settings.autoPostEnabled) {
    console.log("Auto-post disabled in settings");
    return;
  }
  
  isPostingLocked = true;
  
  try {
    if (!CHANNEL_ID) {
      console.log("CHANNEL_ID not set, skipping auto-post");
      return;
    }
    
    console.log("Starting auto-post to channel...");
    
    const result = await getUnpostedVideo(30);
    if (!result) {
      console.log("No video found, skipping...");
      return;
    }
    
    const video = result.video;
    const source = result.source;
    const postedVideos = loadPostedVideos();
    
    const details = await pornhub.videos.details({ url: video.url });
    
    if (!filterVideoByCategories(details)) {
      console.log("Video filtered by category, skipping...");
      return;
    }
    
    const title = details.title || "Untitled";
    const duration = details.duration || "Unknown";
    const views = details.watchCount ? formatNumber(details.watchCount) : "Unknown";
    const url = details.url;
    const videoId = details.videoId;
    const categories = details.categories || [];
    
    const files = details.files || {};
    console.log("Available files:", JSON.stringify(files).substring(0, 500));
    
    let hlsUrl = files.HLS;
    if (hlsUrl && hlsUrl.startsWith("//")) {
      hlsUrl = "https:" + hlsUrl;
    }
    
    let videoUrl = files.low || files.high;
    if (videoUrl && videoUrl.startsWith("//")) {
      videoUrl = "https:" + videoUrl;
    }
    
    console.log(`Video URL: ${videoUrl?.substring(0, 100)}`);
    console.log(`HLS URL: ${hlsUrl?.substring(0, 100)}`);
    
    const inputFile = join(TMP_DIR, `${videoId}_channel.mp4`);
    const watermarkedFile = join(TMP_DIR, `${videoId}_watermarked.mp4`);
    
    let downloadSuccess = false;
    
    if (hlsUrl) {
      console.log("Trying to download via HLS with ffmpeg...");
      try {
        await downloadHLS(hlsUrl, inputFile);
        if (existsSync(inputFile)) {
          const stats = statSync(inputFile);
          if (stats.size > 10000) {
            downloadSuccess = true;
            console.log(`HLS download success: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          }
        }
      } catch (e) {
        console.log("HLS download failed:", e.message);
      }
    }
    
    if (!downloadSuccess && videoUrl) {
      console.log(`Downloading video for channel: ${title}`);
      
      try {
        const response = await axios({
          method: "get",
          url: videoUrl,
          responseType: "arraybuffer",
          timeout: 120000,
          maxRedirects: 10,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://www.pornhub.com/",
          }
        });
        
        console.log(`Response status: ${response.status}`);
        
        const buffer = Buffer.from(response.data);
        console.log(`Buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        if (buffer.length > 10000) {
          require("fs").writeFileSync(inputFile, buffer);
          downloadSuccess = true;
        }
        
      } catch (e) {
        console.log("Direct download failed:", e.message);
      }
    }
    
    if (!downloadSuccess) {
      console.log("All download methods failed");
      return;
    }
    
    let finalFile = inputFile;
    
    if (settings.watermarkEnabled) {
      try {
        console.log("Adding watermark...");
        await addWatermark(inputFile, watermarkedFile);
        if (existsSync(watermarkedFile)) {
          unlinkSync(inputFile);
          finalFile = watermarkedFile;
          console.log("Watermark added successfully");
        }
      } catch (e) {
        console.log("Watermark failed, using original:", e.message);
      }
    }
    
    const stats = statSync(finalFile);
    const sizeMB = stats.size / (1024 * 1024);
    
    console.log(`Final size: ${sizeMB.toFixed(2)} MB`);
    
    if (sizeMB < 0.1) {
      console.log("File too small");
      cleanup([finalFile]);
      return;
    }
    
    const messageId = Date.now().toString();
    console.log(`Sending video to channel: ${sizeMB.toFixed(1)} MB`);
    
    const caption = generateEnglishCaption(title, duration, views, sizeMB, categories);
    
    try {
      const sendResult = await sendVideoViaFormData(CHANNEL_ID, finalFile, caption, messageId);
      console.log("Video sent successfully:", sendResult.ok);
      
      const actualMsgId = sendResult.result?.message_id?.toString() || messageId;
      const postStats = loadPostStats();
      postStats[actualMsgId] = { likes: 0, dislikes: 0, videoId, title, source };
      savePostStats(postStats);
      
      cleanup([finalFile]);
      
      postedVideos.push(details.videoId);
      savePostedVideos(postedVideos);
      
      console.log(`Posted video to channel: ${title} (${sizeMB.toFixed(1)} MB, source: ${source})`);
    } catch (sendErr) {
      console.error("Send error:", sendErr.response?.data || sendErr.message);
      cleanup([finalFile]);
    }
    
  } catch (e) {
    console.error("Error posting video:", e);
  } finally {
    isPostingLocked = false;
  }
}

bot.start();
console.log("Bot started!");
console.log("Features enabled:");
console.log("- Local Bot API:", BOT_API_URL ? "YES (files up to 2GB)" : "NO");
console.log("- Admin Panel: /admin");
console.log("- Watermark:", WATERMARK_TEXT);
console.log("- User submissions: enabled");
console.log("- Newsletter: enabled");
console.log("- Analytics: enabled");
cleanupAllTempFiles();

if (CHANNEL_ID) {
  console.log(`Auto-posting enabled to channel: ${CHANNEL_ID}`);
  console.log("Interval:", loadSettings().interval, "minutes");
  
  setTimeout(() => {
    postVideoToChannel();
  }, 10000);
  
  setInterval(() => {
    postVideoToChannel();
  }, loadSettings().interval * 60 * 1000);
  
  setInterval(() => {
    const posted = loadPostedVideos();
    console.log(`Posted videos count: ${posted.length}`);
  }, 10 * 60 * 1000);
}
