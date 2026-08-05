import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Server, Code, HardDrive, Shield } from "lucide-react";

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise System Architecture"
        description="Detailed breakdown of decoupled frontend/backend micro-architecture and design pattern enforcement."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Code className="h-5 w-5 text-primary" />
              <CardTitle>Frontend Layer (Next.js 16+ App Router)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>React Server Components (RSC):</strong> Default rendering mechanism for max Core Web Vitals & initial HTML streaming.</p>
            <p>• <strong>TanStack Query (v5):</strong> Client-side asynchronous state, caching, & refetching strategy.</p>
            <p>• <strong>Tailwind CSS v4 & Glassmorphism:</strong> Design tokens, CSS variables, dark/light theme switching.</p>
            <p>• <strong>Modular Feature Architecture:</strong> Clear separation between components, hooks, services, and types.</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-blue-500" />
              <CardTitle>Backend Layer (FastAPI 0.115+)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Application Factory Pattern:</strong> Centralized lifespan initialization, middleware pipeline, CORS setup.</p>
            <p>• <strong>SQLAlchemy 2.0 Async ORM:</strong> Non-blocking database session management with connection pool configuration.</p>
            <p>• <strong>Repository Pattern:</strong> Decoupled persistence logic from business handlers (`BaseRepository[T]`).</p>
            <p>• <strong>Structured Exception Pipeline:</strong> Global error interceptors returning unified JSON schemas.</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5 text-emerald-500" />
              <CardTitle>Database & Persistence (Turso / libSQL)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Embedded SQLite / Cloud libSQL:</strong> Ultra-fast local execution with cloud sync capability.</p>
            <p>• <strong>Alembic Migrations:</strong> Async database migration scripts and schema versioning engine.</p>
            <p>• <strong>WAL (Write-Ahead Logging):</strong> High concurrency read/write PRAGMA performance tuning.</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-purple-500" />
              <CardTitle>Security & Container Infrastructure</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>JWT Architecture Stubs:</strong> Token generation, verification, and bcrypt hashing structure.</p>
            <p>• <strong>Multi-stage Docker Builds:</strong> Minimal distroless/Alpine production container footprints.</p>
            <p>• <strong>Nginx Reverse Proxy:</strong> `/` routed to frontend, `/api` proxied to backend with HTTP keep-alive.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
