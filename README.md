# Topcoder Member API v6

## Overview

The Topcoder Member API provides endpoints to manage member profiles, statistics, and history. All protected endpoints require authentication and proper authorization.

---

## API Endpoints

| Method | Endpoint                                 | Description                                 |
|--------|------------------------------------------|---------------------------------------------|
| GET    | /v6/members/:handle                      | Get member profile by handle                |
| PATCH  | /v6/members/:handle                      | Update member profile                       |
| POST   | /v6/members/:handle/photo                | Upload member photo                         |
| GET    | /v6/members/:handle/stats                | Get current member stats                    |
| POST   | /v6/members/:handle/stats                | Create member stats                         |
| PATCH  | /v6/members/:handle/stats                | Partially update member stats               |
| GET    | /v6/members/:handle/stats/history        | Get member stats history                    |
| POST   | /v6/members/:handle/stats/history        | Create stats history for a member           |
| PATCH  | /v6/members/:handle/stats/history        | Partially update stats history for a member |
| GET    | /v6/members/:handle/traits               | Get member traits                           |
| POST   | /v6/members/:handle/traits               | Create member traits                        |
| PATCH  | /v6/members/:handle/traits               | Update member traits                        |
| DELETE | /v6/members/:handle/traits               | Remove member traits                        |
| GET    | /v6/members/health                       | Health check endpoint                       |

See `docs/swagger.yaml` for full details and request/response schemas.

---

## Setup Instructions

### 1. Prerequisites
- **Node.js** v18 or later
- **npm** v8 or later
- **Docker** (for PostgreSQL)

### 2. Clone the Repository
```bash
git clone <repo-url>
cd member-api-v6
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the project root (or use `.env.example` if provided). Example:
```env
DATABASE_URL=postgresql://johndoe:mypassword@localhost:5432/memberdb
AUTH0_URL=http://localhost:4000/v5/auth0
AUTH0_AUDIENCE=topcoder-dev
AUTH0_CLIENT_ID=xyz
AUTH0_CLIENT_SECRET=xyz
BUSAPI_URL=http://localhost:4000/v5
GROUPS_API_URL=http://localhost:4000/v5/groups
PORT=3000
# Add any other required variables as needed
```

**Note:**
- For local development, the mock API server will handle Auth0 and event bus endpoints.
- See `config/default.js` for all available configuration options.

### 5. Start PostgreSQL Database (via Docker)
```bash
docker run -d --name memberdb -p 5432:5432 \
  -e POSTGRES_USER=johndoe -e POSTGRES_DB=memberdb \
  -e POSTGRES_PASSWORD=mypassword \
  postgres:16
```

### 6. Initialize and Seed the Database
```bash
npm run init-db
node src/scripts/seed-testdata-api.js
```
- This will apply Prisma migrations and load test data from `test_data_api.json`.

### 7. Start the Mock API Server (for Auth0 and Event Bus)
```bash
node mock/mock-api.js
```
- This must be running for local development and tests to pass.

### 8. Start the API Server
```bash
npm start
```
- The API will be available at [http://localhost:3000/v6/members/health](http://localhost:3000/v6/members/health)

---

## Environment Variables

| Variable                       | Description                                 |
|------------------------------- |---------------------------------------------|
| DATABASE_URL                   | PostgreSQL connection string                |
| AUTH0_URL                      | Auth0 base URL (use mock for local)         |
| AUTH0_AUDIENCE                 | Auth0 audience (for JWT validation)         |
| AUTH0_CLIENT_ID                | Auth0 client ID                             |
| AUTH0_CLIENT_SECRET            | Auth0 client secret                         |
| BUSAPI_URL                     | Event bus API URL (use mock for local)      |
| GROUPS_API_URL                 | Groups API URL (use mock for local)         |
| PORT                           | API server port (default: 3000)             |
| KAFKA_ERROR_TOPIC              | Kafka error topic (if used)                 |
| AMAZON.AWS_ACCESS_KEY_ID       | AWS S3 config (if using photo upload)       |
| AMAZON.AWS_SECRET_ACCESS_KEY   | AWS S3 config                               |
| AMAZON.AWS_REGION              | AWS S3 config                               |
| AMAZON.PHOTO_S3_BUCKET         | AWS S3 config                               |

---

## Running Tests

### 1. Unit and Integration Tests
```bash
npm test
```
- Runs all unit and integration tests in the `test/unit/` directory.
- Requires the database, mock API, and environment variables to be set up as above.

### 2. Test Data
- The script `src/scripts/seed-testdata-api.js` loads comprehensive test data from `test_data_api.json`.
- Ensure the database is seeded before running tests.

### 3. Postman Collection
- Import `docs/Member API.postman_collection.json` into Postman for ready-to-use requests and examples.

---

## API Documentation
- The OpenAPI/Swagger spec is in `docs/swagger.yaml`.
- All endpoints, request/response schemas, and error codes are documented there.

---

## How to Verify the Code

1. **Check API Health:**
   - Visit [http://localhost:3000/v6/members/health](http://localhost:3000/v6/members/health) to verify the server is running.

2. **Run Tests:**
   - Run `npm test` and ensure all tests pass.

3. **Seed and Validate Data:**
   - Use `node src/scripts/seed-testdata-api.js` to load test data.
   - Optionally, use `src/scripts/validate-seeded-data.js` to compare local data with the deployed API.

4. **Use Postman:**
   - Use the provided Postman collection to test all endpoints interactively.

5. **Check API Documentation:**
   - Review `docs/swagger.yaml` for endpoint details and try requests using Swagger UI if set up.

---

## Troubleshooting
- Ensure Docker is running and the `memberdb` container is up.
- Ensure the mock API server (`node mock/mock-api.js`) is running for local Auth0 and event bus endpoints.
- Double-check all environment variables are set (see above).
- If you change the Prisma schema, re-run `npm run init-db` and reseed the database.

---

## Common Errors & Solutions

| Error Message / Symptom                        | Possible Cause & Solution                                                                 |
|------------------------------------------------|------------------------------------------------------------------------------------------|
| `Can't reach database server at localhost:5432`| PostgreSQL is not running. Start Docker container with the provided command.              |
| `Error: "AUTH0_URL" is required`              | Missing environment variable. Set `AUTH0_URL` in your `.env` or export it in your shell.  |
| `connect ECONNREFUSED 127.0.0.1:4000`          | Mock API server is not running. Start it with `node mock/mock-api.js`.                   |
| `ValidationError: ... is not allowed`          | Request contains unexpected fields. Check your payload and match the API schema.          |
| `ValidationError: ... is required`             | Missing required field in request. Check the API docs and provide all required fields.   |
| `Error: Member with handle: "other" doesn't exist` | The member handle does not exist in the database. Seed test data or use a valid handle. |
| `Error: The trait id ... already exists`       | Duplicate trait creation. Use PATCH to update or DELETE to remove before re-adding.       |
| `Error: NotFoundError: ... is not found`       | Resource does not exist. Check your IDs and seed data.                                   |
| `Error: ForbiddenError: You are not allowed ...`| Insufficient permissions. Use a user with the correct roles/scopes.                      |
| `Error: Unexpected error occurred`             | Check logs for stack trace. Ensure all services and dependencies are running.             |

---

For further details or issues, see the project documentation or contact the maintainers.
