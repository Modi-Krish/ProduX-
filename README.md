# Produx ⚡

**Produx** is a vibrant, real-time productivity management platform designed to keep teams aligned, organized, and moving fast. From live task updates to smart prioritization and a clean geometric interface, Produx delivers a seamless workspace for modern collaboration.

## ✨ Features

* 🔄 **Real-Time Sync**: Instantly update tasks across all connected users with Socket.io.
* 🎨 **Playful Geometric UI**: A bold, modern interface with glassmorphism, pop shadows, and unique component styling.
* 📈 **Dynamic Priority Engine**: Automatically reorders tasks based on priority and deadlines.
* 📊 **Productivity Dashboard**: Track total, completed, and pending tasks at a glance.
* 🔒 **Secure Authentication**: JWT-based login with protected routes and secure password handling.
* 👤 **Personal Profile**: Manage your identity and view personal productivity badges.
* 📱 **Responsive Design**: Smooth experience across desktop, tablet, and mobile.

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, Redux Toolkit, Socket.io Client, Lucide Icons
* **Styling**: Vanilla CSS (Custom Geometric Theme)
* **Backend**: Node.js, Express.js, Socket.io, JWT, Bcrypt
* **Database**: MongoDB with Mongoose
* **Deployment**: Vercel (Frontend) & Render/Heroku (Backend)

## 🚀 Getting Started

### Prerequisites

* Node.js 16+
* npm or yarn
* MongoDB Atlas or a local MongoDB instance

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Modi-Krish/Real-Time-Productivity-System.git
   cd Real-Time-Productivity-System
   ```

2. **Install dependencies:**

   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and add your environment variables:

   ```env
   PORT=5000
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_secret_key
   CLIENT_URL=http://localhost:5173
   ```

4. **Run the development server:**

   ```bash
   # Start backend
   cd server
   npm run dev

   # Start frontend
   cd client
   npm run dev
   ```

## 📁 Project Structure

```text
Real-Time-Productivity-System/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Dashboard, Login, Register
│   │   ├── api/         # Axios and Socket instances
│   │   └── store/       # Redux state management
├── server/              # Node.js backend
│   ├── config/          # DB & Socket configurations
│   ├── controllers/     # Request handlers
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API endpoints
│   └── socket/          # Socket.io event logic
└── .env                 # Environment variables
```

## 📸 Screenshots

<img width="1920" height="1032" alt="image" src="https://github.com/user-attachments/assets/220e43fe-f15e-40ac-ac4d-4a3794f955e8" />
<img width="1920" height="1032" alt="image" src="https://github.com/user-attachments/assets/607d73f0-f0f0-4ca2-a296-79d2b3f0057b" />


## 🔮 Future Scope

* 🤝 **Team Collaboration Tools**: Enhanced shared workspace features for groups.
* 📱 **PWA Support**: Offline-friendly access for productivity on the go.
* 🤖 **AI Task Suggestions**: Smarter task planning and prioritization.
* 📊 **Advanced Analytics**: Deeper insights into team and individual productivity.

---

*Developed as a modern real-time productivity solution.*
