# System Architecture Documentation

## Overview

The **Business Management System** foundation is built using a strict **Decoupled System Architecture** separating the Next.js 16+ frontend and Python 3.12+ FastAPI backend. Communication occurs exclusively over REST APIs payload-wrapped in standardized JSON contracts.

```
+-------------------------------------------------------------------------+
|                               Nginx Reverse Proxy                        |
|                                     (Port 80)                           |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v /                                                 v /api
+---------------------------+                       +---------------------------+
|    Frontend Service       |                       |     Backend Service       |
|  (Next.js 16+ App Router) |                       |     (FastAPI 0.115+)      |
|    Port 3000              |                       |     Port 8000             |
+---------------------------+                       +---------------------------+
          |                                                   |
          v Client / Server Fetch                             v SQLAlchemy 2.0 Async
+---------------------------+                       +---------------------------+
|   TanStack Query / RSC    |                       |      Turso / libSQL       |
+---------------------------+                       +---------------------------+
```

## Core Principles

1. **SOLID Design**: Each class, service, and component adheres to Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.
2. **Clean Architecture**: Clear isolation between HTTP endpoints, Domain Logic, Repository Data Access, and Database Session Management.
3. **React Server Components First**: Next.js pages leverage RSC streaming and static rendering by default. Client components (`"use client"`) are strictly scoped to interactive UI widgets.
4. **Unified API Envelopes**: Standardized Pydantic v2 schemas:
   - Success: `ResponseModel[T]`
   - Pagination: `PaginatedResponse[T]`
   - Errors: `ErrorResponseModel`

## Frontend Architecture (`frontend/`)

```
src/
├── app/                  # Next.js 16+ App Router (Layouts, RSC pages, error boundaries)
├── components/
│   ├── ui/              # Primitive UI components (Button, Card, Badge, Input, Skeleton, etc.)
│   ├── layout/          # Application shell (Sidebar, Header, MobileNav, ThemeToggle, UserNav)
│   └── common/          # Cross-cutting UI (LoadingSpinner, PageHeader, ErrorBoundary)
├── features/            # Feature-based module architecture containers
├── hooks/               # Custom hooks (useIsMobile, useDebounce, useTheme)
├── lib/                 # Base infrastructure (apiClient, queryClient, env)
├── providers/           # App providers (QueryProvider, ThemeProvider)
├── services/            # REST API service wrappers
├── styles/              # Global CSS & design system tokens
├── types/               # TypeScript interfaces & API contracts
└── utils/               # Formatting & validation helpers
```

## Backend Architecture (`backend/`)

```
app/
├── api/                 # Versioned router mounts (/api/v1)
│   └── v1/
│       ├── router.py    # Master router assembly
│       └── endpoints/   # Endpoint controllers (health, system)
├── core/                # System configuration & logging setup
│   ├── config.py        # Pydantic Settings v2
│   ├── logging.py       # JSON/Console logging setup
│   └── security.py      # JWT & Bcrypt password hashing utilities
├── db/                  # Database connectivity & session factory
│   ├── base.py          # Declarative Base & TimestampedBaseModel
│   └── session.py       # SQLAlchemy 2.0 Async Engine & SQLite WAL mode
├── dependencies/        # FastAPI Dependency Injections (db, auth)
├── exceptions/          # Custom exceptions & global exception handlers
├── models/              # SQLAlchemy declarative models
├── repositories/        # Generic Async BaseRepository pattern
├── schemas/             # Pydantic v2 schemas & envelopes
├── services/            # Base Service business logic abstractions
└── utils/               # Core utility helpers
```
