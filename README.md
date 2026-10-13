# Fivemanage Lite

Fivemanage Lite is an open-source, lightweight management service designed for gaming communities. It provides essential features for file storage, structured logging, and community organization.

<kbd>
<img width="1790" height="1001" style="border-radius: 15px;" alt="Screenshot 2026-01-18 at 01 43 59" src="https://github.com/user-attachments/assets/6cef883d-3961-495f-b5f6-e3204aac6664" />
</kbd>


## Quick Start

Run the latest version of Fivemanage Lite using Docker:

```bash
docker run -p 8080:8080 \
  -e DSN=postgres://user:pass@host:5432/db \
  -e ADMIN_PASSWORD=your_secure_password \
  -e API_TOKEN_HMAC_SECRET=your_32_byte_secret \
  ghcr.io/fivemanage/lite:0.1.0-beta.18
```

---

## Features

- Multi-tenant organization support.
- File storage with S3-compatible providers (AWS S3, Cloudflare R2, MinIO).
- High-performance structured logging powered by ClickHouse.
- Built-in authentication and session management.
- OpenTelemetry integration for tracing.
- Modern React-based administrative dashboard.
- Organization settings: rename or permanently delete a workspace.
- Team management: provision users, grant existing users access, change roles, and remove access.
- Complete dataset deletion with confirmation and tenant-isolated data cleanup.

### Organization administration

In **Settings**, organization administrators can rename the workspace or delete it after typing its exact name. Deletion removes its datasets, logs/traces, stored S3 objects, API tokens, and memberships; user accounts and other organizations are preserved.

In **Team**, administrators can create real username/password accounts or grant access to an existing username. New accounts require a name, email, and a password of 12–72 bytes. No invitation email is sent: share credentials securely. `ADMIN` manages settings, membership, and destructive dataset operations; `MEMBER` can use files, logs, and API tokens. The last administrator cannot be removed or demoted, including by concurrent requests.

Only instance administrators who also administer the organization can use **Change password** on a non-administrator member in Team. Organization `ADMIN` alone does not authorize changing global account credentials. Enter and confirm a new password of 12–72 UTF-8 bytes. The change applies to the account across all organizations and revokes existing login sessions; API tokens are unchanged. Instance administrators and users holding `ADMIN` in any organization are protected by the API. External-provider accounts must manage their credentials with that provider. The dialog closes and clears both password fields after success; failures leave it open.

Removing a member revokes their organization access and tokens immediately, including cached tokens. Legacy tokens without a creator (`user_id=0`) remain organization-owned and must be revoked separately.

Use **Delete dataset** in the dataset list or log toolbar to remove all stored dataset data. Organization-wide API tokens remain valid for other datasets. Ingestion into a deleted dataset returns 404 until a dataset with that name is created again; deleting `default` also stops ingestion that omits the dataset header.

Destructive cleanup requires ClickHouse to be available and, for organizations with files, working S3 deletion permissions. PostgreSQL and external storage cannot commit atomically: a failed cleanup retains relational metadata for retry, but already removed external data cannot be restored. Back up/export data before deletion. Application writes coordinate with deletion; direct external database writers must be stopped separately.

Successful actions refresh the displayed data and close their dialog/sheet or navigate away from the creation page. Failed actions keep the form available and show an error. Token creation intentionally keeps the one-time secret visible until you acknowledge that it has been copied.

### Confirmed log ingestion

Successful `POST /api/logs` requests return HTTP 200 with `X-Fivemanage-Ingest: clickhouse-sync-v1` only after synchronous ClickHouse insertion and the surrounding PostgreSQL transaction complete. Missing datasets return 404; storage failures return 503 without a confirmation header. Clients must retain unconfirmed events. A lost response can still cause duplicate delivery: this is not exactly-once ingestion or a cross-database atomic transaction.

---

## Hosting Options

### Docker Compose
For production environments, using Docker Compose is the most straightforward method to manage the application along with its dependencies (PostgreSQL and ClickHouse). You can find a template in the `deployments/docker-compose.yml` file.

### Kubernetes
Fivemanage Lite is stateless and can be easily deployed on Kubernetes. It is recommended to use a standard Deployment for the application and managed services for the database and storage. Ensure you configure the required environment variables via Secrets or ConfigMaps.

### Automatic builds and Dokploy

The **Publish Docker image** GitHub Actions workflow runs on pushes to the repository's default branch, or manually on that branch. It builds `linux/amd64` and `linux/arm64` and publishes to GHCR using the repository's `GITHUB_TOKEN`:

- `ghcr.io/<lowercase-owner>/<lowercase-repository>:latest`
- `ghcr.io/<lowercase-owner>/<lowercase-repository>:sha-<full-commit-sha>`

For this fork, the image is `ghcr.io/raphaelbarreiros/fivemanage-lite:latest`, available after the first successful workflow run. Enable Actions for the fork; existing GHCR packages may need this repository added to their Actions access. Use the commit tag for versioned deployments or the published digest for an immutable deployment.

**Option 1 — Dokploy builds from Git**

1. Select this repository and its default branch.
2. Select the Dockerfile build type, path `Dockerfile`, context `.`.
3. Set the container port to `8080` and enable automatic deployments through Dokploy's Git integration/webhook.
4. Configure runtime environment variables and an HTTPS domain. An optional `LITE_VERSION` build argument sets the displayed version.

