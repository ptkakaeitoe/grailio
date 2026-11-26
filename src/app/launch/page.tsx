import type { Metadata } from "next";
import { LaunchForm } from "@/components/launch-form";

export const metadata: Metadata = { title: "Launch a coin", description: "Name your coin, pick Flap or Four.meme and choose the utilities it launches with." };

export default function LaunchPage() {
  return (
    <div className="page pt-6 desk:pt-10">
      <LaunchForm />
    </div>
  );
}
