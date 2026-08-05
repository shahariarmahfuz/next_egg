"use client";

import Link from "next/link";
import { User, LogOut, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";

export function UserNav() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Button asChild variant="default" size="sm">
        <Link href="/login">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 p-0 flex items-center justify-center font-bold text-primary text-sm"
        >
          {user.full_name?.charAt(0).toUpperCase() || "U"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
            {user.role && (
              <span className="inline-block w-fit mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                {user.role.name}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/users" className="flex items-center cursor-pointer">
            <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            User Profiles
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/roles" className="flex items-center cursor-pointer">
            <KeyRound className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            Role Permissions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
