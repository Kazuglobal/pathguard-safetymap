"use client"

import React from "react";
import { Button } from "@/components/ui/button";

interface Map3DToggleProps {
  is3DEnabled: boolean;
  onToggle: () => void;
}

export default function Map3DToggle({ is3DEnabled, onToggle }: Map3DToggleProps) {
  return (
    <Button variant="outline" size="sm" onClick={onToggle}>
      {is3DEnabled ? "2D" : "3D"}
    </Button>
  );
}
