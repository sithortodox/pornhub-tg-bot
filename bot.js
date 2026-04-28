import { Bot, session, InlineKeyboard, InputFile } from "grammy";
import pornhub from "pornhub";
import { load } from "cheerio";
import axios from "axios";
import { spawn } from "child_process";
import { createWriteStream, existsSync, statSync, unlinkSync, mkdirSync, createReadStream, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";

const TMP_DIR = join(tmpdir(), "pornhub-bot");
if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}

const DATA_DIR = "/app/data";
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const POSTED_VIDEOS_FILE = join(DATA_DIR, "posted_videos.json");
const CHANNEL_ID = process.env.CHANNEL_ID;

function loadPostedVideos() {
  if (existsSync(POSTED_VIDEOS_FILE)) {
    try {
      const data = readFileSync(POSTED_VIDEOS_FILE, "utf8");
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return [];
}

function savePostedVideos(videos) {
  writeFileSync(POSTED_VIDEOS_FILE, JSON.stringify(videos.slice(-1000)));
}

const TOKEN = process.env.BOT_TOKEN;
const bot = new Bot(TOKEN);

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
    initial: () => ({ state: null }),
  })
);

const mainKeyboard = {
  keyboard: [
    [{ text: "Поиск видео" }, { text: "Популярные" }],
    [{ text: "Категории" }, { text: "Новые" }],
    [{ text: "По ссылке" }],
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
    { name: "Gay", slug: "gay" },
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
    { name: "Transgender", slug: "transgender" },
    { name: "Vintage", slug: "vintage" },
    { name: "Webcam", slug: "webcam" },
  ];
}

bot.command("start", async (ctx) => {
  ctx.session.state = null;
  await ctx.reply(
    "Привет! Я бот для поиска контента с Pornhub.\n\n" +
      "Доступные команды:\n" +
      "/start - Главное меню\n" +
      "/search - Поиск видео\n" +
      "/popular - Популярные видео\n" +
      "/newest - Новые видео\n" +
      "/help - Помощь",
    { reply_markup: mainKeyboard }
  );
});

bot.command("help", async (ctx) => {
  ctx.session.state = null;
  await ctx.reply(
    "Как пользоваться ботом:\n\n" +
      "1. Поиск видео - введите запрос для поиска\n" +
      "2. Популярные - просмотр популярных видео\n" +
      "3. Новые - просмотр новых видео\n" +
      "4. По ссылке - получить информацию о видео по ссылке"
  );
});

bot.hears("Поиск видео", async (ctx) => {
  ctx.session.state = "search";
  await ctx.reply("Введите поисковый запрос:");
});

bot.hears("Категории", async (ctx) => {
  ctx.session.state = null;
  try {
    const categories = await getCategories();
    await showCategoriesPage(ctx, categories, 0);
  } catch (error) {
    console.error("Categories error:", error);
    await ctx.reply("Ошибка при получении категорий.");
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
    keyboard.text("◀️ Назад", `catpage_${page - 1}`);
  }
  
  keyboard.text(`${page + 1}/${totalPages}`, "noop");
  
  if (end < categories.length) {
    keyboard.text("Вперёд ▶️", `catpage_${page + 1}`);
  }
  
  const text = page === 0 && !ctx.callbackQuery
    ? "Выберите категорию:"
    : `Категории (страница ${page + 1}/${totalPages})`;
  
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
    await ctx.editMessageText(`Загружаю видео из категории "${slug}"...`);
    
    const result = await pornhub.videos.search({ 
      search: slug.replace(/-/g, " "),
      page: 1 
    });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Не удалось получить видео в этой категории.");
    }
  } catch (error) {
    console.error("Category videos error:", error);
    await ctx.reply("Ошибка при получении видео.");
  }
});

bot.hears("Популярные", async (ctx) => {
  ctx.session.state = null;
  console.log("Popular button pressed");
  try {
    await ctx.reply("Загружаю популярные видео...");
    const result = await pornhub.videos.mostViewed({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Не удалось получить видео.");
    }
  } catch (error) {
    console.error("Popular error:", error);
    await ctx.reply("Ошибка при получении видео.");
  }
});

bot.hears("Новые", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Загружаю новые видео...");
    const result = await pornhub.videos.newest({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Не удалось получить видео.");
    }
  } catch (error) {
    console.error("Newest error:", error);
    await ctx.reply("Ошибка при получении видео.");
  }
});

