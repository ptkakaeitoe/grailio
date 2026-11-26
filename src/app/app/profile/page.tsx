import type { Metadata } from "next";
import { ProfileWorkspace } from "@/components/profile-workspace";

export const metadata: Metadata = { title: "Profile", description: "Your wallet: holdings at live prices and your card collection." };

export default function ProfilePage() {
  return (
    <div className="page">
      <ProfileWorkspace />
    </div>
  );
}
