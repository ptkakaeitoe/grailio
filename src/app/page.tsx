import { Hero } from "@/components/hero";
import { LandingSections } from "@/components/landing-sections";

export default function Home() {
  return (
    <div className="page">
      <Hero />
      <LandingSections />
    </div>
  );
}
