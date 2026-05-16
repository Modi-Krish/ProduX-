# ProduX ⚡
### *The Ultimate Gamified Social Productivity Suite*

**Live App: [https://produx-orcin.vercel.app](https://produx-orcin.vercel.app)**

**ProduX** is not just a task manager; it's a social productivity ecosystem designed to turn your work into an adventure. Built with a bold **Playful Geometric** aesthetic, ProduX combines professional task management with RPG-style gamification, real-time social interactions, and active focus protection.

<img width="1894" height="942" alt="image" src="https://github.com/user-attachments/assets/03cac4e5-9485-4a27-a433-e933b631ad7a" />


---

## ✨ Core Pillars

### 1. 📋 RPG Task Management
*   **Dynamic Workflows**: Create, track, and manage tasks with priority-based sorting.
*   **Subtask Mastery**: Break down big goals into manageable steps with progress tracking.
*   **Task Cycles**: Support for One-off tasks, Daily habits, and Weekly routines.
*   **Real-Time Sync**: Powered by Socket.io, your workspace updates instantly across all devices.

### 2. 🎮 Gamification & Progression
*   **XP & Leveling System**: Earn experience points for every task completed. Level up to show off your productivity prowess.
*   **Achievements & Badges**: Unlock 15+ unique badges (e.g., "Night Owl", "Streak King", "Subtask Slayer").
*   **Milestone Rewards**: Visual feedback and confetti for reaching new heights.

### 3. 🏆 21-Day Hobby Challenges
*   **Habit Architect**: Transform tasks into long-term habits with the integrated 21-day tracker.
*   **Phase-Based Progress**: Tasks evolve through "Genesis", "Growth", and "Mastery" phases.
*   **Interactive Progress Board**: Visualize your journey with a dedicated inline calendar and milestone markers.

### 4. 🌐 Social & Community
*   **Global Leaderboard**: Compete with users worldwide for the top spot based on total XP.
*   **Friendship System**: Connect with peers, send requests, and build your productivity circle.
*   **Real-Time Chat**: 1-on-1 private messaging to collaborate or compete with friends.

### 5. 🚨 Focus & Accountability
*   **Math-to-Dismiss Alarms**: Set alarms for critical tasks. To stop the sound, you must solve a random mathematical problem—no more accidental snoozing!
*   **🛡️ ProduX Focus Guard**: A companion Chrome Extension that monitors your browser. It ensures you stay on your designated work site and sends desktop notifications if you get distracted.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Redux Toolkit (State), Socket.io Client, React Icons.
- **Backend**: Node.js, Express.js, Socket.io (Real-time).
- **Database**: MongoDB Atlas (Mongoose ODM).
- **Authentication**: JWT (JSON Web Tokens) with Secure HTTP-only cookies.
- **Deployment**: Vercel (Production Build).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance (Atlas or Local)
- Chrome Browser (for Extension)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Modi-Krish/ProduX-.git
   cd ProduX-
   ```

2. **Install Root & Sub-project dependencies:**
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_key
   CLIENT_URL=http://localhost:5173
   ```

4. **Run the development suite:**
   From the root directory:
   ```bash
   npm run dev
   ```

---

## 🛡️ Installing Focus Guard (Chrome Extension)

1. Download the `ProduX-FocusGuard.zip` from the Dashboard bottom banner.
2. Unzip the folder.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer Mode** (top right).
5. Click **Load unpacked** and select the extension folder.
6. Pin ProduX Focus Guard and start your first focus session!

---

## 📈 Recent Updates
- **[v1.4]** 🚀 Added Real-time Chat and Friend system.
- **[v1.3]** ⏰ Integrated Math-based alarm system for tasks.
- **[v1.2]** 🏆 Launched 21-Day Hobby Challenges with interactive boards.
- **[v1.1]** 🛡️ Released ProduX Focus Guard Chrome Extension.
- **[v1.0]** 🎉 Initial release with Dashboard, Tasks, and Gamification.

---

*Developed by Modi Krish as a state-of-the-art productivity ecosystem.*
