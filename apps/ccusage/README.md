<div align="center">
    <h1>🛡️ Token Guard</h1>
    <h3>FinOps Dashboard para Claude Code</h3>
    <p><strong>Controlá tus tokens. Reducí costos. Tomá decisiones con datos.</strong></p>
</div>

<p align="center">
    <img src="https://img.shields.io/badge/100%25-Offline-success?style=for-the-badge&logo=shield" alt="100% Offline" />
    <img src="https://img.shields.io/badge/Sin_Telemetr%C3%ADa-🔒-blueviolet?style=for-the-badge" alt="Sin Telemetría" />
    <img src="https://img.shields.io/badge/macOS-compatible-blue?style=for-the-badge&logo=apple" alt="macOS" />
    <img src="https://img.shields.io/badge/ES_🇦🇷_|_PT_🇧🇷-Bilingüe-orange?style=for-the-badge" alt="Bilingüe" />
</p>

---

## 🚀 ¿Qué es Token Guard?

**Token Guard** es un dashboard visual que analiza el consumo de tokens de Claude Code directamente desde tus archivos locales JSONL. Te da visibilidad total sobre cuánto estás gastando, en qué proyectos, con qué modelos, y te enseña cómo reducir costos.

### ¿Por qué lo necesitás?

|             Sin Token Guard              |                  Con Token Guard                  |
| :--------------------------------------: | :-----------------------------------------------: |
|       🤷 "¿Cuánto gasté este mes?"       |       📊 Dashboard con KPIs en tiempo real        |
|  😰 "Opus está caro pero no sé cuánto"   |       💡 Desglose por modelo con % de costo       |
| 🔥 "Me pasé del budget sin darme cuenta" |       🔔 Alertas automáticas por threshold        |
|   📁 "¿Qué proyecto quema más tokens?"   |        📂 Ranking de proyectos por consumo        |
|       ❓ "¿Cómo bajo los costos?"        | 🎓 Tutoriales interactivos con comandos copiables |

---

## ⚡ Inicio Rápido (Vía NPX)

Como **Token Guard** es una herramienta de uso interno, se distribuye de forma privada y segura a través de GitHub Packages.

> **⚠️ Requisito previo:** Asegurate de tener **Node.js (v18 o superior)** instalado en tu Mac. Podés comprobarlo corriendo `node -v` en tu terminal.

### 1. Autenticación (Solo la primera vez)

Para poder descargar el paquete, necesitás estar autenticado en el NPM Registry de GitHub. Ejecutá este comando e iniciá sesión con tu usuario de GitHub:

```bash
npm login --registry=https://npm.pkg.github.com
```

> **🔑 Importante sobre la contraseña:**
> Cuando la terminal te pida el "Password", **NO uses tu contraseña normal de GitHub**. Tenés que usar un **Personal Access Token (PAT)**.
> Para crearlo, andá a GitHub: `Settings` > `Developer settings` > `Personal access tokens` > `Tokens (classic)` > `Generate new token (classic)`. Dale un nombre y asegurate de tildar la cajita de **`read:packages`**.

### 2. Ejecución (Día a día)

Una vez autenticado, solo necesitás correr un comando en cualquier terminal. El dashboard se descargará (si hay actualizaciones) y se abrirá automáticamente en tu navegador:

```bash
npx @ripio/token-guard
```

> **Nota:** Al usar `npx` garantizamos que **siempre** estés corriendo la versión más reciente con las métricas y precios de la API de Anthropic actualizados.

El dashboard se abre automáticamente en `http://localhost:3000`. **No requiere internet.**

---

## 🖥️ Funcionalidades

### 📊 Overview — Vista General

Panel principal con 6 KPIs interactivos:

- **Costo Total** — Gasto acumulado con desglose por modelo
- **Costo Hoy** — Consumo del día actual
- **Gasto del Mes** — Progreso vs. límite mensual configurado
- **Proyección Mensual** — Estimación del gasto a fin de mes
- **Proyecto Top** — El proyecto que más tokens consume
- **Tamaño de Logs** — Peso de los archivos `~/.claude/projects/`

Incluye gráficos de barras (costo diario 30d), donut (costo por modelo), y barras apiladas (tokens por tipo).

### 📅 Reportes

| Reporte               | Descripción                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------- |
| **Diario**            | Tokens y costos agregados por fecha con filtros                                             |
| **Mensual**           | Vista consolidada por mes                                                                   |
| **Proyectos**         | Consumo agrupado por directorio de proyecto                                                 |
| **Sesiones**          | Top 50 sesiones con títulos generados por IA, rama de Git, directorio y uso de herramientas |
| **Modelos**           | Desglose completo por modelo Claude                                                         |
| **Origen de Consumo** | Análisis explicativo de tokens por tipo (Input, Output, Cache) y fuentes de gasto           |

### 🕵️‍♂️ Análisis Forense de Sesiones

A diferencia de un tracker común, Token Guard extrae contexto avanzado directamente de los logs ocultos de Claude:

- **Títulos por IA (`aiTitle`)**: Reemplaza IDs ilegibles por títulos descriptivos generados por el propio Claude para cada tarea.
- **Rastreo de Herramientas**: Muestra exactamente cuántas veces Claude usó comandos internos (`Bash`, `Glob`, `Edit`, `MCP`). Ideal para detectar agentes atascados en loops caros.
- **Contexto de Desarrollo**: Extrae la rama de Git (`gitBranch`), el subdirectorio exacto (`cwd`) y el entorno (`CLI` vs `VS Code`).
- **Detección de Errores**: Marca sesiones donde hubo alertas de límite de tokens o fallos de API.

