# Kashi Yatra 2027 - Backend

🛕 Backend API for Kashi Yatra 2027 - IIT (BHU) Varanasi's annual cultural festival.

## Tech Stack

- **Runtime:** Node.js with Express.js
- **Language:** TypeScript
- **APIs:** REST + GraphQL
- **Databases:** 
  - PostgreSQL (via Prisma ORM) - User data
  - MongoDB (via Mongoose) - Account progress tracking
- **Caching:** Redis
- **Cloud Services:** AWS (S3, Textract, SSM)

## Features

- 🔐 **Authentication:** Google OAuth via NextAuth.js integration
- 📋 **Aadhaar KYC:** Document upload to S3 + verification via AWS Textract
- 📱 **OTP Verification:** Phone number verification with rate limiting
- 👤 **User Profiles:** College details, profile completion tracking
- 📧 **Email Service:** Transactional emails via Handlebars templates
- 📊 **GraphQL API:** User profile queries with middleware protection

## Project Structure

```
├── app/                    # Express app setup
├── controller/             # Route controllers
│   ├── admin/              # Admin endpoints
│   └── user/               # User endpoints (auth, aadhaar, contact, otp, profile)
├── databaseManagers/
│   ├── mongoose/           # MongoDB models & connection
│   └── prisma/             # Prisma schemas & migrations
├── graphql/
│   ├── engine/             # Apollo Server setup
│   ├── middleware/         # GraphQL middleware
│   ├── resolver/           # GraphQL resolvers
│   └── schema/             # GraphQL type definitions
├── lib/env/                # Environment configuration
├── middleware/
│   ├── limiters/           # Rate limiting
│   ├── protect/            # Auth middleware
│   └── schemas/            # Zod validation schemas
├── routes/                 # Express routes
├── services/
│   ├── email/              # Email service
│   ├── redis/              # Redis client
│   ├── s3/                 # AWS S3 manager
│   └── textract/           # AWS Textract service
└── server/                 # Server & cluster manager
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL
- MongoDB
- Redis

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp secrets/.env.example secrets/.env.development

# Generate Prisma client
pnpm prisma generate

# Run database migrations
pnpm prisma migrate dev

# Start development server
pnpm dev
```

### Environment Variables

Create `secrets/.env.development` with:

```env
# Database
DATABASE_URL=postgresql://...
MONGODB_URI=mongodb://...

# Redis
REDIS_URL=redis://...

# AWS
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
S3_BUCKET_NAME=...

# Auth
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/auth` | Authenticate user |
| POST | `/user/contact` | Submit contact form |
| PATCH | `/user/profile` | Update college details |
| POST | `/user/otp/getOtp` | Request OTP |
| POST | `/user/otp/verifyOtp` | Verify OTP |
| POST | `/aadhaar/upload-url` | Get presigned S3 URL |
| PATCH | `/aadhaar/confirm-upload` | Confirm Aadhaar upload |
| POST | `/aadhaar/extract-details-and-update-profile` | Extract & verify Aadhaar |

### GraphQL API

Available at `/graphql` with queries for user profile data.

## Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm prisma:gen   # Generate Prisma client
pnpm prisma:push  # Push schema changes
```

## License

Private - IIT (BHU) Varanasi
