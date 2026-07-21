# Deployment

## Local / single server
```bash
cp .env.example .env   # set real secrets
docker compose up --build -d
```
Compose runs Postgres, Redis, the API (with `prisma migrate deploy` on boot) and the web app.
Put NGINX or Caddy in front for TLS; a sample vhost is in `infra/nginx/`.

## Production checklist
- [ ] Rotate `JWT_*` secrets; store in a secret manager (SSM/Vault), not `.env`.
- [ ] Managed Postgres (RDS / Cloud SQL) with automated backups + PITR.
- [ ] Managed Redis (Elasticache / Upstash).
- [ ] S3/R2 bucket + CDN for uploads.
- [ ] Wildcard DNS `*.educore.in` → load balancer (subdomain-per-tenant).
- [ ] Health checks: API `GET /api/v1/auth/me` (401 = alive), web `GET /`.
- [ ] Log shipping (Loki/CloudWatch) and metrics (Prometheus + Grafana).

## Kubernetes
The images built by `apps/*/Dockerfile` are stateless and 12-factor:
Deployment (3+ replicas) + HPA for `api` and `web`, one-off Job for migrations,
Ingress with wildcard TLS cert (cert-manager), external Postgres/Redis.
CI (`.github/workflows/ci.yml`) already builds both images on `main`;
add a push step to your registry (ECR/GHCR) and an Argo CD / Flux sync to complete CD.