### 📥 Exportación a HTML (Reporte para Compartir)

Con un solo clic en la barra superior, podés exportar el dashboard entero a un archivo **HTML estático e interactivo**.

- Funciona 100% offline (CSS, gráficas e imágenes están embedidas en base64).
- Ideal para compartir un "snapshot" de los gastos con tu equipo o management a través de Slack o Email.

### 🔔 Alertas & Límites

- Configuración de **límite mensual** en USD
- **Alertas amarillo/rojo** por porcentaje de consumo
- **Notificaciones nativas macOS** cuando se alcanza el threshold
- **Slack Webhook** opcional para alertas en canales
- **FSEvents Watcher** — Monitoreo en tiempo real de nuevos logs

### 📈 Gestión de Tokens

- Media diaria de gasto
- Día más caro
- Tendencia con promedio móvil de 7 días
- Distribución Input vs Output vs Cache
- Ranking de proyectos por costo

### 🧠 Resumen Inteligente

Análisis automatizado con recomendaciones accionables:

- **Diagnóstico de costos** — Identifica concentración en modelos caros
- **Tutorial: Estrategias para no quemar tokens** — `/clear`, `/compact`, `.claudeignore`
- **Tutorial: Optimización de CLAUDE.md** — Snippet copiable para forzar economía de tokens
- **Puntos de atención** — Alertas sobre tendencias peligrosas

Todos los comandos de terminal aparecen en bloques oscuros con **botón de copiar** integrado.

---

## 🌍 Bilingüe

Token Guard soporta **Español (Argentina)** 🇦🇷 y **Portugués (Brasil)** 🇧🇷 con un toggle tipo pill en la barra de navegación. El idioma se persiste en `localStorage`.

Las instrucciones del `CLAUDE.md` se mantienen en **inglés** en ambos idiomas (requisito del agente).

---

## 🏗️ Arquitectura

```
Token Guard
├── apps/dashboard/       ← Dashboard web (Hono + Vanilla JS)
│   ├── src/
│   │   ├── server.ts     ← API REST + FSEvents Watcher + SSE
│   │   ├── index.ts      ← Entry point del servidor
│   │   └── public/       ← Frontend (HTML + CSS + JS)
│   │       ├── index.html
│   │       ├── styles.css
│   │       ├── i18n.js   ← Internacionalización ES/PT
│   │       ├── core.js   ← Utilidades, navegación, cache
│   │       └── app.js    ← Lógica de cada página
├── apps/ccusage/         ← Motor CLI (fork de ccusage)
└── apps/mcp/             ← Servidor MCP
```

### Stack Técnico

| Componente | Tecnología                           |
| ---------- | ------------------------------------ |
| Backend    | [Hono](https://hono.dev/) (API REST) |
| Frontend   | Vanilla JS + CSS                     |
| Gráficos   | Chart.js 4                           |
| Iconos     | Lucide                               |
| Watcher    | FSEvents (macOS nativo)              |
| Transporte | SSE (Server-Sent Events)             |
| Datos      | JSONL locales de Claude Code         |

### Flujo de Datos

```
~/.claude/projects/*.jsonl
         │
    FSEvents detecta cambio
         │
    Server recalcula costos
         │
    SSE push al browser ──→ Toast "Costo actualizado: $X.XX"
         │
    Dashboard se actualiza automáticamente
```

---

## 🔒 Privacidad & Seguridad

- ✅ **100% Offline** — Cero llamadas a APIs externas
- ✅ **Sin telemetría** — No se envían datos a ningún servidor
- ✅ **Datos locales** — Solo lee `~/.claude/projects/` (logs que Claude ya genera)
- ✅ **Read-only** — Token Guard nunca escribe ni modifica tus logs
- ✅ **Sin credenciales** — No requiere API keys ni autenticación

---

## 🛠️ Configuración

### Variables de Entorno

| Variable            | Descripción                      | Default                      |
| ------------------- | -------------------------------- | ---------------------------- |
| `CLAUDE_CONFIG_DIR` | Directorio(s) de datos de Claude | `~/.claude,~/.config/claude` |
| `LOG_LEVEL`         | Nivel de logs (0-5)              | `2`                          |
| `PORT`              | Puerto del dashboard             | `3000`                       |

### Thresholds (desde el dashboard)

Los límites de gasto se configuran directamente desde la pestaña **"Alertas y Límites"** en el dashboard. Se persisten en un archivo local `.token-guard-config.json`.

---

## 📋 Requisitos

- **Node.js** ≥ 18
- **pnpm** (gestor de paquetes)
- **macOS** (para FSEvents watcher — el dashboard funciona en cualquier OS pero las notificaciones nativas son macOS)
- **Claude Code** instalado (genera los logs en `~/.claude/projects/`)

---

## 🤝 Créditos

Token Guard está construido sobre [ccusage](https://github.com/ryoppippi/ccusage) por [@ryoppippi](https://github.com/ryoppippi), extendido con un dashboard visual, sistema de alertas, watcher en tiempo real, y tutoriales interactivos.

## 📄 Licencia

[MIT](LICENSE)
