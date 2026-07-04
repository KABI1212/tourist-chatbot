# Tourist Chatbot — AI-Powered Travel Planning

A production-ready Django web application that uses Google Gemini AI to provide intelligent travel recommendations, itineraries, budgeting, and local insights.

## ✨ Features

- **AI Travel Assistant** — Powered by Google Gemini 2.5 Flash Lite
- **Smart Itineraries** — Structured travel plans with transport modes, costs, and Google Maps links
- **Budget Planning** — Cost breakdowns for budget, mid-range, and luxury travelers
- **Multi-Language Support** — Google Translate built-in (20+ languages)
- **Guest Access** — Try the chatbot without registering
- **User Authentication** — Register, login, profile management, password change
- **Chat History** — Conversations saved in MongoDB for registered users
- **Rate Limiting** — 10 requests per minute per IP
- **Production Ready** — WhiteNoise, Gunicorn, CSP headers, secure cookies
- **Responsive Design** — Works on desktop, tablet, and mobile

## 🛠️ Technology Stack

| Category | Technology |
|----------|-----------|
| Backend | Python 3.12+, Django 5.1 |
| Database | MongoDB Atlas (via PyMongo) |
| AI | Google Gemini API |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Auth | bcrypt password hashing |
| Deployment | Gunicorn, WhiteNoise |
| Security | CSRF, CSP, Secure Cookies, Rate Limiting |

## 📋 Prerequisites

- Python 3.12+
- MongoDB Atlas account
- Google Gemini API key

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd tourist_chatbot
```

### 2. Create and activate virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up environment variables

Create a `.env` file in the project root:

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Google Gemini AI
GOOGLE_API_KEY=your-gemini-api-key

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=tourist_chatbot
```

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Collect static files

```bash
python manage.py collectstatic --noinput
```

### 7. Start the development server

```bash
python manage.py runserver
```

Visit http://127.0.0.1:8000 in your browser.

## 🌐 Deployment

### Railway

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy — Railway auto-detects the Procfile

### Render

1. Create a new Web Service
2. Connect your repository
3. Set:
   - Build Command: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - Start Command: `gunicorn tourist_chatbot.wsgi:application --config gunicorn_config.py`

## 📁 Project Structure

```
tourist_chatbot/
├── main/
│   ├── views/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── chat.py
│   │   └── home.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── gemini_service.py
│   │   └── mongodb_service.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── validators.py
│   │   ├── parser.py
│   │   └── helpers.py
│   ├── forms/
│   │   ├── __init__.py
│   │   └── register.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── guest_auth.py
│   ├── templates/
│   │   ├── chat.html
│   │   ├── dashboard.html
│   │   ├── home.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── profile.html
│   │   ├── change_password.html
│   │   └── forgot_password.html
│   ├── models.py
│   ├── admin.py
│   └── tests.py
├── tourist_chatbot/
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   ├── asgi.py
│   └── logging_config.py
├── .env
├── .gitignore
├── manage.py
├── Procfile
├── runtime.txt
├── gunicorn_config.py
└── README.md
```

## 🔒 Security

- CSRF protection enabled
- Content Security Policy headers
- Secure, HttpOnly, SameSite cookies
- Rate limiting on chat endpoint
- Input validation and sanitization
- bcrypt password hashing
- Environment-based secrets
- No hardcoded credentials

## 🧪 Testing

```bash
python manage.py test main
```

## 📄 License

MIT License