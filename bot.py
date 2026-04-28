import os
import logging
from typing import Optional, List
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder
import aiohttp

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

BASE_URL = "https://www.pornhub.com/webmaster"


class Form(StatesGroup):
    search = State()
    video_id = State()
    tag_search = State()


def get_main_keyboard():
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Поиск видео"), KeyboardButton(text="Популярные")],
            [KeyboardButton(text="Категории"), KeyboardButton(text="Теги")],
            [KeyboardButton(text="Порнозвёзды"), KeyboardButton(text="По ID видео")],
        ],
        resize_keyboard=True
    )
    return kb


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.pornhub.com/",
}


async def fetch(endpoint: str, params: dict = None) -> dict:
    async with aiohttp.ClientSession(headers=HEADERS) as session:
        url = f"{BASE_URL}{endpoint}"
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                text = await resp.text()
                logger.error(f"API error {resp.status}: {url} - {text[:200]}")
                return {}
            return await resp.json()


async def search_videos(q: str = "", category: str = None, tags: List[str] = None,
                        phrase: List[str] = None, ordering: str = None, period: str = None) -> list:
    params = {"search": q}
    if category:
        params["category"] = category
    if ordering:
        params["ordering"] = ordering
    if tags:
        params["tags[]"] = ",".join(tags)
    if phrase:
        params["phrase[]"] = ",".join(phrase)
    if period:
        params["period"] = period
    
    data = await fetch("/search", params)
    return data.get("videos", [])


async def get_video_by_id(video_id: str) -> dict:
    return await fetch("/video_by_id", {"id": video_id})


async def is_video_active(video_id: str) -> bool:
    data = await fetch("/is_video_active", {"id": video_id})
    return data.get("active", False)


async def get_categories() -> list:
    data = await fetch("/categories")
    return data.get("categories", [])


async def get_tags(letter: str) -> list:
    data = await fetch("/tags", {"list": letter})
    return data.get("tags", [])


async def get_stars(detailed: bool = False) -> list:
    endpoint = "/stars_detailed" if detailed else "/stars"
    data = await fetch(endpoint)
    return data.get("stars", [])


@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "Привет! Я бот для поиска контента с Pornhub.\n\n"
        "Доступные команды:\n"
        "/start - Главное меню\n"
        "/search - Поиск видео\n"
        "/popular - Популярные видео\n"
        "/categories - Категории\n"
        "/stars - Порнозвёзды\n"
        "/help - Помощь",
        reply_markup=get_main_keyboard()
    )


@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    await message.answer(
        "Как пользоваться ботом:\n\n"
        "1. Поиск видео - введите запрос для поиска\n"
        "2. Популярные - просмотр популярных видео\n"
        "3. Категории - выбор категории для просмотра\n"
        "4. Теги - поиск по тегам\n"
        "5. Порнозвёзды - список актёров\n"
        "6. По ID видео - получить видео по его ID (например: ph560b93077ddae)"
    )


@dp.message(F.text == "Поиск видео")
@dp.message(Command("search"))
async def search_start(message: types.Message, state: FSMContext):
    await message.answer("Введите поисковый запрос:")
    await state.set_state(Form.search)


@dp.message(Form.search)
async def process_search(message: types.Message, state: FSMContext):
    query = message.text.strip()
    await state.clear()
    
    try:
        videos = await search_videos(q=query, ordering="mostviewed")
        
        if videos:
            await message.answer(f"Найдено видео по запросу '{query}':")
            for video in videos[:5]:
                await send_video_info(message, video)
        else:
            await message.answer("Ничего не найдено.")
    except Exception as e:
        logger.error(f"Search error: {e}")
        await message.answer("Ошибка при поиске.")


@dp.message(F.text == "Популярные")
@dp.message(Command("popular"))
async def show_popular(message: types.Message):
    try:
        videos = await search_videos(ordering="mostviewed", period="weekly")
        
        if videos:
            await message.answer("Популярные видео за неделю:")
            for video in videos[:5]:
                await send_video_info(message, video)
        else:
            await message.answer("Не удалось получить популярные видео.")
    except Exception as e:
        logger.error(f"Popular error: {e}")
        await message.answer("Ошибка при получении видео.")


@dp.message(F.text == "Категории")
@dp.message(Command("categories"))
async def show_categories(message: types.Message):
    try:
        categories = await get_categories()
        
        builder = InlineKeyboardBuilder()
        for cat in categories[:20]:
            builder.row(types.InlineKeyboardButton(
                text=cat,
                callback_data=f"cat_{cat}"
            ))
        
        await message.answer(
            "Выберите категорию:",
            reply_markup=builder.as_markup()
        )
    except Exception as e:
        logger.error(f"Categories error: {e}")
        await message.answer("Ошибка при получении категорий.")


