"use client";
import * as React from "react";
import { Sidebar, MobileSidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AddContactDialog } from "../add-contact-dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [addContactOpen, setAddContactOpen] = React.useState(false);

  const handleAddContact = React.useCallback(() => setAddContactOpen(true), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} onAddContact={handleAddContact} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} />
    </div>
  );
}
