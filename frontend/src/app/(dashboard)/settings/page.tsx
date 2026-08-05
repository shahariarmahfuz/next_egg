import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Sliders, Globe } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configuration parameters and environment variables for frontend and backend applications."
      />

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Sliders className="h-5 w-5 text-primary" />
            <CardTitle>Environment Settings Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="p-4 rounded-xl bg-accent/40 border text-xs space-y-2">
            <div className="text-muted-foreground">// Frontend Public Config</div>
            <div>NEXT_PUBLIC_APP_NAME="Business Management System"</div>
            <div>NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"</div>
          </div>

          <div className="p-4 rounded-xl bg-accent/40 border text-xs space-y-2">
            <div className="text-muted-foreground">// Backend Settings (Pydantic Settings v2)</div>
            <div>APP_ENV="development"</div>
            <div>DATABASE_URL="sqlite+aiosqlite:///./app.db"</div>
            <div>API_V1_STR="/api/v1"</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
