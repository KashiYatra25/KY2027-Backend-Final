# Backend Coding Guidelines - Kashiyatra 2027

## Project Architecture

### Root Level Structure
```
/
├── app/                    # Application entry point
│   └── constants/          # Global constants (CORS options, etc.)
├── controller/             # All controllers
│   ├── admin/
│   │   └── constants/      # Admin-specific constants (cookie, roles)
│   └── user/
│       └── constants/      # User-specific constants (cart limits)
├── middleware/             # All middlewares
├── routes/                 # All route definitions
├── schemas/                # All Zod validation schemas
├── services/               # External services (Redis, S3, gRPC, etc.)
├── lib/                    # Shared libraries (env, prisma, logger)
└── databaseManagers/       # Database connections (Prisma, Mongoose)
```

### File Naming Conventions

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Controller | `{action}{Entity}.controller.ts` | `createTeam.controller.ts` |
| Middleware | `{meaningfulName}.middleware.ts` | `adminRoutesRESTProtect.middleware.ts` |
| Route | `{domain}.routes.ts` | `admin.routes.ts` |
| Schema | `{domain}.schema.ts` | `admin.schema.ts` |
| Type | `{feature}.types.ts` | `jwt.types.ts` |
| Helper Function | `{feature}.helper.ts` | `session.helper.ts` |
| Class | `{feature}.handler.ts` or `{feature}.classes.ts` | `jwt.handler.ts` |
| Constants | `{feature}.constants.ts` | `cookie.constants.ts` |

### Middleware Naming Conventions

All middleware exports must end with `Middleware` suffix and have meaningful, exhaustive names:

```typescript
// ✅ Correct - Clear, exhaustive naming
export const userRoutesRESTProtectMiddleware = ...
export const userRoutesGQLProtectMiddleware = ...
export const adminRoutesRESTProtectMiddleware = ...
export const checkUserAccountStatusMiddleware = ...
export const verifyGoogleTokenMiddleware = ...

// ❌ Wrong - Vague or missing suffix
export const protect = ...
export const restProtect = ...
export const authMiddleware = ...
```

### Middleware Folder Structure

Both `admin` and `user` must have a `protect/` folder for authentication middleware:

```
middleware/
├── admin/
│   ├── protect/                    # Admin route protection
│   │   ├── adminRoutesRESTProtect.middleware.ts
│   │   ├── helper/
│   │   │   ├── functions/
│   │   │   └── types/
│   │   └── index.ts
│   ├── auth/                       # Other admin middleware
│   └── invite/
├── user/
│   ├── protect/                    # User route protection
│   │   ├── userRoutesRESTProtect.middleware.ts
│   │   ├── userRoutesGQLProtect.middleware.ts
│   │   ├── helper/
│   │   │   ├── functions/
│   │   │   └── types/
│   │   └── index.ts
│   ├── auth/                       # Other user middleware
│   └── profile/
└── limiters/                       # Rate limiters

### Controller Domain Separation

**IMPORTANT:** `admin` and `user` are SEPARATE first-level domains inside `controller/`. They are NOT nested.

```
controller/
├── admin/                  # Admin domain (FIRST LEVEL)
│   ├── auth/
│   ├── users/
│   ├── suspend/
│   ├── helper/
│   └── constants/
├── user/                   # User domain (FIRST LEVEL, SAME LEVEL as admin)
│   ├── auth/
│   ├── profile/
│   ├── cart/
│   ├── helper/
│   └── constants/
├── pass/                   # Other domains at first level
└── helper/                 # Shared controller helpers
```

❌ **WRONG:** `controller/user/admin/` (admin nested under user)
✅ **CORRECT:** `controller/admin/` and `controller/user/` as siblings

### First-Level Subfolder Structure

Every first-level subfolder inside `controller/`, `middleware/`, or `services/` should follow this pattern:

```
controller/admin/
├── auth/                           # Feature folder
│   ├── login.controller.ts         # Controller files
│   ├── logout.controller.ts
│   └── refresh.controller.ts
├── helper/                         # Helper folder (REQUIRED at first level)
│   ├── types/                      # Type definitions
│   │   └── jwt.types.ts
│   ├── functions/                  # Helper functions
│   │   ├── jwt.helper.ts
│   │   └── session.helper.ts
│   └── classes/                    # Classes (if needed)
│       └── jwt.handler.ts
└── constants/                      # Domain-specific constants
    └── cookie.constants.ts
