# TurnApp Lota

Aplicación privada del equipo de Urgencia de Lota para consultar turnos médicos y
administrar reemplazos.

## Estado

- Calendario público mensual con turnos de día y noche.
- Historial importado desde enero de 2024.
- Tabla y lista de puntajes con vencimiento a 120 días.
- Nómina dinámica que conserva médicos históricos inactivos.
- Gestor protegido para editar por arrastre o autocompletado.
- Exportación del calendario como imagen y PDF.
- Persistencia preparada para Neon PostgreSQL.

La aplicación todavía no está desplegada ni conectada a Vercel.

## Desarrollo local

Requiere Node.js 20.9 o superior y pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Sin `DATABASE_URL`, las vistas públicas usan el snapshot importado de solo lectura.
Para habilitar escrituras:

1. Crea una base PostgreSQL/Neon.
2. Define `DATABASE_URL` en `.env.local`.
3. Genera un hash para la clave de Jefatura:

   ```bash
   pnpm tsx scripts/hash-password.ts "TU_CLAVE"
   ```

4. Guarda el resultado como `JEFE_PASSWORD_HASH` y define un
   `SESSION_SECRET` aleatorio de al menos 32 caracteres.
5. Ejecuta:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

No se deben publicar claves ni archivos `.env`.

## Validación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Los datos iniciales incluyen 33 meses, 4.791 asignaciones, 330 reemplazos y 45
médicos únicos. Los nombres que no figuran en la nómina más reciente permanecen
inactivos para conservar el historial.
