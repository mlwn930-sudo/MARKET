"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TickerSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const symbol = value.trim().toUpperCase();
    if (!symbol) {
      setError("הקלד סימבול של חברה אמריקאית");
      return;
    }
    if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
      setError("סימבול מכיל אותיות באנגלית בלבד");
      return;
    }
    setError(null);
    router.push(`/company/${symbol}`);
  }

  return (
    <form onSubmit={submit} className="w-full sm:w-auto">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="NVDA"
          aria-label="סימבול החברה"
          dir="ltr"
          className="num w-full surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none sm:w-40"
        />
        <button
          type="submit"
          className="rounded-lg border border-line-strong px-4 py-2 text-sm text-ink transition-colors hover:bg-surface"
        >
          נתח
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-down">{error}</p>}
    </form>
  );
}
