"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";
import { saveAiSettings, listModels } from "@/actions/settings";
import {
  aiProviders,
  providerInfo,
  isOpenAiReasoningModel,
  type AiOptions,
  type AiProvider,
} from "@/lib/ai/providers";
import { BASE_SYSTEM_PROMPT } from "@/lib/ai/prompt";

type OptionKey = keyof AiOptions;

const optionFields: {
  key: OptionKey;
  label: string;
  hint: string;
  step: string;
  openAiOnly?: boolean;
}[] = [
  { key: "temperature", label: "Temperature", hint: "0-2 (Anthropic caps at 1). Lower is more consistent.", step: "0.1" },
  { key: "topP", label: "Top P", hint: "0-1. Nucleus sampling; usually change this or temperature, not both.", step: "0.05" },
  { key: "maxOutputTokens", label: "Max output tokens", hint: "Upper bound on the reply. Large imports need room (about 100 per link).", step: "1" },
  { key: "frequencyPenalty", label: "Frequency penalty", hint: "-2 to 2. OpenAI only.", step: "0.1", openAiOnly: true },
  { key: "presencePenalty", label: "Presence penalty", hint: "-2 to 2. OpenAI only.", step: "0.1", openAiOnly: true },
];

type Props = {
  provider: AiProvider;
  models: Record<string, string>;
  keyConfigured: Record<string, boolean>;
  options: AiOptions;
  instructions: string;
};

export function AiSettingsForm(props: Props) {
  const [provider, setProvider] = useState<AiProvider>(props.provider);
  const [models, setModels] = useState(props.models);
  const [instructions, setInstructions] = useState(props.instructions);
  const [optionText, setOptionText] = useState<Record<OptionKey, string>>(() => ({
    temperature: props.options.temperature?.toString() ?? "",
    topP: props.options.topP?.toString() ?? "",
    maxOutputTokens: props.options.maxOutputTokens?.toString() ?? "",
    frequencyPenalty: props.options.frequencyPenalty?.toString() ?? "",
    presencePenalty: props.options.presencePenalty?.toString() ?? "",
  }));
  const [isPending, startTransition] = useTransition();
  const info = providerInfo[provider];
  const [available, setAvailable] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadModels = useCallback(async (p: AiProvider) => {
    setLoading(true);
    setLoadError(null);
    const result = await listModels(p);
    if (result.ok) setAvailable((a) => ({ ...a, [p]: result.models }));
    else setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch the live model list when the provider changes (only if its key is set).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (props.keyConfigured[provider]) void loadModels(provider);
  }, [provider, props.keyConfigured, loadModels]);

  // Always include the saved model so it stays selectable if the list lacks it.
  const options = Array.from(
    new Set([models[provider], ...(available[provider] ?? [])])
  );

  function handleSave() {
    // Blank means "provider default" (field omitted from the request).
    const options: AiOptions = {};
    for (const f of optionFields) {
      const raw = optionText[f.key].trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        toast.error(`${f.label} must be a number`);
        return;
      }
      options[f.key] = n;
    }
    startTransition(async () => {
      const result = await saveAiSettings({
        provider,
        model: models[provider],
        instructions,
        options,
      });
      if (result.ok) toast.success("AI settings saved");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ai-provider">Provider</Label>
        <select
          id="ai-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as AiProvider)}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          {aiProviders.map((p) => (
            <option key={p} value={p}>
              {providerInfo[p].label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-model">Model</Label>
        <div className="flex gap-2">
          <select
            id="ai-model"
            value={models[provider]}
            onChange={(e) => setModels({ ...models, [provider]: e.target.value })}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {options.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => loadModels(provider)}
            disabled={loading || !props.keyConfigured[provider]}
            aria-label="Refresh model list"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
        {loadError && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load models: {loadError}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-instructions">Additional instructions</Label>
        <Textarea
          id="ai-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Keep summaries to one sentence. Group by project theme rather than by site."
          className="min-h-24"
        />
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Built-in prompt (always included)</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {BASE_SYSTEM_PROMPT}
          </pre>
          <p className="mt-1">
            Your instructions are appended after this. The JSON output format is
            fixed so imports can be parsed.
          </p>
        </details>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Generation settings</legend>
        <p className="text-sm text-muted-foreground">
          Leave a field blank to use the provider&apos;s default.
          {provider === "openai" && isOpenAiReasoningModel(models[provider]) && (
            <>
              {" "}
              This looks like a reasoning model, so temperature, top P and
              penalties are ignored; only max output tokens applies.
            </>
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {optionFields
            .filter((f) => !f.openAiOnly || provider === "openai")
            .map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`ai-${f.key}`}>{f.label}</Label>
                <Input
                  id={`ai-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  value={optionText[f.key]}
                  onChange={(e) =>
                    setOptionText({ ...optionText, [f.key]: e.target.value })
                  }
                  placeholder="default"
                />
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
            ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        API key: set <code>{info.envKey}</code> in <code>.env.local</code> and
        restart the server.{" "}
        {props.keyConfigured[provider] ? (
          <span className="text-green-600 dark:text-green-400">Detected ✓</span>
        ) : (
          <span className="text-destructive">Not found</span>
        )}
      </p>
      <Button onClick={handleSave} disabled={isPending} size="sm">
        Save
      </Button>
    </div>
  );
}
