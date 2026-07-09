# Tourist Guide — AI Travel Chatbot

A production-ready Django chatbot that helps you plan trips, explore destinations,
estimate budgets, and discover hidden gems worldwide.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.x, Django REST Framework |
| AI | Google Gemini 2.5 Flash Lite (`google-genai`) |
| Primary data | Wikipedia API, Wikidata, OpenStreetMap/Nominatim |
| Chat persistence | MongoDB Atlas |
| Auth DB | SQLite (dev) |
| Static files | WhiteNoise |
| Production server | Gunicorn |

---

## Features

- **13-intent chatbot** — trip planning, budget estimation, hotels, restaurants, transport, weather, safety tips, visa info, emergency contacts, and more
- **Layered response pipeline** — Wikipedia/Wikidata/OSM → local JSON → Gemini AI
- **Rich destination cards** — images, maps, opening hours, entry fees, weather
- **Full auth** — register, login, forgot password, reset password, change password, profile
- **Chat history** — persisted to MongoDB, browsable from the sidebar
- **Voice I/O** — Web Speech API for voice input; TTS for reading responses aloud
- **Recent searches** — localStorage-based quick re-access
- **Google Translate** — 20+ languages built-in
- **Django Admin** — customised with search, filters, and inline profile editing

---

## Quick Start

### 1. Clone and set up

```bash
git clone <repo>
cd tourist_chatbot
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — add GOOGLE_API_KEY, MONGODB_URI, DJANGO_SECRET_KEY
```

### 3. Migrate and run

```bash
python manage.py migrate
python manage.py createsuperuser  # optional
python manage.py runserver
```

Visit **http://127.0.0.1:8000**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | ✅ | 50+ character random string |
| `DEBUG` | ✅ | `True` (dev) / `False` (prod) |
| `ALLOWED_HOSTS` | ✅ | Comma-separated hostnames |
| `GOOGLE_API_KEY` | ✅ | Gemini API key from [Google AI Studio](https://aistudio.google.com/) |
| `MONGODB_URI` | ⚠️ optional | MongoDB Atlas connection string (chat history) |
| `DATABASE_NAME` | ⚠️ optional | MongoDB database name (default: `tourist_chatbot`) |
| `EMAIL_HOST_USER` | ⚠️ optional | Gmail address for password reset emails |
| `EMAIL_HOST_PASSWORD` | ⚠️ optional | Gmail app password |

---

## Deployment (Railway / Render)

1. Push to GitHub
2. Connect repo to Railway/Render
3. Set all environment variables in the dashboard
4. Set start command: `gunicorn tourist_chatbot.wsgi:application --config gunicorn_config.py`
5. Set `DEBUG=False` and `ALLOWED_HOSTS=your-domain.com`

---

## API Endpoints

| Method | URL | Auth | Description |
|---|---|---|---|
| `POST` | `/api/chat/` | ✅ | Send a message, get AI response |
| `GET` | `/api/chat/history/` | ✅ | Get paginated chat history |
| `DELETE` | `/api/chat/delete/<id>/` | ✅ | Soft-delete a message |
| `POST` | `/api/chat/clear/` | ✅ | Clear all chat history |

### Chat request

```json
POST /api/chat/
Content-Type: application/json
X-CSRFToken: <token>

{ "message": "Plan a trip from Chennai to Ooty for 3 days, budget 15000" }
```

### Chat response (destination card)

```json
{
  "source": "destination",
  "response": {
    "place_name": "Ooty",
    "country": "India",
    "about": "...",
    "images": ["https://..."],
    "maps_link": "https://www.google.com/maps/...",
    ...
  }
}
```

### Chat response (Gemini)

```json
{
  "source": "gemini",
  "response": [
    { "topic": "📍 DESTINATION OVERVIEW", "details": "Ooty, Tamil Nadu..." },
    ...
  ]
}
```

---

## Project Structure

```
tourist_chatbot/
├── main/
│   ├── models.py          # UserProfile, SavedDestination, RecentSearch
│   ├── views.py           # All views — pages, auth, profile, chat API
│   ├── admin.py           # Customised Django admin
│   ├── serializers.py     # DRF serializers
│   ├── destination_service.py  # Wikipedia + Wikidata + OSM (with caching)
│   ├── wiki_service.py    # Wikipedia text fallback
│   ├── local_travel_data.py    # Local JSON fallback
│   ├── mongo_client.py    # MongoDB CRUD helpers
│   ├── utils/             # json_error, json_success, DRF exception handler
│   └── templates/         # chat.html, home.html, dashboard.html, auth pages
├── tourist_chatbot/
│   ├── settings.py        # All config via env vars
│   └── urls.py            # All URL patterns
├── chatbot/services/      # Intent, Route, Budget, Orchestrator services
│   ├── intent_service.py  # 13-intent classifier with entity extraction
│   ├── route_service.py   # Static route lookup (23 routes)
│   ├── budget_service.py  # Trip cost calculator
│   └── orchestrator.py    # Routes intents to services
├── data/
│   └── destinations.json  # Local destination database
├── .env.example           # Template — copy to .env
├── requirements.txt       # Clean, pinned dependencies
└── gunicorn_config.py     # Production server config
```

---

## Security Notes

- The `.env` file at the root **contains real credentials** — rotate `GOOGLE_API_KEY` and `MONGODB_URI` if the repo has ever been public.
- `DJANGO_SECRET_KEY` should be changed before any production deployment.
- `DEBUG=False` **must** be set in production.
