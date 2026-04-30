# Fzone 🚀

Hey there! Welcome to **Fzone**, a full-stack social media application I built to bring people together. I wanted to create a modern, fast, and interactive platform that feels premium right out of the box.

## What is Fzone?
Fzone is a complete social networking app built with React Native (Expo) on the frontend and Node.js/Express/MongoDB on the backend. It's designed with a sleek, dark-mode first UI and features real-time interactions.

### Key Features ✨
- **Dynamic Feed**: Scroll through posts, see rich media, and interact in real-time.
- **Real-time Chat & Notifications**: Built with Socket.io so you never miss a message or a friend request.
- **Stories**: Share 24-hour disappearing stories with your friends.
- **Modern UI**: A beautiful, custom design system using glassmorphism effects and smooth micro-animations.
- **Media Uploads**: Seamless image uploads powered by Cloudinary.

## Tech Stack 🛠️
- **Frontend**: React Native, Expo, Expo Router
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB
- **Storage**: Cloudinary

## Getting Started

If you want to run this project locally, you'll need to set up a few things:

### Prerequisites
- Node.js installed
- A MongoDB database connection string
- A Cloudinary account (for image uploads)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/harithsenura/Fzone.git
   cd Fzone
   ```

2. **Backend Setup**
   Navigate to the backend folder and install dependencies:
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend` directory (you can use the `.env.example` provided as a template) and add your keys:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_uri
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
   Start the server:
   ```bash
   npm start
   ```

3. **Frontend Setup**
   Open a new terminal, navigate to the root directory, and install the app dependencies:
   ```bash
   npm install
   ```
   Update the `API_BASE_URL` in `config/api.ts` to match your local IP address where the backend is running.
   
   Start the Expo app:
   ```bash
   npx expo start
   ```

## License
Feel free to explore the code, learn from it, or use it as inspiration!

---
*Built with ❤️ by Harith Senura*
