# 🔒 Privacy Policy for ProduX

**Effective Date:** May 21, 2026  
**Last Updated:** May 21, 2026  

Welcome to **ProduX**! Your privacy is of paramount importance to us. This Privacy Policy describes how ProduX ("we", "us", "our") collects, uses, processes, stores, and protects your information across our entire ecosystem, which includes:
1. The **ProduX Web Application** (hosted at [produx-orcin.vercel.app](https://produx-orcin.vercel.app))
2. The **ProduX Android Application** (`com.modikrish.produx`)
3. The **ProduX Focus Guard Chrome Extension**
4. Our companion backend services, databases, and APIs

By accessing or using any part of the ProduX ecosystem, you agree to the collection and use of information in accordance with this Privacy Policy.

---

## 📂 Table of Contents
1. [Information We Collect](#1-information-we-collect)
2. [How We Use Your Information](#2-how-we-use-your-information)
3. [Android Application & Mobile Architecture Permissions](#3-android-application--mobile-architecture-permissions)
4. [Chrome Extension (ProduX Focus Guard) Data Handling](#4-chrome-extension-produx-focus-guard-data-handling)
5. [AI Integration & Third-Party Processors](#5-ai-integration--third-party-processors)
6. [Data Storage, Retention, & Security](#6-data-storage-retention--security)
7. [User Rights & Data Deletion](#7-user-rights--data-deletion)
8. [Changes to This Privacy Policy](#8-changes-to-this-privacy-policy)
9. [Contact Us](#9-contact-us)

---

## 1. Information We Collect

To provide a fully synchronized, gamified, and real-time productivity experience, we collect the following categories of information:

### A. Account & Authentication Data
- **Personal Credentials:** When you register, we collect your email address, username, and password. Passwords are securely hashed on our servers using one-way cryptographic algorithms (`bcrypt`) and are never stored in plain text.
- **Third-Party Authentication (Google OAuth):** If you choose to log in using Google Auth, we retrieve your profile information (name, email address, avatar URL) as authorized by your Google account permissions.

### B. Productivity & Gamification Data
- **Tasks & Habits:** Details of tasks you create, habits you track, checklist items, priorities, and completion timestamps.
- **Gamification Profile:** Accumulated experience points (XP), current level, consecutive streaks, and unlocked badges/achievements.
- **Social Accountability Data:** Friend list associations, pending group invitations, and secure real-time message payloads exchanged during collaboration sessions.

### C. Technical & Sync Data
- **WebSocket Connection Details:** Real-time event logging to maintain connection states via Socket.io for immediate updates of chat and task updates.
- **Device Identifiers & App Settings:** Basic configuration flags, user theme preferences, and localized date/time settings to deliver timezone-accurate task schedules.

---

## 2. How We Use Your Information

ProduX operates on a baseline principle of *data minimization*. We only use your information to power and enhance core application features:
- **Real-Time Synchronization:** Synchronizing state between your web dashboard, mobile devices, and browser extension using real-time Socket.io channels.
- **Gamification Mechanics:** Rewarding your focus intervals with experience points (XP), tracking streaks to build healthy routines, and unlocking digital badges.
- **Intelligent Feedback:** Tailoring productivity analysis and recommendations based on completed tasks using secure AI APIs.
- **Service Communications:** Dispatching critical notifications about system status, feature updates, and friend/chat activities.

We **do not sell, rent, or lease** your personal data to advertising networks or third-party marketers.

---

## 3. Android Application & Mobile Architecture Permissions

The **ProduX Android App** (`com.modikrish.produx`) uses a hybrid architecture built with Capacitor. It relies on specific system permissions to execute core native features. 

Here is how mobile data is handled:

- **Token Mirroring (`@capacitor/preferences`):** To provide a seamless user session, your Json Web Token (JWT) is mirrored securely from the Web browser storage into the native Android `SharedPreferences`. This token is used strictly to authenticate API requests initiated by the application's background synchronization process.
- **Custom Native Notifications (No-Firebase):** The Android app does *not* utilize Firebase Cloud Messaging (FCM) or other external tracking push services. Instead, it utilizes native Android Jetpack `WorkManager` background schedules and `ForegroundService` processes in Java. These services query tasks locally and run lightweight background network pings directly to your self-hosted backend. System-level notification prompts are fired entirely within the local OS environment.
- **Device Autostart & Wake Lock:** Utilized to restart the local `WorkManager` background polling service if the device is rebooted, ensuring your task alarms and routines remain uninterrupted.

---

## 4. Chrome Extension (ProduX Focus Guard) Data Handling

The **ProduX Focus Guard** Chrome extension helps you eliminate distractions by monitoring active browser tabs. We designed this extension with extreme privacy controls:

- **Local Processing ONLY:** The URLs of the websites you visit are processed **entirely within your browser's local sandbox runtime** (background service worker). 
- **No URL Logging:** The URLs of the sites you browse are compared against your user-configured distraction blacklist. The extension does **not** store, log, or upload your browsing history, visited URLs, search queries, or tab states to our servers or any third-party database.
- **Focus States:** The extension only communicates aggregate "Focus States" (e.g., active focus session elapsed time or a block trigger event) to the server to synchronize productivity streaks and XP.

---

## 5. AI Integration & Third-Party Processors

ProduX incorporates cutting-edge technologies to enhance your experience. These services process data as subprocessors under strict confidentiality terms:

- **Google Gemini API (`@google/genai`):** We use Google's advanced language models to analyze productivity metadata (such as task tags, completion speed, and habit frequency) to provide personalized coaching tips. No sensitive personal credentials or raw chat messages are sent to this API.
- **Firebase Firestore:** Our primary production database for storing account details, task configurations, social graphs, and persistent application records. Firebase features state-of-the-art database encryption at rest and in transit.
- **Vercel Hosting:** Our static frontend, application router, and serverless background API layer are deployed on Vercel's global CDN, which maintains enterprise-level access controls and standard server logs (containing temporary IP addresses for rate-limiting and security audits).

---

## 6. Data Storage, Retention, & Security

We implement rigorous technical and administrative security measures to keep your data safe:

- **Encryption in Transit:** All traffic flowing between our user interfaces, mobile apps, extension, and Node.js backend is encrypted using Industry-Standard Transport Layer Security (TLS/HTTPS) and Secure WebSockets (WSS).
- **Session Tokens:** Authentication is maintained via JSON Web Tokens (JWT) with moderate expiration horizons, protecting your session from unauthorized interception.
- **Retention:** We retain your account data and task metrics for as long as your account remains active. If your account is inactive for more than 24 consecutive months, we reserve the right to archive or permanently delete your account data.

---

## 7. User Rights & Data Deletion

We believe you should have complete control over your digital footprint. You have the following rights regarding your personal information:

- **Access & Correction:** You can review and update your account details directly inside the User Settings page in the dashboard.
- **Data Export:** You can request a digital file containing all tasks, habits, and gamification logs associated with your account.
- **Account Deletion (Right to Be Forgotten):** You can request a complete deletion of your account. Upon receiving a valid request, we will permanently purge your user profile, tasks, habits, achievements, social connections, and messages from our primary Firebase databases.

To submit a request for data export or complete account deletion, please email us at **krishmody311@gmail.com** with the subject line *"Data Portability/Deletion Request"*. We will process your request within 7 business days.

---

## 8. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to adapt to new features, platform changes, or evolving legal frameworks. When updates occur:
- We will update the **Last Updated** date at the top of this document.
- Significant changes will be announced via an in-app system notification or an email sent to the address associated with your account.
- Continued use of any part of the ProduX ecosystem after changes are posted constitutes acceptance of the modified Privacy Policy.

---

## 9. Contact Us

If you have any questions, concerns, feedback, or suggestions regarding this Privacy Policy or our general data-handling practices, please feel free to reach out directly:

* **Developer & Owner:** Krish Modi
* **Email:** [krishmody311@gmail.com](mailto:krishmody311@gmail.com)
* **GitHub Project Page:** [github.com/Modi-Krish/ProduX-](https://github.com/Modi-Krish/ProduX-)

---
*Thank you for trusting ProduX with your productivity journey. Let's make focus playful, together!*
