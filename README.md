# Orkestrix Systems

Orkestrix is a React/Vite public site with an admin API. Production runs on Vercel with Supabase PostgreSQL and Supabase Storage.

## Local development

Use Node.js 22 and Corepack:

```powershell
corepack enable
corepack pnpm install
corepack pnpm dev
```

Copy the required variables from `.env.example` into `.env`. The production API requires `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

```powershell
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
```

## Documentation

- [Deployment guide](DEPLOYMENT.md)
- [Documentation index](docs/README.md)
- [Supabase schema](supabase/migrations/20260826000001_init_schema.sql)
