Connectivity QA Allocation
Повноцінний прототип вебзастосунку для структури команд, інженерів і їхніх алокацій.
Що реалізовано
Backend: Python 3.12, FastAPI, SQLAlchemy.
База даних: PostgreSQL 16 у Docker. Для швидкого локального запуску без Docker можливий SQLite.
Frontend: односторінкова інтерактивна схема, яка працює через API.
Початкове наповнення містить дані з попередньої схеми.
Зміни через інтерфейс записуються у SQL-базу та не зникають після оновлення сторінки.
Автоматична документація OpenAPI: `/docs`.
Повний CRUD для трьох сутностей:
`teams` або команди/проєкти
`people` або люди
`allocations` або зв’язок людини з командою та роль
Структура каталогів
Після завантаження файлів створіть таку структуру:
```text
connectivity-allocation-app/
├── backend/
│   └── main.py
├── frontend/
│   └── index.html
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```
Запуск через Docker
Встановіть Docker Desktop.
Перейдіть у кореневий каталог проєкту.
Перед першим запуском замініть пароль PostgreSQL `change-me-before-production` у `docker-compose.yml` на безпечний. Він має бути однаковим у секціях `db` та `app`.
Виконайте:
```bash
docker compose up --build
```
Відкрийте:
Застосунок: `http://localhost:8000`
Документація API та можливість перевірити всі запити: `http://localhost:8000/docs`
Перевірка стану: `http://localhost:8000/api/v1/health`
Щоб зупинити сервіси:
```bash
docker compose down
```
Щоб видалити також дані PostgreSQL:
```bash
docker compose down -v
```
Запуск без Docker для розробки
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```
За замовчуванням буде створено локальний файл SQLite `connectivity.db`. Для PostgreSQL задайте змінну середовища `DATABASE_URL`, наприклад:
```text
postgresql+psycopg://connectivity:YOUR_PASSWORD@localhost:5432/connectivity
```
API маршрути
Сутність	Методи
Команди	`GET/POST /api/v1/teams`, `GET/PUT/DELETE /api/v1/teams/{id}`
Люди	`GET/POST /api/v1/people`, `GET/PUT/DELETE /api/v1/people/{id}`
Алокації	`GET/POST /api/v1/allocations`, `GET/PUT/DELETE /api/v1/allocations/{id}`
Схема для UI	`GET /api/v1/dashboard`
Приклад створення алокації
```json
POST /api/v1/allocations
{
  "team_id": 1,
  "person_id": 4,
  "role": "DM",
  "note": "Тимчасова алокація",
  "active": true
}
```
Перед розгортанням для команди
Це технічний прототип. Перед використанням у корпоративному середовищі варто:
Додати автентифікацію через Microsoft Entra ID або інший SSO.
Додати ролі, наприклад viewer, editor, admin.
Замінити `CORS_ORIGINS: "*"` на точну адресу фронтенду.
Зберігати пароль БД у секретах, а не в `docker-compose.yml`.
Додати Alembic для контрольованих міграцій схеми бази.
Налаштувати резервні копії PostgreSQL та журнал аудиту змін.
Розміщення поруч із SharePoint
Для прототипу розгорніть цей Docker-контейнер у внутрішньому Azure App Service, Azure Container Apps або на внутрішньому сервері. Потім додайте посилання на URL застосунку на сторінку SharePoint. Вбудовування через вебчастину Embed можливе лише якщо домен застосунку дозволений політикою SharePoint.
