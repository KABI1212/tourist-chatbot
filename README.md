# 🌍 Tourist Guide & AI Travel Planner (Version 2.0)

A full-stack, enterprise-grade AI travel planning application built with modern architecture, **Spring Data MongoDB (MongoDB Atlas)**, **Spring Security (JWT)**, **Google Gemini AI**, and a responsive **HTML5/CSS3/Vanilla JavaScript** luxury frontend.

---

## 🚀 Key Features

* **AI-Powered Global Itinerary Planning:** Plan multi-day trips (e.g. *"Plan a 3-day trip to Ooty"*) with day-by-day schedules, activities, food recommendations, and travel tips.
* **Curated Destination Explorer:** Search and explore worldwide landmarks with verified coordinates, entry fees, visiting hours, Unsplash photography, and Google Maps embeds.
* **Travel Cost Calculator:** Real-time estimates for transit, accommodation, dining, activities, and contingency buffers.
* **Secure JWT Authentication:** Stateless security with BCrypt password hashing, token expiration, and protected REST APIs (`/api/chat`, `/api/trips`, `/api/favorites`, `/api/users`).
* **MongoDB Atlas Persistence:** Multi-collection schema for `users`, `chats`, `messages`, `trips`, `destinations`, and `favorites`.
* **Scalable Architecture:** Enterprise-grade, production-ready microservice backend design with robust error handling and seed data automation.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Java 17+, Spring Boot 3.3.4, Spring Web, Spring Data MongoDB, Spring Security, JJWT 0.12.6, Lombok, Maven 3.9+ |
| **Database** | MongoDB Atlas Cloud |
| **AI Integration** | Google Gemini API (`gemini-2.5-flash-lite` / `gemini-1.5-flash`) |
| **Frontend** | HTML5, CSS3 (Glassmorphism & Terracotta/Gold Luxury Theme), Vanilla JavaScript (ES6+ `fetch`), FontAwesome 6, Google Fonts |

---

## 📁 Project Structure

```text
tourist-chatbot/
│
├── frontend/                     # Pure HTML5 / CSS3 / Vanilla JavaScript
│   ├── index.html                # Landing page & feature showcase
│   ├── chatbot.html              # Interactive AI travel assistant UI
│   ├── destinations.html         # Curated destination explorer & search
│   ├── login.html                # User login with JWT storage
│   ├── register.html             # User registration
│   │
│   ├── assets/                   # Images, icons, and media
│   ├── css/
│   │   ├── style.css             # Core design system & theme
│   │   ├── chatbot.css           # Chat bubbles & destination cards
│   │   └── responsive.css        # Mobile & tablet layout rules
│   │
│   └── js/
│       ├── api.js                # Centralized fetch wrapper with JWT
│       ├── auth.js               # Auth manager (login/register/logout/me)
│       ├── chatbot.js            # Chatbot interaction & rendering
│       └── app.js                # Common UI behaviors & toasts
│
├── backend/                      # Java Spring Boot 3.x Application
│   ├── pom.xml                   # Maven dependencies & build configuration
│   ├── mvnw & mvnw.cmd           # Maven Wrapper
│   │
│   └── src/main/
│       ├── java/com/tourist/chatbot/
│       │   ├── TouristChatbotApplication.java
│       │   ├── controller/       # REST Controllers (Auth, Chat, Dest, Trip, Fav, User)
│       │   ├── service/          # Business Logic & Gemini Service
│       │   ├── repository/       # Spring Data MongoDB Repositories
│       │   ├── model/            # MongoDB @Document Entities
│       │   ├── dto/              # Request / Response DTOs
│       │   ├── security/         # Spring Security, JWT filter & JwtService
│       │   ├── config/           # CORS, Web, DataInitializer configs
│       │   └── exception/        # Global exception handler & custom exceptions
│       │
│       └── resources/
│           ├── application.properties
│           └── data/destinations.json  # Seed destination data
│
├── .env                          # Environment credentials (Gemini & Mongo)
├── .gitignore
└── README.md
```

---

## ⚙️ Environment Configuration

The application loads environment variables from `.env` in the project root:

```properties
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/tourist_chatbot?retryWrites=true&w=majority
DATABASE_NAME=tourist_chatbot

# JWT Secret Key (HMAC-SHA256 256-bit key)
JWT_SECRET=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970

# Server Port
SERVER_PORT=8080
```

---

## 🏃 Running the Application

### Option 1: Using Maven Wrapper (from `backend/` directory)

```bash
cd backend
./mvnw spring-boot:run
```

On Windows Command Prompt / PowerShell:
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

### Option 2: Using Installed Maven

```powershell
cd backend
mvn spring-boot:run
```

### Option 3: Running Pre-Built JAR

```powershell
cd backend
mvn package -DskipTests
java -jar target/tourist-chatbot-1.0.0.jar
```

---

## 🌐 Accessing the Application

Once started, open your web browser:

* **Landing Page:** [http://localhost:8080](http://localhost:8080)
* **AI Travel Chatbot:** [http://localhost:8080/chatbot.html](http://localhost:8080/chatbot.html)
* **Explore Destinations:** [http://localhost:8080/destinations.html](http://localhost:8080/destinations.html)
* **Sign In:** [http://localhost:8080/login.html](http://localhost:8080/login.html)
* **Register:** [http://localhost:8080/register.html](http://localhost:8080/register.html)

---

## 📡 REST API Reference

### 1. Authentication (`/api/auth`)
* `POST /api/auth/register` — Register a new user
* `POST /api/auth/login` — Sign in and receive JWT token
* `POST /api/auth/logout` — Invalidate user session
* `GET  /api/auth/me` — Get authenticated user details

### 2. AI Chatbot (`/api/chat`)
* `POST   /api/chat` — Send message and receive Gemini response / destination cards
* `GET    /api/chat/history` — Get conversation history for current user
* `GET    /api/chat/{id}` — Get full messages for a conversation
* `DELETE /api/chat/{id}` — Delete a conversation
* `POST   /api/chat/clear` — Clear all chat history for user

### 3. Destinations (`/api/destinations`)
* `GET /api/destinations` — List all curated destinations
* `GET /api/destinations/{id}` — Get destination by ID
* `GET /api/destinations/search?query=...` — Search destinations by name, tag, or country

### 4. Trips (`/api/trips`)
* `POST   /api/trips` — Save custom trip itinerary
* `GET    /api/trips` — Get user's saved trips
* `GET    /api/trips/{id}` — Get trip by ID
* `DELETE /api/trips/{id}` — Delete saved trip

### 5. Favorites (`/api/favorites`)
* `POST   /api/favorites` — Bookmark destination to user's favorites
* `GET    /api/favorites` — Get user's saved favorites
* `DELETE /api/favorites/{id}` — Remove favorite

### 6. User Profile (`/api/users`)
* `GET  /api/users/profile` — Get full user profile
* `PUT  /api/users/profile` — Update user profile details
* `POST /api/users/change-password` — Change account password

---

## 🚀 Cloud Deployment (Render + Vercel)

This repository is ready for 1-click cloud deployment:

* **Backend (Spring Boot 3 + Java 17):** Deployed to **Render** via Docker using `render.yaml` or `backend/Dockerfile`.
* **Frontend (HTML/CSS/JS):** Deployed to **Vercel** with automatic API rewrites in `vercel.json`.

👉 **For step-by-step setup instructions, see the complete [Deployment Guide](DEPLOYMENT.md).**
