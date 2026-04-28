import { Bot, session, InlineKeyboard } from "grammy";
import pornhub from "pornhub";
import { load } from "cheerio";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const bot = new Bot(TOKEN);

const CATEGORIES_CACHE = { data: null, timestamp: 0 };

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
    await ctx.reply("Загружаю категории...");
    const categories = await getCategories();
    
    const keyboard = new InlineKeyboard();
    const columns = 3;
    
    for (let i = 0; i < Math.min(categories.length, 30); i++) {
      keyboard.text(categories[i].name, `cat_${categories[i].slug}`);
      if ((i + 1) % columns === 0) {
        keyboard.row();
      }
    }
    
    await ctx.reply("Выберите категорию:", { reply_markup: keyboard });
  } catch (error) {
    console.error("Categories error:", error);
    await ctx.reply("Ошибка при получении категорий.");
  }
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
  
  const text = 
    `<b>${escapeHtml(title)}</b>\n\n` +
    `⏱ Длительность: ${duration}\n` +
    `👁 Просмотров: ${views}\n` +
    (url ? `\n🔗 <a href="${url}">Смотреть</a>` : "");
  
  const thumbnail = video.thumbnailUrl;
  
  if (thumbnail) {
    try {
      await ctx.replyWithPhoto(thumbnail, {
        caption: text,
        parse_mode: "HTML",
      });
      return;
    } catch (e) {
      console.error("Photo error:", e);
    }
  }
  
  await ctx.reply(text, { parse_mode: "HTML" });
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
  
  const text = 
    `<b>${escapeHtml(title)}</b>\n\n` +
    `⏱ Длительность: ${duration}\n` +
    `👁 Просмотров: ${views}\n` +
    `⭐ Рейтинг: ${rating} (${votes} голосов)\n` +
    `📂 Категории: ${categories}\n` +
    `🏷 Теги: ${tags}\n` +
    (url ? `\n🔗 <a href="${url}">Смотреть</a>` : "");
  
  const thumbnail = video.thumbnailUrls?.[0] || video.files?.thumb;
  
  if (thumbnail) {
    try {
      await ctx.replyWithPhoto(thumbnail, {
        caption: text,
        parse_mode: "HTML",
      });
      return;
    } catch (e) {
      console.error("Photo error:", e);
    }
  }
  
  await ctx.reply(text, { parse_mode: "HTML" });
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

bot.start();
console.log("Bot started!");
