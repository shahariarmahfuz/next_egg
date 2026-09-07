'use client';

import React from "react";
import { X, Calendar, Layers, MapPin, Sprout, FileText } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FarmDailyEntryItem } from "@/types";

interface FarmViewEntryModalProps {
  entry: FarmDailyEntryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FarmViewEntryModal({
  entry,
  isOpen,
  onClose,
}: FarmViewEntryModalProps) {
  if (!isOpen || !entry) return null;

  const net = entry.production_trays - entry.total_delivery_trays;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Sprout className="h-5 w-5" />
            <DialogTitle className="text-base font-bold text-foreground">
              Farm Transaction Details
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {entry.date ? format(new Date(entry.date), "dd MMMM yyyy") : "N/A"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Farm Header */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                Farm Location
              </span>
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5 mt-0.5">
                <Sprout className="h-4 w-4 text-emerald-600" />
                {entry.farm_name || "Farm"}
              </span>
            </div>
            {entry.farm_code && (
              <Badge variant="outline" className="font-mono text-xs">
                {entry.farm_code}
              </Badge>
            )}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
              <span className="text-[10px] text-muted-foreground uppercase block">Production</span>
              <span className="text-base font-bold text-emerald-600 font-mono">
                +{entry.production_trays}
              </span>
              <span className="text-[10px] text-muted-foreground block">trays</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
              <span className="text-[10px] text-muted-foreground uppercase block">Delivered</span>
              <span className="text-base font-bold text-blue-600 font-mono">
                -{entry.total_delivery_trays}
              </span>
              <span className="text-[10px] text-muted-foreground block">trays</span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-center">
              <span className="text-[10px] text-muted-foreground uppercase block">Net Change</span>
              <span
                className={`text-base font-bold font-mono ${
                  net > 0 ? "text-emerald-600" : net < 0 ? "text-rose-600" : "text-muted-foreground"
                }`}
              >
                {net > 0 ? `+${net}` : net}
              </span>
              <span className="text-[10px] text-muted-foreground block">trays</span>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              Delivery Destinations ({entry.deliveries.length})
            </span>
            {entry.deliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">No deliveries for this date.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {entry.deliveries.map((deliv, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-muted/20 border border-border text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{deliv.destination}</span>
                      {deliv.notes && (
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {deliv.notes}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-blue-600 font-mono text-sm">
                      {deliv.tray_quantity} trays
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {entry.notes && (
            <div className="p-2.5 rounded-lg bg-muted/20 border border-border text-xs space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <FileText className="h-3 w-3" /> Transaction Note
              </span>
              <p className="text-foreground">{entry.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