bot.hears("По ссылке", async (ctx) => {
  ctx.session.state = "url";
  await ctx.reply("Отправьте ссылку на видео с Pornhub:");
});

bot.command("popular", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Загружаю популярные видео...");
    const result = await pornhub.videos.mostViewed({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Не удалось получить видео.");
    }
  } catch (error) {
    console.error("Popular error:", error);
    await ctx.reply("Ошибка при получении видео.");
  }
});

bot.command("newest", async (ctx) => {
  ctx.session.state = null;
  try {
    await ctx.reply("Загружаю новые видео...");
    const result = await pornhub.videos.newest({ page: 1 });
    
    if (result.videos && result.videos.length > 0) {
      for (const video of result.videos.slice(0, 5)) {
        await sendVideoInfo(ctx, video);
      }
    } else {
      await ctx.reply("Не удалось получить видео.");
    }
  } catch (error) {
    console.error("Newest error:", error);
    await ctx.reply("Ошибка при получении видео.");
  }
});

bot.command("search", async (ctx) => {
  ctx.session.state = "search";
  await ctx.reply("Введите поисковый запрос:");
});

bot.on("message:text", async (ctx) => {
  const state = ctx.session.state;
  
  if (state === "search") {
    const query = ctx.message.text;
    ctx.session.state = null;
    
    try {
      await ctx.reply(`Ищу видео по запросу "${query}"...`);
      const result = await pornhub.videos.search({ search: query, page: 1 });
      
      if (result.videos && result.videos.length > 0) {
        for (const video of result.videos.slice(0, 5)) {
          await sendVideoInfo(ctx, video);
        }
      } else {
        await ctx.reply("Ничего не найдено.");
      }
    } catch (error) {
      console.error("Search error:", error);
      await ctx.reply("Ошибка при поиске.");
    }
    return;
  }
  
  if (state === "url") {
    const url = ctx.message.text;
    ctx.session.state = null;
    
    if (!url.includes("pornhub.com")) {
      await ctx.reply("Пожалуйста, отправьте ссылку с pornhub.com");
      return;
    }
    
    try {
      await ctx.reply("Получаю информацию о видео...");
      const video = await pornhub.videos.details({ url });
      
      if (video) {
        await sendVideoDetails(ctx, video);
      } else {
        await ctx.reply("Не удалось получить информацию о видео.");
      }
    } catch (error) {
      console.error("Video details error:", error);
      await ctx.reply("Ошибка при получении информации о видео.");
    }
    return;
  }
  
  await ctx.reply("Используйте кнопки меню или команды /search, /popular, /newest");
});

