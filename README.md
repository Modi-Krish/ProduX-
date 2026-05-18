<div align="center">
  <img src="client/public/favicon.svg" alt="ProduX Logo" width="120" />

  # 🚀 ProduX

  **The Ultimate Real-Time Productivity & Social Management System**

  [![React](https://img.shields.io/badge/React-19.0-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
  [![Capacitor](https://img.shields.io/badge/Capacitor-Android-1192FA.svg?style=for-the-badge&logo=capacitor)](https://capacitorjs.com/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-black.svg?style=for-the-badge&logo=socketdotio)](https://socket.io/)

  [View Live Demo](https://produx-orcin.vercel.app) • [Report Bug](#) • [Request Feature](#)
</div>

---

## 📖 Overview

**ProduX** is a production-grade, gamified productivity tracking system built with the MERN stack. It bridges the gap between personal task management and social accountability. Featuring real-time WebSockets, native Android background services, and a sleek glassmorphic UI, ProduX redefines how teams and individuals track habits and execute tasks.

## ✨ Features

- **⚡ Real-Time Synchronization**: Instant task updates and chat messages powered by Socket.io.
- **📱 Native Mobile Application**: Fully integrated Android wrapper using Capacitor, featuring native Foreground Services and OS-level push notifications without Firebase.
- **🎮 Gamification Engine**: Earn XP, level up, maintain streaks, and unlock unique badges to stay motivated.
- **🤝 Social Accountability**: Send friend requests, create groups, and chat securely in real-time.
- **🔒 Enterprise Security**: JWT-based authentication, robust CORS policies, and secure MongoDB queries.
- **🎨 Modern Glassmorphic UI**: Built with React, Tailwind/CSS, and Framer Motion for buttery-smooth micro-animations.

## 🛠️ Tech Stack

| Category | Technologies |
| --- | --- |
| **Frontend** | React 19, Vite, Redux Toolkit, Framer Motion, React Router |
| **Backend** | Node.js, Express.js, Socket.io, JWT |
| **Database** | MongoDB Atlas, Mongoose |
| **Mobile Native** | Capacitor Core, Android WorkManager, Java Foreground Services |
| **Deployment** | Vercel (Frontend & Serverless Backend) |

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB Atlas URI
- Android Studio (for mobile compilation)

### 1. Clone the repository
```bash
git clone https://github.com/Modi-Krish/ProduX-.git
cd ProduX-
```

### 2. Install Dependencies
**Backend:**
```bash
npm install
```
**Frontend:**
```bash
cd client
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
PORT=5000
```
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000
```

### 4. Run the Application
Start both frontend and backend concurrently from the root directory:
```bash
npm run dev
```

### 5. Build for Android
```bash
npm run android:build
npm run android:open
```

## 📱 Mobile Architecture

ProduX utilizes a cutting-edge hybrid architecture:
- **No-Firebase Notifications**: Uses Android Jetpack `WorkManager` and `ForegroundService` written in pure Java to poll and dispatch system tray notifications instantly.
- **Token Mirroring**: Implements `@capacitor/preferences` to securely mirror JWTs from Web LevelDB to Native SharedPreferences, ensuring the Java runtime has access to authenticated sessions even when the app is killed.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<div align="center">
  <i>Architected with precision for optimal performance and user experience.</i>
</div>
