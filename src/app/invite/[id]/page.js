"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { InvitationScreen, LoadingCard } from "@/components/InvitationScreen";

// A guest's personal invitation. The screen itself lives in
// src/components/InvitationScreen.js, shared with the dashboard preview.
export default function InvitePage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <GuestInvitation />
    </Suspense>
  );
}

function GuestInvitation() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  return <InvitationScreen guestId={id} token={searchParams.get("t")} initialLang={searchParams.get("lang")} />;
}
