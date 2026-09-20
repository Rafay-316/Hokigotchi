import type { Metadata } from "next";
import ForkQuest from "./fork-quest";

export const metadata: Metadata = {
  title: "Hokigotchi | Little Hokie. Big future.",
  description: "A little Hokie-inspired money companion: build habits, earn rewards, and grow with Hoki.",
};

export default function Home() {
  return <ForkQuest />;
}
