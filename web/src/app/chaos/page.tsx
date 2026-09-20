import type { Metadata } from "next";
import ChaosDemo from "./chaos-demo";

export const metadata: Metadata = {
  title: "Hokigotchi | Chaos Arena",
  description: "Practice your next money decision with Hoki: one surprise, three choices, different futures.",
};

export default function ChaosPage() { return <ChaosDemo />; }