**Option 2 — Dokploy pulls the published image**

1. Select a Docker image deployment and use the GHCR image above, preferably with a commit tag or digest.
2. For a private package, configure GitHub registry credentials in Dokploy: GitHub username and a token with `read:packages` (including organization SSO authorization if required). Public packages support anonymous pulls.
3. After the image is published, pull/redeploy in Dokploy or configure a Dokploy deployment trigger. Publishing `latest` alone does **not** redeploy a running service.

For either option, set `ENV=production`, `PORT=8080`, `DSN`, `ADMIN_PASSWORD`, `API_TOKEN_HMAC_SECRET`, the `CLICKHOUSE_*` connection variables, and the `S3_PROVIDER`/`AWS_*` storage variables. Set `BUCKET_DOMAIN` to the public file URL. Use reachable private service hostnames, not container `localhost`; store secrets in Dokploy's runtime configuration, never build arguments.

Migrations run at application startup. Start with one replica and maintain database backups. The application container needs no persistent volume; PostgreSQL, ClickHouse, and object storage do.

To build locally from a clean checkout:

```bash
docker build --build-arg LITE_VERSION=local -t fivemanage-lite:local .
```

The Dockerfile builds and embeds the frontend, generates Swagger sources, and produces a non-root runtime image.

---

## Configuration

The application is configured via environment variables.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the server listens on | `8080` |
| `DSN` | PostgreSQL connection string | - |
| `ADMIN_PASSWORD` | Initial password for the 'admin' user | `password` |
| `API_TOKEN_HMAC_SECRET` | 32-byte secret for signing API tokens | - |
| `S3_PROVIDER` | S3 provider (`s3`, `r2`, or `minio`) | `minio` |
| `AWS_ACCESS_KEY_ID` | S3 access key ID | - |
| `AWS_SECRET_ACCESS_KEY` | S3 secret access key | - |
| `AWS_ENDPOINT` | S3 endpoint URL | - |
| `AWS_BUCKET` | S3 bucket name | - |
| `AWS_REGION` | S3 region | - |
| `CLICKHOUSE_HOST` | ClickHouse host address | `localhost:19000` |
| `CLICKHOUSE_USERNAME` | ClickHouse username | `default` |
| `CLICKHOUSE_PASSWORD` | ClickHouse password | `password` |
| `CLICKHOUSE_DATABASE` | ClickHouse database name | `default` |
| `ENV` | Environment mode (`production` or `dev`) | `dev` |

---

## Initial Login

Once the application is running, access the dashboard at `http://localhost:8080`.

- **Username:** `admin`
- **Password:** The value of your `ADMIN_PASSWORD` environment variable.

---

## Development & Contribution

Follow these instructions if you want to contribute to the project or build from source.

### Prerequisites

- **Go**: 1.24 or later
- **Node.js**: 22.x or later
- **pnpm**: 10.13.1 (pinned in `web/package.json`)
- **Air**: For backend hot-reloading
- **Docker**: For running local infrastructure

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/fivemanage/fivemanage-lite.git
   cd fivemanage-lite
   ```

2. **Install Frontend Dependencies:**
   ```bash
   cd web
   pnpm install
   cd ..
   ```

3. **Download Backend Dependencies:**
   ```bash
   go mod download
   ```

   Generate the ignored API artifacts and embedded frontend before compiling locally:
   ```bash
   go run github.com/swaggo/swag/cmd/swag@v1.16.6 init --generalInfo cmd/lite/lite.go --parseDependency --parseInternal --output docs
   pnpm --dir web generate:api
   pnpm --dir web exec vite build --outDir ../internal/http/dist
   ```

   Regenerate API types after changing handlers or request/response schemas. Check frontend types with `pnpm --dir web exec tsc -b`.

4. **Start Development Infrastructure:**
   ```bash
   docker compose -f deployments/docker-compose.yml up -d
   ```

### Running for Development

Run the backend and frontend in separate terminals.

1. **Backend:**
   ```bash
   air
   ```

2. **Frontend:**
   ```bash
   cd web
   pnpm dev
   ```

---

## Contributing

1. **Branching:** Use descriptive branch names (`feature/*`, `fix/*`).
2. **Formatting:** Use `go fmt` and `pnpm lint`.
3. **Commits:** Provide clear, professional messages.
4. **Pull Requests:** Provide a detailed description of changes.

## Project Structure

- `cmd/lite`: Main entry point and CLI configuration.
- `internal/`: Application logic, API handlers, and services.
- `pkg/`: Reusable packages for storage, logging, and caching.
- `web/`: Frontend React application.
- `deployments/`: Docker Compose and deployment configurations.
- `migrate/`: PostgreSQL schema migrations.
- `Dockerfile`: Multi-stage frontend/backend build and non-root runtime image.
- `.github/workflows/docker.yml`: Automatic multi-architecture GHCR publishing.

## License

Fivemanage Lite is distributed under [FSL-1.1-ALv2](LICENSE.md), which permits internal use and provides an Apache-2.0 future license on the applicable second anniversary. The adapter integration does not change these terms.
