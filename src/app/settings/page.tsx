import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="container max-w-xl py-8">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <div className="space-y-8">
        <section>
          <h2 className="mb-2 text-lg font-medium">Theme</h2>
          <ThemeToggle />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-medium">Profile</h2>
          <p className="text-muted-foreground">Coming soon.</p>
        </section>
      </div>
    </div>
  );
}
