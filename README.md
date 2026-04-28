# Pornhub Telegram Bot

Телеграм-бот для поиска контента с Pornhub используя [pornhub](https://github.com/rodrigogs/pornhub) библиотеку

## Функционал

- **Поиск видео** - поиск по ключевым словам
- **Популярные видео** - просмотр самых просматриваемых видео
- **Новые видео** - просмотр новых видео
- **Рекомендуемые** - рекомендуемые видео
- **По ссылке** - получение подробной информации о видео по ссылке

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/sithortodox/pornhub-tg-bot.git
cd pornhub-tg-bot
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env`:
```bash
cp .env.example .env
```

4. Получите токен бота от [@BotFather](https://t.me/BotFather) и добавьте его в `.env`:
```
BOT_TOKEN=your_bot_token
```

## Запуск

### Обычный запуск
```bash
npm start
```

### Docker
```bash
# Сборка и запуск
docker compose up -d

# Просмотр логов
docker compose logs -f

# Остановка
docker compose down
```

## Команды бота

- `/start` - Главное меню
- `/search` - Поиск видео
- `/popular` - Популярные видео
- `/newest` - Новые видео
- `/help` - Помощь
