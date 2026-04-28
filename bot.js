import { Bot, session } from "grammy";
import pornhub from "pornhub";

const TOKEN = process.env.BOT_TOKEN;
const bot = new Bot(TOKEN);

bot.use(
  session({
    initial: () => ({ state: null }),
  })
);

const mainKeyboard = {
  keyboard: [
    [{ text: "Поиск видео" }, { text: "Популярные" }],
    [{ text: "Новые" }, { text: "По ссылке" }],
  ],
  resize_keyboard: true,
};

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
