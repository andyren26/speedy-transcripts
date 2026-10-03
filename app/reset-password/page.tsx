"use client";

import dynamic from "next/dynamic";

// Reads the recovery token / error from the URL on first render, so it must
// render in the browser only (there is no window during server prerendering).
const ResetPasswordPage = dynamic(() => import("@/views/ResetPassword"), { ssr: false });

export default function Page() {
  return <ResetPasswordPage />;
}