async function sendVideoInfo(ctx, video) {
  const title = video.title || "Без названия";
  const duration = video.duration || "Неизвестно";
  const views = video.watchCount ? formatNumber(video.watchCount) : "Неизвестно";
  const url = video.url;
  const videoId = video.videoId;
  
  const text = 
    `<b>${escapeHtml(title)}</b>\n\n` +
    `⏱ Длительность: ${duration}\n` +
    `👁 Просмотров: ${views}` +
    (url ? `\n\n🔗 <a href="${url}">Смотреть на Pornhub</a>` : "");
  
  const keyboard = new InlineKeyboard()
    .url("🎬 Смотреть", url || `https://www.pornhub.com/view_video.php?viewkey=${videoId}`)
    .row()
    .text("📥 Скачать", `download_${videoId}`);
  
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
    await ctx.answerCallbackQuery({ text: "Скачиваю видео...", show_alert: false });
    await ctx.reply("⏳ Скачиваю видео, подождите...");
    
    const video = await pornhub.videos.details({ 
      url: `https://www.pornhub.com/view_video.php?viewkey=${videoId}` 
    });
    
    const files = video.files || {};
    const videoUrl = files.low || files.high || files.HLS;
    
    if (!videoUrl) {
      await ctx.reply(
        "Не удалось получить видео.\n\n" +
        "Попробуйте скачать через онлайн-сервис:\n" +
        `https://www.p2mp4.com/video/${videoId}`
      );
      return;
    }
    
    const title = video.title || `video_${videoId}`;
    const safeTitle = title.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, "").substring(0, 50);
    const inputFile = join(TMP_DIR, `${videoId}.mp4`);
    const compressedFile = join(TMP_DIR, `${videoId}_compressed.mp4`);
    
    console.log(`Downloading video: ${videoId}`);
    
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
    
    const stats = statSync(inputFile);
    const sizeMB = stats.size / (1024 * 1024);
    
    console.log(`Downloaded: ${sizeMB.toFixed(2)} MB`);
    
    let fileToSend = inputFile;
    
    if (sizeMB > 48) {
      await ctx.reply(`📦 Видео ${sizeMB.toFixed(1)} MB, сжимаю до 50MB...`);
      
      await compressVideo(inputFile, compressedFile);
      
      if (existsSync(compressedFile)) {
        const compressedStats = statSync(compressedFile);
        const compressedSizeMB = compressedStats.size / (1024 * 1024);
        
        console.log(`Compressed: ${compressedSizeMB.toFixed(2)} MB`);
        
        if (compressedSizeMB < 48) {
          fileToSend = compressedFile;
        } else {
          await ctx.reply(
            `⚠️ Видео слишком большое (${sizeMB.toFixed(1)} MB).\n\n` +
            `Telegram ограничивает размер файлов до 50MB.\n\n` +
            `Скачайте напрямую:\n${videoUrl}`
          );
          cleanup([inputFile, compressedFile]);
          return;
        }
      }
    }
    
    const finalStats = statSync(fileToSend);
    const finalSizeMB = finalStats.size / (1024 * 1024);
    
    await ctx.replyWithVideo(new InputFile(fileToSend), {
      caption: `🎬 ${safeTitle}\n\n📦 Размер: ${finalSizeMB.toFixed(1)} MB`,
      supports_streaming: true
    });
    
    cleanup([inputFile, compressedFile]);
    
  } catch (error) {
    console.error("Download error:", error);
    await ctx.reply(
      `❌ Ошибка при скачивании: ${error.message}\n\n` +
      "Попробуйте скачать через онлайн-сервис:\n" +
      `https://www.p2mp4.com/video/${videoId}`
    );
  }
});

function compressVideo(input, output) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", input,
      "-y",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "28",
      "-c:a", "aac",
      "-b:a", "96k",
      "-fs", "48M",
      "-movflags", "+faststart",
      output
    ]);
    
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on("error", reject);
  });
}

