-- Se retira la funcionalidad de vacaciones: la tabla ya no la usa la aplicación.
-- Los valores del enum protocol_category no se repiten aquí porque ya los
-- agregan las migraciones 0006 y 0007; drizzle-kit los regeneró solo porque
-- aquellas se escribieron a mano y no dejaron snapshot.
DROP TABLE IF EXISTS "vacations" CASCADE;
