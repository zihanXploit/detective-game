import Link from "next/link";
import { Card, Wordmark } from "@/presentation/components/ui";

export function RoomUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <Wordmark />
      <Card className="space-y-3 text-center">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="text-sm text-muted">{detail}</p>
        <Link href="/" className="inline-block text-sm font-semibold text-brass hover:underline">
          Back to the front desk
        </Link>
      </Card>
    </>
  );
}
