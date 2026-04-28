import os
import logging
from typing import Optional
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

from pornhub_api import PornhubApi
from pornhub_api.backends.aiohttp import AioHttpBackend

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


class Form(StatesGroup):
    search = State()
    video_id = State()
    tag_search = State()
    category_browse = State()


ORDERING_OPTIONS = {
    "featured": "Рекомендуемые",
    "newest": "Новые",
    "mostviewed": "Популярные",
    "rating": "По рейтингу"
}

PERIOD_OPTIONS = {
    "weekly": "За неделю",
    "monthly": "За месяц",
    "alltime": "За всё время"
}


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


async def get_api():
    backend = AioHttpBackend()
    return PornhubApi(backend=backend), backend


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
    
    api, backend = await get_api()
    try:
        results = await api.search.search_videos(q=query, ordering="mostviewed")
        
        if results.videos:
            await message.answer(f"Найдено видео по запросу '{query}':")
            for video in results.videos[:5]:
                await send_video_info(message, video)
        else:
            await message.answer("Ничего не найдено.")
    except Exception as e:
        logger.error(f"Search error: {e}")
        await message.answer("Ошибка при поиске.")
    finally:
        await backend.close()


@dp.message(F.text == "Популярные")
@dp.message(Command("popular"))
async def show_popular(message: types.Message):
    api, backend = await get_api()
    try:
        results = await api.search.search_videos(ordering="mostviewed", period="weekly")
        
        if results.videos:
            await message.answer("Популярные видео за неделю:")
            for video in results.videos[:5]:
                await send_video_info(message, video)
        else:
            await message.answer("Не удалось получить популярные видео.")
    except Exception as e:
        logger.error(f"Popular error: {e}")
        await message.answer("Ошибка при получении видео.")
    finally:
        await backend.close()


@dp.message(F.text == "Категории")
@dp.message(Command("categories"))
async def show_categories(message: types.Message, state: FSMContext):
    api, backend = await get_api()
    try:
        categories = await api.video.categories()
        
        builder = InlineKeyboardBuilder()
        for cat in categories.categories[:20]:
            builder.row(InlineKeyboardButton(
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
    finally:
        await backend.close()


@dp.callback_query(F.data.startswith("cat_"))
async def category_callback(callback: types.CallbackQuery):
    category = callback.data[4:]
    
    api, backend = await get_api()
    try:
        results = await api.search.search_videos(category=category, ordering="mostviewed")
        
        if results.videos:
            await callback.message.answer(f"Видео в категории '{category}':")
            for video in results.videos[:5]:
                await send_video_info(callback.message, video)
        else:
            await callback.message.answer("В этой категории нет видео.")
        await callback.answer()
    except Exception as e:
        logger.error(f"Category videos error: {e}")
        await callback.message.answer("Ошибка при получении видео.")
    finally:
        await backend.close()


@dp.message(F.text == "Теги")
async def show_tags_menu(message: types.Message, state: FSMContext):
    await message.answer(
        "Введите букву для поиска тегов (a-z):"
    )
    await state.set_state(Form.tag_search)


@dp.message(Form.tag_search)
async def process_tag_search(message: types.Message, state: FSMContext):
    letter = message.text.strip().lower()
    
    if len(letter) != 1 or not letter.isalpha():
        await message.answer("Введите одну букву (a-z).")
        return
    
    await state.clear()
    
    api, backend = await get_api()
    try:
        tags = await api.video.tags(letter)
        
        builder = InlineKeyboardBuilder()
        for tag in tags.tags[:15]:
            builder.row(InlineKeyboardButton(
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
    finally:
        await backend.close()


@dp.callback_query(F.data.startswith("tag_"))
async def tag_callback(callback: types.CallbackQuery):
    tag = callback.data[4:]
    
    api, backend = await get_api()
    try:
        results = await api.search.search_videos(tags=[tag], ordering="mostviewed")
        
        if results.videos:
            await callback.message.answer(f"Видео с тегом '{tag}':")
            for video in results.videos[:5]:
                await send_video_info(callback.message, video)
        else:
            await callback.message.answer("Нет видео с таким тегом.")
        await callback.answer()
    except Exception as e:
        logger.error(f"Tag videos error: {e}")
        await callback.message.answer("Ошибка при получении видео.")
    finally:
        await backend.close()


@dp.message(F.text == "Порнозвёзды")
@dp.message(Command("stars"))
async def show_stars(message: types.Message):
    api, backend = await get_api()
    try:
        stars = await api.stars.all_detailed()
        
        builder = InlineKeyboardBuilder()
        for star in stars.stars[:15]:
            name = star.name[:20]
            builder.row(InlineKeyboardButton(
                text=name,
                callback_data=f"star_{star.name}"
            ))
        
        await message.answer(
            "Популярные порнозвёзды:",
            reply_markup=builder.as_markup()
        )
    except Exception as e:
        logger.error(f"Stars error: {e}")
        await message.answer("Ошибка при получении списка звёзд.")
    finally:
        await backend.close()


@dp.callback_query(F.data.startswith("star_"))
async def star_callback(callback: types.CallbackQuery):
    star_name = callback.data[5:]
    
    api, backend = await get_api()
    try:
        results = await api.search.search_videos(phrase=[star_name], ordering="mostviewed")
        
        if results.videos:
            await callback.message.answer(f"Видео с {star_name}:")
            for video in results.videos[:5]:
                await send_video_info(callback.message, video)
        else:
            await callback.message.answer("Нет видео с этим актёром.")
        await callback.answer()
    except Exception as e:
        logger.error(f"Star videos error: {e}")
        await callback.message.answer("Ошибка при получении видео.")
    finally:
        await backend.close()


@dp.message(F.text == "По ID видео")
async def video_id_start(message: types.Message, state: FSMContext):
    await message.answer("Введите ID видео (например: ph560b93077ddae):")
    await state.set_state(Form.video_id)


@dp.message(Form.video_id)
async def process_video_id(message: types.Message, state: FSMContext):
    video_id = message.text.strip()
    await state.clear()
    
    api, backend = await get_api()
    try:
        is_active = await api.video.is_active(video_id)
        
        if not is_active.is_active:
            await message.answer("Видео не найдено или удалено.")
            return
        
        video = await api.video.get_by_id(video_id)
        await send_video_info(message, video)
    except Exception as e:
        logger.error(f"Video ID error: {e}")
        await message.answer("Ошибка при получении видео.")
    finally:
        await backend.close()


async def send_video_info(message: types.Message, video):
    title = video.title[:100] if video.title else "Без названия"
    duration = video.duration or "Неизвестно"
    views = video.views or "Неизвестно"
    rating = video.rating or "Неизвестно"
    url = video.url or ""
    
    text = (
        f"<b>{title}</b>\n\n"
        f"⏱ Длительность: {duration}\n"
        f"👁 Просмотров: {views}\n"
        f"⭐ Рейтинг: {rating}\n"
    )
    
    if url:
        text += f"\n🔗 <a href='{url}'>Смотреть</a>"
    
    if hasattr(video, 'thumbnails') and video.thumbnails:
        thumb_url = video.thumbnails[0] if isinstance(video.thumbnails, list) else video.thumbnails
        try:
            await message.answer_photo(thumb_url, caption=text, parse_mode="HTML")
            return
        except Exception:
            pass
    
    await message.answer(text, parse_mode="HTML")


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
