# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS frontend
WORKDIR /frontend
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm run build

FROM --platform=$BUILDPLATFORM golang:1.24.13-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS backend
WORKDIR /app
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
# Swagger sources are gitignored but imported by the API: generate them here.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go install github.com/swaggo/swag/cmd/swag@v1.16.6
COPY . .
COPY --from=frontend /frontend/dist ./internal/http/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    /go/bin/swag init --generalInfo cmd/lite/lite.go --parseDependency --parseInternal --output docs
ARG TARGETOS
ARG TARGETARCH
ARG LITE_VERSION=dev
# Keep /app source paths: ClickHouse migration discovery uses runtime.Caller.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -mod=readonly -buildvcs=false \
    -ldflags="-s -w -X main.Version=${LITE_VERSION}" -o /out/lite ./cmd/lite

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
WORKDIR /app
COPY --from=backend /out/lite /app/lite
COPY --from=backend /app/internal/clickhouse/migrations /app/internal/clickhouse/migrations
ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/lite"]
