"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-foreground select-none">
      {/* Directly on page background - no card, no border, no container background */}
      <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center animate-in fade-in-50 slide-in-from-bottom-3 duration-300">
        {/* Minimal icon */}
        <FileQuestion className="h-10 w-10 sm:h-11 sm:w-11 text-primary stroke-[1.6] mb-3" />

        {/* 404 Number as Main Visual Focus */}
        <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tight text-foreground leading-none font-sans select-none">
          4<span className="text-primary font-black">0</span>4
        </div>

        {/* Main Heading */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-4 sm:mt-5">
          Page Not Found
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <p className="text-xs sm:text-sm text-muted-foreground/80 mt-1.5">
          Please check the URL or return to your dashboard.
        </p>

        {/* Actions: Minimal Ghost "Go Back" + Primary "Return to Dashboard" */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 w-full sm:w-auto mt-8">
          <Button
            type="button"
            variant="ghost"
            onClick={handleGoBack}
            className="w-full sm:w-auto h-10 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>

          <Button
            asChild
            variant="default"
            className="w-full sm:w-auto h-10 px-5 text-sm font-medium shadow-sm transition-colors"
          >
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
