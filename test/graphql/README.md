# GraphQL Test Queries

This folder contains GraphQL queries for testing the API endpoints using Postman or GraphQL Playground.

## Setup

1. Get your authentication token (JWT)
2. In Postman, add header: `Authorization: Bearer <your_token>`
3. Set request URL to: `http://localhost:4000/graphql` (or your GraphQL endpoint)
4. Copy any query from the files below

## Files

- `queries/myAccount.queries.ts` - All myAccount query variations
- `queries/raw/` - Raw query strings (easier to copy-paste)

## Query Categories

### Full Queries
- `MY_ACCOUNT_FULL` - Get all profile and progress data

### Profile Only
- `MY_ACCOUNT_PROFILE_ONLY` - All profile fields
- `MY_ACCOUNT_PROFILE_BASIC` - Basic info (id, email, name, avatar)
- `MY_ACCOUNT_PROFILE_CONTACT` - Contact info (email, phone, college)
- `MY_ACCOUNT_PROFILE_IDENTITY` - Identity info (name, gender, dob, aadhaar)
- `MY_ACCOUNT_PROFILE_WITH_ROLE` - Profile with role info

### Progress Only
- `MY_ACCOUNT_PROGRESS_ONLY` - All progress fields
- `MY_ACCOUNT_PROGRESS_STEPS` - Verification steps only
- `MY_ACCOUNT_PROGRESS_STATUS` - Completion status only

### Minimal Queries
- `MY_ACCOUNT_EXISTS` - Check if account exists
- `MY_ACCOUNT_IS_COMPLETE` - Check if profile is complete
- `MY_ACCOUNT_CURRENT_STEP` - Get current step info

### Combined (Common Use Cases)
- `MY_ACCOUNT_NAVBAR` - Data for navbar display
- `MY_ACCOUNT_PROFILE_PAGE` - Data for profile page
- `MY_ACCOUNT_COMPLETE_PROFILE_PAGE` - Data for complete-profile page

### Edge Cases
- `MY_ACCOUNT_NULLABLE_FIELDS` - Test nullable fields
- `MY_ACCOUNT_TIMESTAMPS` - Test date fields
- `MY_ACCOUNT_ENUM_FIELDS` - Test enum fields (gender, role, status)

## Expected Responses

### Authenticated User
```json
{
  "data": {
    "myAccount": {
      "profile": { ... },
      "progress": { ... }
    }
  }
}
```

### Unauthenticated
```json
{
  "errors": [
    {
      "message": "Not authenticated",
      "extensions": { "code": "UNAUTHENTICATED" }
    }
  ]
}
```

### User Not Found
```json
{
  "data": {
    "myAccount": null
  }
}
```