```

### Helper Folder Rules

1. **Location**: `helper/` folder must be at the FIRST level of each domain subfolder
2. **Contents**:
   - `types/` - All TypeScript interfaces and types
   - `functions/` - All helper functions
   - `classes/` - All class definitions (if needed)
3. **One feature per file**: Do NOT mix multiple features in the same file
4. **No nested helpers**: Helper folder should only exist at the first subfolder level

### Constants Folder Rules

1. **Global constants**: Put in `app/constants/` (e.g., CORS options)
2. **Domain constants**: Put in `controller/{domain}/constants/` at the same level as `helper/`

❌ **NO root `constants/` folder** - all constants must be in `app/constants/` or domain-specific folders.

Example:
```
app/
└── constants/
    └── cors.options.ts         # Global constants

controller/admin/
├── helper/
├── constants/                  # Admin-specific constants
│   ├── cookie.constants.ts
│   └── roles.constants.ts

controller/user/
├── helper/
├── constants/                  # User-specific constants
│   └── cart.constants.ts
```

---

## File Organization Rules

### One Export Per File
- Each controller file: **ONE controller function**
- Each middleware file: **ONE middleware function**
- Each helper file: **ONE feature's functions** (can have multiple related functions)
- Each type file: **ONE feature's types** (can have multiple related types)

### No Multi-Feature Files
```typescript
// ❌ WRONG - Multiple features in one file
// jwt.helper.ts
export function createAccessToken() {...}
export function createRefreshToken() {...}
export function sendEmail() {...}        // Different feature!
export function hashPassword() {...}     // Different feature!

// ✅ CORRECT - Single feature per file
// jwt.helper.ts
export function createAccessToken() {...}
export function createRefreshToken() {...}
export function validateAccessToken() {...}

// email.helper.ts
export function sendEmail() {...}

// crypto.helper.ts
export function hashPassword() {...}
```

---

## Schema Guidelines

### Location
All Zod schemas MUST be in the root `schemas/` folder, organized by domain:
```
schemas/
├── admin/
│   ├── admin.schema.ts
│   ├── caApproval.schema.ts
│   └── coupon.schema.ts
├── user/
│   ├── profile.schema.ts
│   ├── cart.schema.ts
│   └── auth.schema.ts
├── event/
│   └── event.schema.ts
└── team/
    └── team.schema.ts
```

### Naming Convention
- **Schema variable**: `{name}RequestSchema` (camelCase)
- **Type**: `{Name}RequestSchemaType` (PascalCase)

```typescript
// ✅ Correct
export const profileUpdationRequestSchema = z.object({...});
export type ProfileUpdationRequestSchemaType = z.infer<typeof profileUpdationRequestSchema>;

// ❌ Wrong
export const profileSchema = z.object({...});
export type ProfileSchemaType = ...;
```

---

## Index Files (Barrel Exports)

### When to Create index.ts
- **Create** if folder has ≥3 exports from multiple files
- **Do NOT create** if only re-exporting from one file
- **Do NOT create** for folders with <3 exports

### Example
```typescript
// ✅ Good - Multiple exports from multiple files
// controller/admin/auth/index.ts
export { login } from "./login.controller.js";
export { logout } from "./logout.controller.js";
export { refresh } from "./refresh.controller.js";

// ❌ Bad - Only one export
// controller/admin/users/index.ts
export { getUsers } from "./getUsers.controller.js";  // Just import directly!
```

---

## TypeScript Strictness

### No `any` Type
**NEVER** use `any` type. Always provide proper typings.

```typescript
// ❌ WRONG - Using any
function processData(data: any): any {
  return data.value;
}

const result: any = await someAsyncFunction();

// ✅ CORRECT - Proper typings
interface DataInput {
  value: string;
  count: number;
}

interface DataOutput {
  processed: boolean;
  result: string;
}

function processData(data: DataInput): DataOutput {
  return { processed: true, result: data.value };
}

const result: MyResponseType = await someAsyncFunction();
```

### When Types Are Unknown
If you genuinely don't know the type:
1. Use `unknown` instead of `any` (forces type narrowing)
2. Create a proper interface based on the expected shape
3. Use generics for flexible but type-safe functions

```typescript
// ❌ WRONG
function parseResponse(response: any) {
  return response.data;
}

// ✅ CORRECT - Use unknown and narrow
function parseResponse(response: unknown): ParsedData {
  if (!isValidResponse(response)) {
    throw new Error("Invalid response");
  }
  return response.data;
}

