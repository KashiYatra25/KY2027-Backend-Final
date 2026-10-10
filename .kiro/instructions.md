# Backend Coding Guidelines - Kashiyatra 2027

## Core Rules

### One Controller Per File
- Each file should contain **only one controller function**
- Each file should have **only one export**
- File naming: `<action><Entity>.controller.ts` (e.g., `createTeam.controller.ts`)

### Zod Schemas - Centralized Location
- **All Zod validation schemas MUST be in `controller/middleware/schemas/`**
- Group by domain (admin, user, aadhaar, etc.)
- Export both schema and inferred type
```typescript
export const createTeamSchema = z.object({...});
export type CreateTeamSchemaType = z.infer<typeof createTeamSchema>;
```

### Index Files (Barrels)
- Every feature folder with multiple files should have an `index.ts`
- Use index for cleaner imports

### Spelling
- Use **`aadhaar`** (correct spelling), NOT `adhaar`

### No Dead Code
- **Remove unused files** - no commented-out controllers or dead code files
- **Remove unused variables** - no declared but never used variables
- **Remove unused imports** - no importing modules that aren't used
- **Remove unused exports** - no exporting functions that aren't imported anywhere
- When refactoring, always check for and clean up dead code

## Project Structure

```
controller/
├── middleware/
│   ├── schemas/           # ← ALL Zod schemas go here
│   │   ├── admin/
│   │   ├── user/
│   │   └── aadhaar/
│   ├── admin/
│   ├── user/
│   └── limiters/
├── user/
│   ├── admin/
│   │   ├── auth/
│   │   │   ├── verifyAdminCreds.controller.ts  # One controller
│   │   │   ├── refreshToken.controller.ts      # One controller
│   │   │   └── index.ts                        # Barrel export
```

## Authentication

### Admin Routes Protection
Admin routes require **both**:
1. NextAuth session (`restProtectMiddleware`)
2. Admin JWT (`verifyAdminJwtMiddleware`)

## Database

### Enum Casing
- Match enum casing between Prisma and MongoDB
- Use `UPPER_SNAKE_CASE` for enums

### Indexes
- Don't create explicit indexes for `unique: true` fields
- Add TTL indexes for expiring documents

## Error Handling

- Use `return next(new ErrorClass().handleResponse(res, {...}))`
- Do NOT use `throw` after calling `handleResponse`
- Use correct HTTP status codes (400, 401, 403, 404)

## Import Aliases

Use path aliases from tsconfig.json:
- `@controller/*`, `@middleware/*`, `@schemas/*`
- `@services/*`, `@lib/*`, `@helper/*`, `@logger/*`
