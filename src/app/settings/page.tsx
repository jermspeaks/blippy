import { ThemeToggle } from "@/components/theme-toggle";
import { AiSettingsForm } from "@/components/ai-settings-form";
import { FeedSettingsForm } from "@/components/feed-settings-form";
import { getAiSettingsView, getFeedCap } from "@/actions/settings";

export default async function SettingsPage() {
  const ai = await getAiSettingsView();
  const feedCap = await getFeedCap();
  return (
    <div className="container mx-auto max-w-xl px-8 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <div className="space-y-8">
        <section>
          <h2 className="mb-2 text-lg font-medium">Theme</h2>
          <ThemeToggle />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-medium">Feed</h2>
          <FeedSettingsForm cap={feedCap} />
          <p className="text-muted-foreground mt-2 text-sm">
            The most blips the feed shows at once (5 to 200, default 50). The rest wait their turn;
            nothing is deleted.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-medium">AI</h2>
          <AiSettingsForm {...ai} />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-medium">Profile</h2>
          <p className="text-muted-foreground">Coming soon.</p>
        </section>
      </div>
    </div>
  );
}
