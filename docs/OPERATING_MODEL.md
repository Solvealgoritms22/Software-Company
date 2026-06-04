# Operating Model

## Cuentas

No hace falta una cuenta por agente. La empresa usa una cuenta o token por plataforma y registra el agente responsable en commits, issues, artefactos y logs.

| Plataforma | Identidad recomendada | Atribucion |
| --- | --- | --- |
| GitHub | Cuenta bot gratuita o GitHub App | Autor del commit: `Backend Developer Agent <backend-developer-agent@agents.software-factory.local>` |
| Jira | Cuenta del fundador o cuenta bot en plan free | Descripcion/comentarios con `Creado por <agent>` |
| PGlite local | Volumen Docker local | Campo `agent` en `artifacts`, `phase_runs` y `activity_logs` |
| PostgreSQL/Supabase | Service key del proyecto | Mismo esquema cuando se migre a produccion |
| Vercel/Railway | Token CI/CD de la cuenta empresa | Logs del DevOps Agent y artefactos `staging_url`/`production_url` |
| OpenAI | API key de la cuenta empresa | Artefactos con `provider=openai`, modelo y uso de tokens |
| DeepSeek | API key de la cuenta empresa | Artefactos con `provider=deepseek`, modelo y uso de tokens |
| Penpot | Instancia local o cuenta gratuita | Artefactos visuales asociados a Frontend Architect Agent |

## Reglas de ejecucion

- El CEO Agent solo desbloquea una fase cuando todas sus dependencias estan `completed`.
- El contrato se genera despues del BRD y bloquea el flujo hasta aprobacion humana.
- Las fases listas sin dependencia entre si pueden correr en paralelo.
- Cada entregable se guarda como artefacto real. Los datos mock solo se permiten en tests automatizados, nunca como implementacion funcional final.
- Se priorizan herramientas gratuitas y open source en MVP. La migracion a planes pagos es decision del fundador despues de cerrar con el cliente.
- Los modelos se consumen por API de OpenAI o DeepSeek, definidos por agente en `agents/registry.yaml`.
- La base local usa PGlite para bajar complejidad. Para produccion con varios usuarios o alta concurrencia se migra a Supabase/PostgreSQL completo.
