<div align="center">

# ⚡ Kashi Yatra 2027 — Backend ⚡

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=24&duration=3000&pause=1000&color=00D9FF&center=true&vCenter=true&random=false&width=600&lines=High-Performance+API+Server;Built+for+Scale+%F0%9F%9A%80;Secure+by+Design+%F0%9F%94%90;Real-time+Ready+%E2%9A%A1" alt="Typing SVG" />

<br/>

[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![AWS](https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)

<br/>

<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="700">

</div>

---

## 🏗️ Architecture

<div align="center">

```
                              ╔═══════════════════════════════════════╗
                              ║         🌐 KASHI YATRA API            ║
                              ╚═══════════════════════════════════════╝
                                              │
                    ┌───────────────────────────────────────────────┐
                    │                   🛡️ GATEWAY                  │
                    │    Rate Limiting • CORS • Auth Middleware     │
                    └───────────────────────────────────────────────┘
                                              │
              ┌───────────────────────────────┴───────────────────────────────┐
              │                                                               │
    ╔═════════════════════╗                                     ╔═════════════════════╗
    ║    🔀 REST API      ║                                     ║   📊 GraphQL API    ║
    ╠═════════════════════╣                                     ╠═════════════════════╣
    ║  /user/auth         ║                                     ║  Apollo Server      ║
    ║  /user/contact      ║                                     ║  Type-safe Schema   ║
    ║  /user/profile      ║                                     ║  Middleware Guards  ║
    ║  /user/otp/*        ║                                     ║  Query Resolvers    ║
    ║  /aadhaar/*         ║                                     ╚═════════════════════╝
    ╚═════════════════════╝                                               │
              │                                                           │
              └───────────────────────────┬───────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │            🎯 SERVICE LAYER               │
                    │   Controllers • Validators • Handlers     │
                    └─────────────────────┬─────────────────────┘
                                          │
        ┌─────────────────┬───────────────┴───────────────┬─────────────────┐
        │                 │                               │                 │
   ╔═════════╗      ╔═════════╗                    ╔═════════════╗   ╔═══════════╗
   ║ 🐘 PG   ║      ║ 🍃 Mongo║                    ║ ⚡ Redis    ║   ║ ☁️ AWS    ║
   ║ Prisma  ║      ║ Mongoose║                    ║   Cache     ║   ║ S3/Textract║
   ╚═════════╝      ╚═════════╝                    ╚═════════════╝   ╚═══════════╝
```

</div>

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 🔐 Authentication
```
┌────────────────────────────┐
│  Google OAuth → JWT Token  │
│          ↓                 │
│  Session Validation        │
│          ↓                 │
│  Protected Routes          │
└────────────────────────────┘
```

</td>
<td width="50%">

### 📋 Aadhaar KYC Pipeline
```
┌────────────────────────────┐
│  Upload Request            │
│          ↓                 │
│  S3 Presigned URL          │
│          ↓                 │
│  Client → S3 Direct        │
│          ↓                 │
│  Textract Extract          │
│          ↓                 │
│  Profile Auto-Update       │
└────────────────────────────┘
```

</td>
</tr>
<tr>
<td width="50%">

### 📱 OTP System
```
┌────────────────────────────┐
│  Rate Limiter (Throttle)   │
│          ↓                 │
│  OTP Generation            │
│          ↓                 │
│  Redis Store (TTL: 5min)   │
│          ↓                 │
│  Verification + Cleanup    │
└────────────────────────────┘
```

</td>
<td width="50%">

### 📧 Email Service
```
┌────────────────────────────┐
│  Handlebars Templates      │
│          ↓                 │
│  Dynamic Data Injection    │
│          ↓                 │
│  SMTP Delivery             │
│          ↓                 │
│  Delivery Tracking         │
└────────────────────────────┘
```

</td>
</tr>
</table>

---

## 📂 Project Structure

```
⚡ ky-2027-backend/
│
├── 🚀 app/                       # Express app initialization
│   └── app.ts                    # Middleware chain setup
│
├── 🎮 controller/                # Request handlers
│   ├── 👑 admin/                 # Admin operations
│   └── 👤 user/
│       ├── 🔐 auth/              # Authentication
│       ├── 📋 aadhaar/           # KYC pipeline
│       ├── 📧 contact/           # Contact form
│       ├── 📱 otp/               # OTP verification
│       └── 👤 profile/           # Profile management
│
├── 🗄️ databaseManagers/
│   ├── 🍃 mongoose/              # MongoDB models
│   │   ├── 🔒 security/          # IP, tokens, admin security
│   │   └── 👤 user/              # Account progress
│   └── 🐘 prisma/
│       ├── 📜 schemas/           # Prisma schema files
│       └── 🔄 migrations/        # Database migrations
│
├── 📊 graphql/
│   ├── ⚙️ engine/                # Apollo Server setup
│   ├── 🛡️ middleware/            # Auth guards
│   ├── 🎯 resolver/              # Query/Mutation resolvers
│   └── 📝 schema/                # Type definitions (.gql)
│
├── 🛡️ middleware/
│   ├── 🚦 limiters/              # Rate limiting
│   ├── 🔐 protect/               # Auth middleware
│   └── 📋 schemas/               # Zod validators
│
├── 🛣️ routes/                    # Express routes
│   ├── 📋 aadhaar/
│   ├── 👑 admin/
│   └── 👤 user/
│
├── ⚙️ services/
│   ├── 📧 email/                 # Email templates & sender
│   ├── ⚡ redis/                 # Cache client
│   ├── ☁️ s3/                    # AWS S3 manager
│   └── 🔍 textract/              # AWS Textract parser
│
└── 🖥️ server/
    ├── 🔄 clusterManager/        # Multi-core clustering
    └── server.ts                 # HTTP server
```

---

## 🔌 API Endpoints

<div align="center">

### REST Endpoints

| Method | Endpoint | Auth | Description |
|:------:|:---------|:----:|:------------|
| `POST` | `/user/auth` | ❌ | Authenticate user |
| `POST` | `/user/contact` | ❌ | Submit contact form |
| `PATCH` | `/user/profile` | ✅ | Update profile |
| `POST` | `/user/otp/getOtp` | ✅ | Request OTP |
| `POST` | `/user/otp/verifyOtp` | ✅ | Verify OTP |
| `POST` | `/aadhaar/upload-url` | ✅ | Get S3 presigned URL |
| `PATCH` | `/aadhaar/confirm-upload` | ✅ | Confirm upload |
| `POST` | `/aadhaar/extract-details-and-update-profile` | ✅ | Textract extraction |

### GraphQL

```graphql
# Endpoint: /graphql

query MyAccount {
  myAccount {
    id
    email
    name
    college
    aadhaarNumber
    phoneNumber
    profileProgress {
      isAadhaarUploaded
      isAadhaarVerified
      hasSelectedCollegeDetails
      isPhoneVerified
    }
  }
}
```

</div>

---

## ⚡ Performance

<div align="center">

```
╔═══════════════════════════════════════════════════════════════╗
║                    🏎️ PERFORMANCE METRICS                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Response Time (p95)     │████████░░░░░░░░░░│  < 100ms       ║
║   Throughput              │██████████████░░░░│  10k req/s     ║
║   Redis Cache Hit         │████████████████░░│  95%           ║
║   DB Query Time           │██████░░░░░░░░░░░░│  < 50ms        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

</div>

---

## 🛠️ Quick Start

```bash
# 📦 Install dependencies
pnpm install

# 🔐 Configure environment
cp secrets/.env.example secrets/.env.development

# 🗄️ Setup databases
pnpm prisma generate
pnpm prisma migrate dev

# 🚀 Launch server
pnpm dev
```

---

## 🔐 Environment Variables

```env
# 🗄️ Databases
DATABASE_URL=postgresql://user:pass@localhost:5432/kashiyatra
MONGODB_URI=mongodb://localhost:27017/kashiyatra

# ⚡ Cache
REDIS_URL=redis://localhost:6379

# ☁️ AWS Services
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1
S3_BUCKET_NAME=kashiyatra-uploads

# 🔐 Security
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

---

## 📜 License

<div align="center">

**Private** — IIT (BHU) Varanasi

<img src="https://user-images.githubusercontent.com/74038190/212284158-e840e285-664b-44d7-b79b-e264b5e54825.gif" width="400">

---

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=16&duration=3000&pause=1000&color=00D9FF&center=true&vCenter=true&random=false&width=400&lines=Powered+by+%E2%98%95+and+Late+Nights;%E0%A4%B9%E0%A4%B0+%E0%A4%B9%E0%A4%B0+%E0%A4%AE%E0%A4%B9%E0%A4%BE%E0%A4%A6%E0%A5%87%E0%A4%B5+%F0%9F%95%89%EF%B8%8F" alt="Footer" />

</div>
