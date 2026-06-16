import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { DesignProfile, DesignProfileColors } from "@/lib/types";
import typographyOptions from "@/data/typography-options.json";

export const Route = createFileRoute("/design-profiles")({
  head: () => ({ meta: [{ title: "Профили дизайна — AI Infographic Generator" }] }),
  component: ProfilesPage,
});

const TYPO_STYLES = typographyOptions.typography_styles as Array<{ id: string; label: string; prompt: string }>;
const TYPO_SPECIFICITY = typographyOptions.font_specificity_modes as Array<{ id: string; label: string; prompt: string }>;

type ColorKey = keyof DesignProfileColors;

const FILL_ROLES: Array<{ key: ColorKey; label: string }> = [
  { key: "backgroundColor", label: "Задний фон" },
  { key: "surfaceColor", label: "Светлый фон плашки внутри карточки" },
  { key: "headerColor", label: "Цвет шапки и фона заголовков" },
  { key: "detailSoftColor", label: "Более светлая пастель" },
  { key: "detailDeepColor", label: "Более тёмная пастель" },
  { key: "contrastSoftColor", label: "Контрастная пастель" },
];

const INK_ROLES: Array<{ key: ColorKey; label: string }> = [
  { key: "inkColor", label: "Цвет тёмного текста и технических линий" },
  { key: "lightTextColor", label: "Цвет светлого текста" },
  { key: "mutedheaderTextColor", label: "Вторичный светлый текст в шапке" },
  { key: "primaryColor", label: "Акцентный цвет палитры" },
  { key: "spotAccentColor", label: "Цвет акцентных деталей" },
];

function ProfilesPage() {
  const profiles = useSettingsStore((s) => s.profiles);
  const reset = useSettingsStore((s) => s.resetProfiles);

  const [selectedName, setSelectedName] = useState<string>(
    () => profiles[0]?.profileName ?? "",
  );

  const profile = useMemo(
    () => profiles.find((p) => p.profileName === selectedName) ?? profiles[0],
    [profiles, selectedName],
  );

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <p className="text-sm text-muted-foreground">Нет ни одного профиля.</p>
        <Button size="sm" className="mt-2" onClick={reset}>
          Сбросить к умолчаниям
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Профили дизайна</h1>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Профиль</Label>
          <Select value={profile.profileName} onValueChange={setSelectedName}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.profileName} value={p.profileName}>
                  {p.profileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={reset}>
            Сбросить к умолчаниям
          </Button>
        </div>
      </div>

      <ProfileView value={profile} />
    </div>
  );
}

function ProfileView({ value }: { value: DesignProfile }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-6">
      <div>
        <h2 className="text-base font-semibold">{value.profileName}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ColorGroup title="Цвета заливок и фонов" roles={FILL_ROLES} colors={value.colors} />
        <ColorGroup title="Цвета линий, текста и акцентов" roles={INK_ROLES} colors={value.colors} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Типографический характер</Label>
          <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
            {TYPO_STYLES.find((t) => t.id === value.typography.styleId)?.label ?? value.typography.styleId}
          </div>
        </div>
        <div>
          <Label className="text-xs">Строгость выбора шрифта</Label>
          <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
            {TYPO_SPECIFICITY.find((t) => t.id === value.typography.specificityId)?.label ?? value.typography.specificityId}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs">Дополнительные инструкции</Label>
        <Textarea
          rows={16}
          value={value.notesForAI}
          readOnly
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

function ColorGroup({
  title,
  roles,
  colors,
}: {
  title: string;
  roles: Array<{ key: ColorKey; label: string }>;
  colors: DesignProfileColors;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {roles.map(({ key, label }) => (
          <ColorRoleRow key={key} label={label} hex={colors[key]} />
        ))}
      </div>
    </div>
  );
}

function ColorRoleRow({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span
        className="inline-block size-9 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-tight">{label}</div>
        <div className="font-mono text-xs text-muted-foreground">{hex.toUpperCase()}</div>
      </div>
    </div>
  );
}
