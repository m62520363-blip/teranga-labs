import type { Metadata } from "next";
import { OrbitLanding } from "@/components/orbit/orbit-landing";

export const metadata: Metadata = {
  title: "Orbit — Help your team focus on what truly matters",
  description: "Orbit is an AI team collaboration tool that brings tasks, progress and priorities into one calm workspace.",
};

export default function OrbitPage() {
  return <OrbitLanding />;
}