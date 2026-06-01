# Merge Backend

This is the backend service for the **Merge** platform, a specialized network for developers to connect, match, collaborate on projects, and participate in hackathons.

## Tech Stack
- **Runtime & Framework:** Node.js, Express.js (v5)
- **Language:** TypeScript
- **Database ORM:** Prisma
- **Real-time Communication:** Socket.io
- **Authentication:** JWT (JSON Web Tokens) & bcrypt
- **File Uploads:** Cloudinary (via Multer)
- **Email Service:** Nodemailer
- **Logging:** Winston

## Key Features & Modules
- **Authentication & Users:** Secure registration, login, and comprehensive profile management.
- **Matching & Swiping:** Tinder-like discovery logic for connecting with fellow developers.
- **Projects & Workspaces:** Manage collaborative coding projects and real-time interactive workspaces.
- **Social Feed:** Share updates and posts with your network.
- **External Integrations:** Fetch and showcase GitHub data.
- **Hackathons:** Discover and participate in upcoming hackathons.
- **Real-time Engine:** WebSockets power live chat, instant notifications, and workspace synchronization.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A relational database (e.g., PostgreSQL)
- Cloudinary account (for image/media uploads)
- SMTP Server credentials (for email notifications)

### Installation
1. Navigate to the backend directory:
   ```bash
   cd merge_backend
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```

### Environment Variables
Create a `.env` file in the root of the backend directory. It should contain the following essential variables:

```env
PORT=5000
DATABASE_URL="your_database_connection_string"
JWT_SECRET="your_jwt_secret_key"
FRONTEND_URL="http://localhost:5173" # Or your production frontend URL

# Cloudinary
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# SMTP (Nodemailer)
SMTP_HOST="your_smtp_host"
SMTP_PORT="your_smtp_port"
SMTP_USER="your_smtp_user"
SMTP_PASS="your_smtp_password"
```

### Database Setup
Initialize your database by generating the Prisma client and applying the schema:
```bash
npx prisma generate
npx prisma db push
```

### Running the Server
- **Development Mode** (with hot-reloading via `tsx`):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm run start
  ```

## API Structure
The REST API endpoints are prefixed with `/api`. Key routes include:
- `/api/auth` - User authentication and session management
- `/api/users` - User CRUD operations
- `/api/matches` - Viewing and managing matched connections
- `/api/swipe` - The core developer discovery mechanism
- `/api/projects` - Project showcases and portfolios
- `/api/posts` - Community feed
- `/api/github` - GitHub profile integrations
- `/api/hackathons` - Hackathon event endpoints
- `/api/notifications` - Real-time and read/unread alerts
- `/api/workspace` - Collaborative environment management

## Health & Monitoring
- **Health Check:** `GET /health` ensures the server is running and responsive.
- **Logging:** Advanced request and error logging are captured automatically to monitor application stability. Uncaught exceptions and unhandled rejections trigger graceful shutdown procedures to prevent data corruption.
