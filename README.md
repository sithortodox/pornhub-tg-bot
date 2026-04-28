# Pornhub Telegram Bot

Телеграм-бот для поиска контента с Pornhub используя [pornhub-api](https://github.com/Derfirm/pornhub-api)

## Функционал

- **Поиск видео** - поиск по ключевым словам
- **Популярные видео** - просмотр трендовых видео
- **Категории** - просмотр видео по категориям
- **Теги** - поиск видео по тегам
- **Порнозвёзды** - просмотр видео с конкретными актёрами
- **По ID видео** - получение информации о конкретном видео

## Установка

1. Клонируйте репозиторий:
```bash
cd pornhub-telegram-bot
```

2. Создайте виртуальное окружение:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows
```

3. Установите зависимости:
```bash
pip install -r requirements.txt
```

4. Создайте файл `.env`:
```bash
cp .env.example .env
```

5. Получите токен бота от [@BotFather](https://t.me/BotFather) и добавьте его в `.env`:
```
BOT_TOKEN=your_bot_token
```

## Запуск

### Обычный запуск
```bash
python bot.py
```

### Docker
```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

## Команды бота

- `/start` - Главное меню
- `/search` - Поиск видео
- `/popular` - Популярные видео
- `/categories` - Категории
- `/stars` - Порнозвёзды
- `/help` - Помощь
