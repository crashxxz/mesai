import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <BrandMark className="h-14 w-14" />
      <h1 className="text-2xl font-black">Página não encontrada</h1>
      <Button asChild>
        <Link href="/app/dashboard">Voltar</Link>
      </Button>
    </main>
  );
}
