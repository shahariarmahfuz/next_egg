import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Key, Lock, FileCode } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & JWT Architecture"
        description="Security framework configuration and authentication foundation setup."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-amber-500" />
              <CardTitle>JWT Token Management Structure</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Algorithm:</strong> HS256 HMAC-SHA256 signature verification.</p>
            <p>• <strong>Expiration:</strong> Access tokens (24 hrs) & Refresh tokens (7 days).</p>
            <p>• <strong>Payload:</strong> Subject claim (sub), expiry (exp), issued at (iat), and type claims.</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Lock className="h-5 w-5 text-purple-500" />
              <CardTitle>Password Hashing & CORS Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Bcrypt Cryptographic Hashing:</strong> Automated salt generation and verification.</p>
            <p>• <strong>Strict CORS Middleware:</strong> Explicit domain origin allowlists configured in settings.</p>
            <p>• <strong>Headers:</strong> X-Content-Type-Options, X-Frame-Options, X-XSS-Protection enabled.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
