"use client";

interface ProfileBasicsSettingsSectionProps {
  name: string;
  visionLoss: string;
  screenReader: string;
  onNameChange: (value: string) => void;
  onVisionLossChange: (value: string) => void;
  onScreenReaderChange: (value: string) => void;
}

export function ProfileBasicsSettingsSection({
  name,
  visionLoss,
  screenReader,
  onNameChange,
  onVisionLossChange,
  onScreenReaderChange,
}: ProfileBasicsSettingsSectionProps) {
  const visionLevels = [
    {
      id: "vl-blind",
      label: "Totally Blind",
      desc: "Primarily relies on Speech & Haptic responses",
    },
    {
      id: "vl-legal",
      label: "Legally Blind",
      desc: "High-contrast guides & Audio descriptions",
    },
    {
      id: "vl-low",
      label: "Moderate Low Vision",
      desc: "Large fonts, scaling, & outline guidance",
    },
    {
      id: "vl-mild",
      label: "Mild Low Vision",
      desc: "Slight text adjustments & voice cues",
    },
  ];

  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl"
      aria-labelledby="profile-basics-heading"
    >
      <h2
        id="profile-basics-heading"
        className="text-xl font-bold text-white mb-2"
      >
        Profile & Accessibility Basics
      </h2>
      <p className="text-xs text-slate-400 mb-6">
        Update your name, degree of vision loss, and screen reader preferences.
      </p>

      <div className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="user-name"
            className="block text-sm font-semibold text-slate-200"
          >
            Full Name / Preferred Name
          </label>
          <input
            type="text"
            id="user-name"
            required
            placeholder="Enter your name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
          />
        </div>

        <div className="space-y-3">
          <span
            className="block text-sm font-semibold text-slate-200"
            id="vision-loss-label"
          >
            Degree of Vision Loss
          </span>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            role="radiogroup"
            aria-labelledby="vision-loss-label"
          >
            {visionLevels.map((level) => (
              <label
                key={level.id}
                htmlFor={level.id}
                className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all duration-200 focus-within:ring-2 focus-within:ring-yellow-400 ${
                  visionLoss === level.id
                    ? "bg-slate-950 border-2 border-yellow-400"
                    : "bg-slate-950 border border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id={level.id}
                    name="vision-loss"
                    value={level.id}
                    checked={visionLoss === level.id}
                    onChange={(event) =>
                      onVisionLossChange(event.target.value)
                    }
                    className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
                  />
                  <span className="text-sm font-bold text-white">
                    {level.label}
                  </span>
                </div>
                <span className="text-xs text-slate-400 mt-1 pl-7">
                  {level.desc}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="screen-reader-select"
            className="block text-sm font-semibold text-slate-200"
          >
            Primary Screen Reader Helper
          </label>
          <select
            id="screen-reader-select"
            value={screenReader}
            onChange={(event) => onScreenReaderChange(event.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all cursor-pointer"
          >
            <option value="none">None / Standard Audio Synthesis Only</option>
            <option value="voiceover">Apple VoiceOver</option>
            <option value="nvda">NVDA (NonVisual Desktop Access)</option>
            <option value="jaws">JAWS (Job Access With Speech)</option>
            <option value="talkback">Android TalkBack</option>
            <option value="other">Other Screen Reader</option>
          </select>
        </div>
      </div>
    </section>
  );
}

interface AssistantPersonaSettingsSectionProps {
  assistantPersona: string;
  onAssistantPersonaChange: (value: string) => void;
}

export function AssistantPersonaSettingsSection({
  assistantPersona,
  onAssistantPersonaChange,
}: AssistantPersonaSettingsSectionProps) {
  const personas = [
    {
      id: "cheerleader",
      label: "Cheerleader",
      desc: "Frequent encouragement; only essential corrections.",
    },
    {
      id: "guide",
      label: "Guide",
      desc: "Balanced encouragement and practical correction.",
    },
    {
      id: "sergeant",
      label: "Sergeant",
      desc: "Concise, direct technical feedback with less chatter.",
    },
  ];

  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl"
      aria-labelledby="persona-heading"
    >
      <h2 id="persona-heading" className="text-xl font-bold text-white mb-2">
        Assistant Persona
      </h2>
      <p className="text-xs text-slate-400 mb-6">
        Choose the vocal style of FitA11y&apos;s assistant layer. This supplementary assistant provides pacing and form cues; it never alters or replaces the YouTube creator&apos;s voice.
      </p>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        role="radiogroup"
        aria-labelledby="persona-heading"
      >
        {personas.map((persona) => (
          <label
            key={persona.id}
            htmlFor={persona.id}
            className="relative flex flex-col p-5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400"
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id={persona.id}
                name="assistant-persona"
                value={persona.id}
                checked={assistantPersona === persona.id}
                onChange={(event) =>
                  onAssistantPersonaChange(event.target.value)
                }
                className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
              />
              <span className="text-sm font-bold text-white">
                {persona.label}
              </span>
            </div>
            <span className="text-xs text-slate-400 mt-2">{persona.desc}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
