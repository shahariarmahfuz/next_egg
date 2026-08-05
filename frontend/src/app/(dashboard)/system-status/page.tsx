import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, Wifi } from "lucide-react";

export default function SystemStatusPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Status & Telemetry"
        description="Real-time status indicators and network health for frontend and backend microservices."
      />

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            <CardTitle>Core Service Readiness Matrix</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/40 border">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <div className="font-semibold text-sm">Next.js Web Application</div>
                  <div className="text-xs text-muted-foreground">HTTP Port 3000 • SSR / RSC Enabled</div>
                </div>
              </div>
              <span className="text-xs text-emerald-500 font-semibold">OPERATIONAL</span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/40 border">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <div className="font-semibold text-sm">FastAPI REST Server</div>
                  <div className="text-xs text-muted-foreground">HTTP Port 8000 • Uvicorn Async Lifespan</div>
                </div>
              </div>
              <span className="text-xs text-emerald-500 font-semibold">OPERATIONAL</span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/40 border">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <div className="font-semibold text-sm">Turso / libSQL Database Connection</div>
                  <div className="text-xs text-muted-foreground">SQLite WAL Mode • SQLAlchemy Async Engine</div>
                </div>
              </div>
              <span className="text-xs text-emerald-500 font-semibold">OPERATIONAL</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
