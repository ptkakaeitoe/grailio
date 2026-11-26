import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ClassicPackShop } from "@/components/classic-pack-shop";

export const metadata: Metadata = { title: "Classic packs" };

type Props = { searchParams: Promise<{ size?: string | string[] }> };

/** Reads the pack size from the URL inside Suspense, so the page shell stays static. */
async function ClassicBody({ searchParams }: Props) {
  const size = (await searchParams).size;
  return <ClassicPackShop initialSize={typeof size === "string" ? size : undefined} />;
}

export default function ClassicPacksPage({ searchParams }: Props) {
  return (
    <div className="page">
      <Link href="/app/packs" className="mt-2 -ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted transition-colors hover:text-black desk:mt-6"><ArrowLeft className="size-4" /> All packs</Link>
      <h1 className="sr-only">Classic packs</h1>
      <section className="flex flex-col pt-2 pb-6 desk:min-h-[calc(100dvh-var(--header-h)-60px)] desk:justify-center desk:py-8" aria-label="Classic packs">
        <Suspense fallback={<p className="py-16 text-center text-sm text-muted">Loading packs…</p>}>
          <ClassicBody searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