// ✅ CORRECT - Use generics
function parseResponse<T>(response: ApiResponse<T>): T {
  return response.data;
}
```

### Type Imports
Always import types explicitly:
```typescript
import type { Request, Response } from "express";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
```

### Refactoring Discipline
When writing new code or modifying existing code:
1. **Follow existing patterns** in the codebase
2. **Update types** when changing function signatures
3. **Remove unused types** when refactoring
4. **Add types** for all function parameters and return values
5. **Use interfaces** for object shapes, `type` for unions/intersections

---

## Error Handling
All names (variables, functions, classes, files) must be:
- **Exhaustive**: Fully describe what it does
- **Immediately eye-catching**: Easy to understand at a glance
- **Meaningful**: No vague or generic names

```typescript
// ✅ Good - Exhaustive, meaningful names
export const adminRoutesRESTProtectMiddleware = ...
export const checkUserAccountStatusMiddleware = ...
export const validateCaApplicationRequestSchema = ...
export function generateAdminAccessAndRefreshTokenPair() {...}
export function extractSessionTokenFromCookie() {...}

// ❌ Bad - Vague, generic names
export const protect = ...
export const auth = ...
export const validate = ...
export function generate() {...}
export function extract() {...}
```

### No Dead Code
- Remove unused files, variables, imports, and exports
- No commented-out code blocks
- Clean up after refactoring
- **Do NOT keep unused files "for reference"** - delete them

### No Deprecated Exports
- **Do NOT re-export deprecated types/functions** for backward compatibility
- If something is deprecated, remove it completely
- Update all consumers to use the new names instead

```typescript
// ❌ WRONG - Keeping deprecated exports
export type AdminTokenPayload = AccessTokenPayload; // @deprecated
export type DecodedAdminToken = DecodedAccessToken; // @deprecated

// ✅ CORRECT - Just export the actual types
export interface AccessTokenPayload {...}
export interface DecodedAccessToken {...}
// Update all consumers to use the new names!
```

### Error Handling
```typescript
// ✅ Correct
return next(new BadRequest().handleResponse(res, { info: "Invalid input" }));

// ❌ Wrong
throw new BadRequest().handleResponse(res, { info: "Invalid input" });
```

### Spelling
- Use `aadhaar` (correct spelling), NOT `adhaar`

---

## Import Aliases

### Rule: Always Use @ Aliases for Non-Sibling Imports

**IMPORTANT:** Every import that is NOT from the same directory level MUST use `@` path aliases.

- **Same level (sibling)**: Use relative `./` imports
- **Different level (parent/child/other)**: Use `@` alias imports

```typescript
// ═══════════════════════════════════════════════════════════════════
// SAME LEVEL (sibling files) - Use relative imports
// ═══════════════════════════════════════════════════════════════════
// File: controller/admin/auth/adminLogin.controller.ts
import { ADMIN_COOKIE_OPTIONS } from "./cookie.constants.js";  // ✅ Same folder

// ═══════════════════════════════════════════════════════════════════
// DIFFERENT LEVEL - MUST use @ alias imports
// ═══════════════════════════════════════════════════════════════════
// ✅ CORRECT - Using @ aliases
import { xyz } from "@controller/admin/helper/functions/jwt.helper.js";
import { abc } from "@middleware/user/protect/index.js";
import { schema } from "@schemas/admin/admin.schema.js";
import { service } from "@services/redis/index.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";

