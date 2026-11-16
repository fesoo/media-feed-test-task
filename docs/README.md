# Документация Media Feed

[Обзор проекта и быстрый запуск](../README.md)

Документация описывает текущий код. Предложения по развитию и ожидаемые production-характеристики вынесены отдельно и не считаются реализованными возможностями.

## Маршруты чтения

| Задача | Что открыть |
|---|---|
| Быстро запустить и оценить демо | [README](../README.md), затем [ручные сценарии](TESTING.md#ручная-проверка) |
| Продолжить разработку | [Разработка](DEVELOPMENT.md) → [Архитектура](ARCHITECTURE.md) → [Разбор проекта](PROJECT_REVIEW.md) |
| Разобраться с видео и загрузкой | [Медиа и производительность](MEDIA.md) |
| Проверить UX и доступность | [Интерфейс и управление](INTERACTIONS.md) → [Проверка проекта](TESTING.md) |
| Подготовить дальнейшее развитие | [Разбор проекта](PROJECT_REVIEW.md) → [План развития](ROADMAP.md) |
| Выложить исходники на GitHub | [Публикация](PUBLISHING.md) |

## Справочные материалы

Ссылки на документацию используемых технологий; конкретные версии зависимостей зафиксированы в [package.json](../package.json) и [package-lock.json](../package-lock.json).

- [React](https://react.dev/).
- [Vite](https://vite.dev/guide/).
- [TanStack Query: infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries).
- [Zustand](https://zustand.docs.pmnd.rs/).
- [hls.js](https://github.com/video-dev/hls.js).
- [HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement).
- [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API).
- [CSS Scroll Snap](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap).
- [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

## Поддержка документации

При изменении поведения обновляйте соответствующий тематический документ. Команды запуска находятся в [DEVELOPMENT.md](DEVELOPMENT.md), список выполненных проверок — в [TESTING.md](TESTING.md), будущие задачи — в [ROADMAP.md](ROADMAP.md). В корневом README остаются краткое описание и ссылки.
