import { redirect } from "next/navigation";

export default function LegacyVideoLibraryRedirect() {
  redirect("/video-library");
}