// ❌ WRONG - Using relative paths for non-sibling imports
import { xyz } from "../helper/functions/jwt.helper.js";
import { abc } from "../../../middleware/user/protect/index.js";
import { schema } from "../../../../schemas/admin/admin.schema.js";
```

### Available Path Aliases (tsconfig.json)
| Alias | Path |
|-------|------|
| `@root/*` | `./*` |
| `@app/*` | `./app/*` |
| `@controller/*` | `./controller/*` |
| `@middleware/*` | `./middleware/*` |
| `@schemas/*` | `./schemas/*` |
| `@services/*` | `./services/*` |
| `@lib/env/*` | `./lib/env/*` |
| `@lib/prisma/*` | `./databaseManagers/prisma/*` |
| `@lib/mongo/*` | `./databaseManagers/mongoose/*` |
| `@logger/*` | `./lib/logger/*` |
| `@utils/*` | `./utils/*` |
| `@helper/*` | `./utils/helper/*` |
| `@gql/*` | `./graphql/*` |
| `@routes/*` | `./routes/*` |
| `@redis/*` | `./services/redis/*` |
| `@constants/*` | `./app/constants/*` |

If a path alias doesn't exist for your use case, add it to `tsconfig.json`.

---

## Authentication

### Admin Routes
Admin routes require Admin JWT only (no NextAuth session needed):
1. `adminRoutesRESTProtectMiddleware` - Verifies Admin JWT from Authorization header

### User Routes
User routes require NextAuth session:
1. `userRoutesRESTProtectMiddleware` - Verifies NextAuth session for REST routes
2. `userRoutesGQLProtectMiddleware` - Verifies NextAuth session for GraphQL routes

---

## Database

### Enum Casing
- Use `UPPER_SNAKE_CASE` for enums
- Match casing between Prisma and MongoDB

### Indexes
- Don't create explicit indexes for `unique: true` fields
- Add TTL indexes for expiring documents

---

## GraphQL Guidelines

### Root Folder Structure

All GraphQL code MUST be under the `graphql/` folder. Unlike REST (which has nested domain folders), GraphQL has a **flat structure at the first level**, but middleware and resolvers CAN be submodularized by feature/domain:

```
graphql/
├── engine/                         # GraphQL engine setup (Apollo, context)
│   └── engine.ts
├── schema/                         # GraphQL schema definitions (.gql files)
│   ├── main.gql
│   ├── user.profile.gql
│   └── ca.gql
├── resolver/                       # Resolver implementations
│   ├── user/                       # Feature subfolder (optional)
│   │   ├── getMyAccount.resolver.ts
│   │   └── index.ts
│   ├── ca/                         # Feature subfolder (optional)
│   │   ├── getMyCaInfo.resolver.ts
│   │   └── index.ts
│   └── main.resolver.ts            # Barrel export
├── middleware/                     # GQL middleware/guards
│   ├── admin/                      # Feature subfolder (optional)
│   │   ├── adminContextGuard.middleware.ts
│   │   ├── adminJwtGuard.middleware.ts
│   │   └── index.ts
│   ├── user/                       # Feature subfolder (optional)
│   │   ├── myProfileGuard.middleware.ts
│   │   ├── isAuthenticatedGuard.middleware.ts
│   │   ├── isProfileCompleteGuard.middleware.ts
│   │   └── index.ts
│   └── index.ts                    # Barrel export
└── helper/                         # Shared GQL helpers (REQUIRED)
    ├── types/
    │   ├── context.types.ts
    │   ├── userProfile.types.ts
    │   └── ca.types.ts
    └── functions/                  # If needed
```

### Submodularization Rules

Middleware and resolvers CAN be organized into subfolders when:
- There are many files related to a single feature/domain
- Grouping improves discoverability

**Flat structure (for small projects):**
```
graphql/middleware/
├── adminContextGuard.middleware.ts
├── adminJwtGuard.middleware.ts
├── myProfileGuard.middleware.ts
├── isAuthenticatedGuard.middleware.ts
└── index.ts
```

**Submodularized structure (for larger projects):**
```
graphql/middleware/
├── admin/
│   ├── adminContextGuard.middleware.ts
│   ├── adminJwtGuard.middleware.ts
│   └── index.ts
├── user/
│   ├── myProfileGuard.middleware.ts
│   ├── isAuthenticatedGuard.middleware.ts
│   └── index.ts
└── index.ts                        # Re-exports from subfolders
```

**Same applies to resolvers:**
```
graphql/resolver/
├── user/
│   ├── getMyAccount.resolver.ts
│   └── index.ts
├── ca/
│   ├── getMyCaInfo.resolver.ts
│   └── index.ts
└── main.resolver.ts
```

### Key Rules (Always Apply)

1. **ONE resolver per file** - Always
2. **ONE middleware per file** - Always
3. **Types in helper/types/** - Never inside middleware/resolver files
4. **Zod schemas in helper/types/ or helper/functions/** - With related types
5. **Use roleCheckerMiddleware for role-based access** - Don't create custom role guards

### Key Differences from REST

| Aspect | REST | GraphQL |
|--------|------|---------|
| Helper location | Per-domain (`controller/admin/helper/`) | **Single** `graphql/helper/` |
| Subfolders | Required by domain | **Optional** by feature |
| Role checking | `adminRoleCheckerMiddleware` | `roleCheckerMiddleware("GraphQL", ...)` |

### File Organization Rules

**ONE resolver per file:**
```typescript
// ✅ CORRECT
// graphql/resolver/user/getMyAccount.resolver.ts
export const getMyAccountResolver = new MiddlewareChainPipeline()...

// graphql/resolver/ca/getMyCaInfo.resolver.ts
export const getMyCaInfoResolver = new MiddlewareChainPipeline()...
```

**ONE middleware per file:**
```typescript
// ✅ CORRECT
// graphql/middleware/admin/adminJwtGuard.middleware.ts
export const adminJwtGuard = async (...) => {...}

// graphql/middleware/user/isAuthenticatedGuard.middleware.ts
export const isAuthenticatedGuard = async (...) => {...}

// ❌ WRONG - Multiple guards in one file
// graphql/middleware/admin.middleware.ts
export const adminJwtGuard = ...
export const isMasterAdminGuard = ...
```

**Types in helper/types/:**
```typescript
// ✅ CORRECT
// graphql/helper/types/context.types.ts
export type AdminValidatedContextType = ...
export interface AdminGqlContext extends GqlGlobalContext {...}

// ❌ WRONG - Types inside middleware files
// graphql/middleware/admin/adminJwtGuard.middleware.ts
export type AdminValidatedContextType = ...  // Should be in helper/types/
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Resolver File | `{queryName}.resolver.ts` | `getMyAccount.resolver.ts` |
| Resolver Export | `{queryName}Resolver` | `getMyAccountResolver` |
| Middleware File | `{guardName}.middleware.ts` | `adminJwtGuard.middleware.ts` |
| Middleware Export | `{guardName}` | `adminJwtGuard` |
| Schema File | `{domain}.gql` | `user.profile.gql` |
| Type File | `{feature}.types.ts` | `context.types.ts`, `userProfile.types.ts` |

### Middleware vs REST

- **GraphQL middleware** lives in `graphql/middleware/` (NOT in root `middleware/`)
- **REST middleware** lives in root `middleware/`
- **Do NOT mix** GQL and REST middleware
- Guards like `userRoutesGQLProtectMiddleware` in root `middleware/` are for Express-level protection, NOT resolver-level guards
- **Use `roleCheckerMiddleware("GraphQL", ...)`** for role-based access control in resolvers

---

## Git Safety

**IMPORTANT:** Never commit or push to any repository without explicit user permission. Always ask before:
- `git add`
- `git commit`
- `git push`
- Any destructive git operations (`reset`, `force push`, etc.)

---

## Git Commit Guidelines

### Commit Message Format
Use semantic commit messages with the following format:
```
<type>(<scope>): <short description>

[optional body with more details]
```

### Commit Types
| Type | Description |
|------|-------------|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `refactor` | Code refactoring (no new features or fixes) |
| `style` | Code style changes (formatting, whitespace) |
| `docs` | Documentation changes |
| `chore` | Build, config, or maintenance tasks |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |

### Scope Examples
- `auth` - Authentication related
- `admin` - Admin functionality
- `user` - User functionality
- `ca` - Campus Ambassador
- `schedule` - Schedule management
- `email` - Email services
- `db` - Database changes

### Grouping Commits
**Group related changes into a single commit.** Changes for the same feature/fix should be in one commit:

```bash
# ✅ CORRECT - Related changes grouped together
git commit -m "feat(schedule): add schedule management system

- Add Venue, FestDay, ScheduleEntry mongoose models
- Add public routes for schedule, venues, days
- Add admin CRUD controllers for schedule management
- Add Zod schemas for schedule validation
- Add seed script for schedule data"

# ❌ WRONG - Splitting related changes
git commit -m "feat(schedule): add venue model"
git commit -m "feat(schedule): add festday model"  
git commit -m "feat(schedule): add schedule routes"
git commit -m "feat(schedule): add admin controllers"
```

### Rules
1. **One feature = One commit** - Don't split a feature across multiple commits
2. **Keep commits atomic** - Each commit should be self-contained and buildable
3. **Use present tense** - "add feature" not "added feature"
4. **Be concise but descriptive** - Short description under 72 chars
5. **Add body for complex changes** - List major changes in bullet points

### Examples
```bash
# Feature with multiple files
feat(ca): add CA leaderboard with pagination and sorting

# Bug fix
fix(email): copy handlebars templates to JS directory during build

# Refactoring
refactor(admin): extract token validation to helper function

# Multiple related fixes
fix(auth): resolve forgot password flow issues

- Add forgotPassword.handlebars template
- Update build script to copy email templates
- Fix token validation in reset password controller
```
