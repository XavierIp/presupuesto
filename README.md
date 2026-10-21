# Presupuesto

App de finanzas personales multiusuario: presupuestos mensuales, ingresos y gastos, tarjetas de débito y crédito, préstamos entre usuarios y ahorro individual o en grupo.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Turbopack) |
| Estilos | Tailwind CSS v4 con los tokens de `design-system/presupuesto/MASTER.md` |
| Base de datos | Prisma Postgres en Vercel (PresupuestoDB), driver `pg` |
| ORM y migraciones | Drizzle ORM + drizzle-kit |
| Autenticación | Better Auth (correo y contraseña) |
| Despliegue | Vercel |

## Estructura

```
src/
  app/
    (auth)/login, (auth)/registro   Inicio de sesión y registro
    (app)/dashboard                 Resumen del mes (datos reales de la BD)
    (app)/movimientos … /ahorro     Secciones (interfaz pendiente, tablas listas)
    api/auth/[...all]               Endpoints de Better Auth
  components/                       UI compartida (botones, campos, navegación)
  lib/
    db/schema.ts                    Esquema completo (montos en centavos)
    auth.ts / auth-client.ts        Better Auth en servidor y cliente
    session.ts                      getCurrentUser(): único punto para leer la sesión
    data/                           Consultas por pantalla (siempre filtradas por usuario)
    money.ts                        formatMoney / parseMoney
  proxy.ts                          Redirección optimista según la cookie de sesión
drizzle/                            Migraciones SQL generadas
design-system/                      Sistema de diseño (estilo, paleta, fuentes, animación)
```

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa DATABASE_URL y BETTER_AUTH_SECRET
npm run db:migrate           # crea las tablas
npm run dev
```

Scripts de base de datos:

- `npm run db:generate`: genera una nueva migración después de cambiar `schema.ts`.
- `npm run db:migrate`: aplica las migraciones pendientes.
- `npm run db:studio`: abre un explorador visual de la base.

## Despliegue en Vercel

1. **Iniciar sesión y vincular el proyecto**
   ```bash
   npx vercel login
   npx vercel link
   ```
2. **Crear la base de datos.** En el panel de Vercel, entra al proyecto → **Storage** → **Create Database** → **Neon (Postgres)** → conéctala al proyecto. Vercel agrega `DATABASE_URL` automáticamente.
3. **Agregar el secreto de sesiones** (uno distinto por entorno):
   ```bash
   npx vercel env add BETTER_AUTH_SECRET production
   npx vercel env add BETTER_AUTH_SECRET preview
   ```
   Genera el valor con `npx @better-auth/cli secret`. `BETTER_AUTH_URL` no hace falta en Vercel: se usa la URL de producción y se confía en las URLs de preview.
4. **Aplicar las migraciones** a la base de Vercel:
   ```bash
   npx vercel env pull .env.local
   npm run db:migrate
   ```
5. **Desplegar**
   ```bash
   npx vercel deploy --prod
   ```
   Si conectas el repositorio de GitHub al proyecto, cada push a `main` despliega a producción.

## Notas de diseño

- Los montos se guardan como enteros en **centavos** y se muestran con `formatMoney` (`Intl.NumberFormat`).
- Solo se guardan los **últimos 4 dígitos** de las tarjetas.
- Las consultas resuelven al usuario dentro de la función (`getCurrentUser()`), nunca reciben un `userId` desde el cliente.
- Al registrarse, cada usuario recibe categorías de ingreso y gasto por defecto.