@dp.callback_query(F.data.startswith("cat_"))
async def category_callback(callback: types.CallbackQuery):
    category = callback.data[4:]
    
    try:
        videos = await search_videos(category=category, ordering="mostviewed")
        
        if videos:
            await callback.message.answer(f"Видео в категории '{category}':")
            for video in videos[:5]:
                await send_video_info(callback.message, video)
        else:
            await callback.message.answer("В этой категории нет видео.")
        await callback.answer()
    except Exception as e:
        logger.error(f"Category videos error: {e}")
        await callback.message.answer("Ошибка при получении видео.")


@dp.message(F.text == "Теги")
async def show_tags_menu(message: types.Message, state: FSMContext):
    await message.answer("Введите букву для поиска тегов (a-z):")
    await state.set_state(Form.tag_search)


@dp.message(Form.tag_search)
async def process_tag_search(message: types.Message, state: FSMContext):
    letter = message.text.strip().lower()
    
    if len(letter) != 1 or not letter.isalpha():
        await message.answer("Введите одну букву (a-z).")
        return
    
    await state.clear()
    
    try:
        tags = await get_tags(letter)
        
        builder = InlineKeyboardBuilder()
        for tag in tags[:15]:
            builder.row(types.InlineKeyboardButton(
                text=tag,
                callback_data=f"tag_{tag}"
            ))
        
        await message.answer(
            f"Теги на букву '{letter}':",
            reply_markup=builder.as_markup()
        )
    except Exception as e:
        logger.error(f"Tags error: {e}")
        await message.answer("Ошибка при получении тегов.")


@dp.callback_query(F.data.startswith("tag_"))
async def tag_callback(callback: types.CallbackQuery):
    tag = callback.data[4:]
    
    try:
        videos = await search_videos(tags=[tag], ordering="mostviewed")
        
        if videos:
            await callback.message.answer(f"Видео с тегом '{tag}':")
            for video in videos[:5]:
                await send_video_info(callback.message, video)
        else:
            await callback.message.answer("Нет видео с таким тегом.")
        await callback.answer()
    except Exception as e:
        logger.error(f"Tag videos error: {e}")
        await callback.message.answer("Ошибка при получении видео.")


@dp.message(F.text == "Порнозвёзды")
@dp.message(Command("stars"))
async def show_stars(message: types.Message):
    try:
        stars = await get_stars(detailed=True)
        
        builder = InlineKeyboardBuilder()
        for star in stars[:15]:
            name = star.get("name", "Unknown")[:20]
            builder.row(types.InlineKeyboardButton(
                text=name,
                callback_data=f"star_{star.get('name', 'unknown')}"
            ))
        
        await message.answer(
            "Популярные порнозвёзды:",
            reply_markup=builder.as_markup()
        )
    except Exception as e:
        logger.error(f"Stars error: {e}")
        await message.answer("Ошибка при получении списка звёзд.")


@dp.callback_query(F.data.startswith("star_"))
async def star_callback(callback: types.CallbackQuery):
    star_name = callback.data[5:]
    
    try:
        videos = await search_videos(phrase=[star_name], ordering="mostviewed")
        
        if videos:
            await callback.message.answer(f"Видео с {star_name}:")
            for video in videos[:5]:
                await send_video_info(callback.message, video)
        else:
            await callback.message.answer("Нет видео с этим актёром.")
        await callback.answer()
    except Exception as e:
        logger.error(f"Star videos error: {e}")
        await callback.message.answer("Ошибка при получении видео.")


@dp.message(F.text == "По ID видео")
async def video_id_start(message: types.Message, state: FSMContext):
    await message.answer("Введите ID видео (например: ph560b93077ddae):")
    await state.set_state(Form.video_id)


@dp.message(Form.video_id)
async def process_video_id(message: types.Message, state: FSMContext):
    video_id = message.text.strip()
    await state.clear()
    
    try:
        active = await is_video_active(video_id)
        
        if not active:
            await message.answer("Видео не найдено или удалено.")
            return
        
        video = await get_video_by_id(video_id)
        await send_video_info(message, video)
    except Exception as e:
        logger.error(f"Video ID error: {e}")
        await message.answer("Ошибка при получении видео.")


async def send_video_info(message: types.Message, video: dict):
    title = video.get("title", "Без названия")[:100]
    duration = video.get("duration", "Неизвестно")
    views = video.get("views", "Неизвестно")
    rating = video.get("rating", "Неизвестно")
    url = video.get("url", "")
    
    text = (
        f"<b>{title}</b>\n\n"
        f"⏱ Длительность: {duration}\n"
        f"👁 Просмотров: {views}\n"
        f"⭐ Рейтинг: {rating}\n"
    )
    
    if url:
        text += f"\n🔗 <a href='{url}'>Смотреть</a>"
    
    thumb = video.get("default_thumb") or video.get("thumb")
    if thumb:
        try:
            await message.answer_photo(thumb, caption=text, parse_mode="HTML")
            return
        except Exception:
            pass
    
    await message.answer(text, parse_mode="HTML")


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