function downloadHLS(hlsUrl, output) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", hlsUrl,
      "-y",
      "-c", "copy",
      "-bsf:a", "aac_adtstoasc",
      "-movflags", "+faststart",
      output
    ]);
    
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg HLS download exited with code ${code}`));
      }
    });
    
    ffmpeg.on("error", reject);
    
    setTimeout(() => {
      ffmpeg.kill();
      reject(new Error("HLS download timeout"));
    }, 180000);
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

async function sendVideoDetails(ctx, video) {
  const title = video.title || "Без названия";
  const duration = video.duration || "Неизвестно";
  const views = video.watchCount ? formatNumber(video.watchCount) : "Неизвестно";
  const rating = video.ratingPercent ? `${video.ratingPercent}%` : "Неизвестно";
  const votes = video.voteCount ? formatNumber(video.voteCount) : "Неизвестно";
  const url = video.url;
  const tags = video.tags?.slice(0, 5).join(", ") || "Нет";
  const categories = video.categories?.slice(0, 3).join(", ") || "Нет";
  const files = video.files || {};
  
  const downloadLinks = [];
  if (files.high) downloadLinks.push(`📥 Высокое качество`);
  if (files.low) downloadLinks.push(`📥 Среднее качество`);
  if (files.HLS) downloadLinks.push(`📥 HLS`);
  
  const text = 
    `<b>${escapeHtml(title)}</b>\n\n` +
    `⏱ Длительность: ${duration}\n` +
    `👁 Просмотров: ${views}\n` +
    `⭐ Рейтинг: ${rating} (${votes} голосов)\n` +
    `📂 Категории: ${categories}\n` +
    `🏷 Теги: ${tags}`;
  
  const keyboard = new InlineKeyboard()
    .url("🎬 Смотреть", url)
    .row()
    .text("📥 Скачать", `download_${video.videoId}`);
  
  const thumbnail = video.thumbnailUrls?.[0] || files.thumb;
  
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

async function getRandomVideoFromCategory(category) {
  try {
    const result = await pornhub.videos.search({ 
      search: category.replace(/-/g, " "),
      page: Math.floor(Math.random() * 5) + 1
    });
    
    const postedVideos = loadPostedVideos();
    const filtered = result.videos.filter(v => 
      !postedVideos.includes(v.videoId)
    );
    
    if (filtered.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(10, filtered.length));
      return filtered[randomIndex];
    }
    return result.videos[Math.floor(Math.random() * result.videos.length)];
  } catch (e) {
    console.error(`Error getting video from category ${category}:`, e);
    return null;
  }
}

async function getUnpostedVideo(source = "popular") {
  const postedVideos = loadPostedVideos();
  
  let videos = [];
  try {
    if (source === "popular") {
      const result = await pornhub.videos.mostViewed({ page: Math.floor(Math.random() * 3) + 1 });
      videos = result.videos || [];
    } else {
      const result = await pornhub.videos.newest({ page: Math.floor(Math.random() * 3) + 1 });
      videos = result.videos || [];
    }
  } catch (e) {
    console.error(`Error getting ${source} videos:`, e);
  }
  
  const unposted = videos.filter(v => !postedVideos.includes(v.videoId));
  return unposted.length > 0 ? unposted[0] : null;
}

async function postVideoToChannel() {
  if (!CHANNEL_ID) {
    console.log("CHANNEL_ID not set, skipping auto-post");
    return;
  }
  
  console.log("Starting auto-post to channel...");
  
  let video = null;
  let source = "";
  
  const postedVideos = loadPostedVideos();
  const candidates = [];
  
  for (const src of ["popular", "newest", "popular", "newest"]) {
    const v = await getUnpostedVideo(src);
    if (v) {
      candidates.push({ video: v, source: src });
    }
  }
  
  if (candidates.length > 0) {
    const randomIdx = Math.floor(Math.random() * candidates.length);
    video = candidates[randomIdx].video;
    source = candidates[randomIdx].source;
  }
  
  if (!video) {
    console.log("No unposted videos from popular/new, trying random category...");
    
    const categories = getDefaultCategories().filter(c => 
      !EXCLUDED_CATEGORIES.some(ex => c.slug.includes(ex) || c.name.toLowerCase().includes(ex))
    );
    
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    video = await getRandomVideoFromCategory(randomCategory.slug);
    source = `category: ${randomCategory.name}`;
  }
  
  if (!video) {
    console.log("No video found for posting");
    return;
  }
  
  try {
    const details = await pornhub.videos.details({ url: video.url });
    
    if (!filterVideoByCategories(details)) {
      console.log("Video filtered by category, skipping...");
      return;
    }
    
    const title = details.title || "Без названия";
    const duration = details.duration || "Неизвестно";
    const views = details.watchCount ? formatNumber(details.watchCount) : "Неизвестно";
    const url = details.url;
    const videoId = details.videoId;
    
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
    const compressedFile = join(TMP_DIR, `${videoId}_channel_compressed.mp4`);
    
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
        
        console.log(`Response status: ${response.status}, Content-Length: ${response.headers['content-length']}, Content-Type: ${response.headers['content-type']}`);
        
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
      console.log("All download methods failed, posting as link...");
      await postAsLink(CHANNEL_ID, details, postedVideos, source);
      return;
    }
    
    const stats = statSync(inputFile);
    const sizeMB = stats.size / (1024 * 1024);
    
    console.log(`Downloaded: ${sizeMB.toFixed(2)} MB`);
    
    if (sizeMB < 0.1) {
      console.log("File too small, posting as link...");
      cleanup([inputFile]);
      await postAsLink(CHANNEL_ID, details, postedVideos, source);
      return;
    }
    
    let fileToSend = inputFile;
    
    if (sizeMB > 48) {
        console.log(`Compressing video from ${sizeMB.toFixed(1)} MB...`);
        
        try {
          await compressVideo(inputFile, compressedFile);
          
          if (existsSync(compressedFile)) {
            const compressedStats = statSync(compressedFile);
            const compressedSizeMB = compressedStats.size / (1024 * 1024);
            
            console.log(`Compressed: ${compressedSizeMB.toFixed(2)} MB`);
            
            if (compressedSizeMB < 48) {
              fileToSend = compressedFile;
            } else {
              console.log("Video too large even after compression, posting as link...");
              cleanup([inputFile, compressedFile]);
              await postAsLink(CHANNEL_ID, details, postedVideos, source);
              return;
            }
          }
        } catch (compressError) {
          console.error("Compression failed:", compressError);
          cleanup([inputFile, compressedFile]);
          await postAsLink(CHANNEL_ID, details, postedVideos, source);
          return;
        }
      }
      
      const finalStats = statSync(fileToSend);
      const finalSizeMB = finalStats.size / (1024 * 1024);
      
      const caption = `🔥 <b>${escapeHtml(title)}</b>\n\n⏱ ${duration} | 👁 ${views} | 📦 ${finalSizeMB.toFixed(1)} MB`;
      
      await bot.api.sendVideo(CHANNEL_ID, new InputFile(fileToSend), {
        caption: caption,
        parse_mode: "HTML",
        supports_streaming: true
      });
      
      cleanup([inputFile, compressedFile]);
      
      postedVideos.push(details.videoId);
      savePostedVideos(postedVideos);
      
      console.log(`Posted video to channel: ${title} (${finalSizeMB.toFixed(1)} MB, source: ${source})`);
      
    } catch (downloadError) {
      console.error("Download error:", downloadError);
      cleanup([inputFile, compressedFile]);
      await postAsLink(CHANNEL_ID, details, postedVideos, source);
    }
    
  } catch (e) {
    console.error("Error posting video:", e);
  }
}

async function postAsLink(channelId, details, postedVideos, source) {
  const title = details.title || "Без названия";
  const duration = details.duration || "Неизвестно";
  const views = details.watchCount ? formatNumber(details.watchCount) : "Неизвестно";
  const url = details.url;
  
  const text = 
    `🔥 <b>${escapeHtml(title)}</b>\n\n` +
    `⏱ ${duration} | 👁 ${views}\n\n` +
    `🔗 <a href="${url}">Смотреть на Pornhub</a>`;
  
  const keyboard = new InlineKeyboard()
    .url("🎬 Смотреть", url)
    .row()
    .text("📥 Скачать", `download_${details.videoId}`);
  
  const thumbnail = details.thumbnailUrls?.[0] || details.files?.thumb;
  
  try {
    if (thumbnail) {
      await bot.api.sendPhoto(channelId, thumbnail, {
        caption: text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } else {
      await bot.api.sendMessage(channelId, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
    
    postedVideos.push(details.videoId);
    savePostedVideos(postedVideos);
    console.log(`Posted as link: ${title} (source: ${source})`);
  } catch (e) {
    console.error("Error posting link:", e);
  }
}

bot.command("post", async (ctx) => {
  if (!CHANNEL_ID) {
    await ctx.reply("CHANNEL_ID не настроен");
    return;
  }
  
  await ctx.reply("Публикую видео в канал...");
  await postVideoToChannel();
  await ctx.reply("Готово!");
});

bot.command("setchannel", async (ctx) => {
  const chatId = ctx.message?.text?.split(" ")[1];
  if (!chatId) {
    await ctx.reply("Использование: /setchannel @channelname или /setchannel -1001234567890");
    return;
  }
  
  await ctx.reply(`Канал установлен: ${chatId}\nДобавьте этот ID в .env как CHANNEL_ID`);
});

bot.start();
console.log("Bot started!");

if (CHANNEL_ID) {
  console.log(`Auto-posting enabled to channel: ${CHANNEL_ID}`);
  
  setTimeout(() => {
    postVideoToChannel();
  }, 5000);
  
  setInterval(() => {
    postVideoToChannel();
  }, 60 * 60 * 1000);
  
  setInterval(() => {
    const posted = loadPostedVideos();
    console.log(`Posted videos count: ${posted.length}`);
  }, 10 * 60 * 1000);
}
