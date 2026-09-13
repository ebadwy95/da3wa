"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { InvitationScreen, LoadingCard } from "@/components/InvitationScreen";

// The dashboard's "view" buttons open this: the wedding's invitation in Arabic
// or English, with a made-up guest, for the couple or admin who is signed in.
export default function InvitePreviewPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <Preview />
    </Suspense>
  );
}

function Preview() {
  const { eventId } = useParams();
  const searchParams = useSearchParams();
  return <InvitationScreen previewEventId={eventId} initialLang={searchParams.get("lang") || "ar"} />;
}
