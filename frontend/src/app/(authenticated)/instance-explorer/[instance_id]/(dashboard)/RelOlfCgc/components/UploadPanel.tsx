"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAtom } from "jotai";
import { runStatusAtom, lastResultAtom } from "../store/OnboardingAtoms";
import { runOnboarding } from "../actions/Actions";
import type { OnboardingSnapshot } from "../store/Types";

const UploadFormSchema = z.object({
  file: z
    .custom<FileList>((v) => v instanceof FileList && v.length === 1, {
      message: "Select one config workbook (.xlsx)",
    })
    .refine((list) => list[0]?.name.toLowerCase().endsWith(".xlsx"), {
      message: "File must be an .xlsx workbook",
    }),
});

type UploadFormValues = z.infer<typeof UploadFormSchema>;

interface UploadPanelProps {
  instanceId: number;
  instanceName: string;
  initialSnapshot: OnboardingSnapshot | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function UploadPanel({ instanceId, instanceName, initialSnapshot }: UploadPanelProps) {
  const [status, setStatus] = useAtom(runStatusAtom);
  const [result, setResult] = useAtom(lastResultAtom);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UploadFormValues>({ resolver: zodResolver(UploadFormSchema) });

  const onSubmit = async (values: UploadFormValues) => {
    const file = values.file[0];
    setStatus("running");
    setResult(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await runOnboarding(instanceId, file.name, fileBase64);
      setResult(res);
      setStatus(res.ok ? "done" : "error");
    } catch (e) {
      setResult({ ok: false, log: "", error: e instanceof Error ? e.message : "Upload failed" });
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold text-text-primary">AFP Onboarding</h1>
        <p className="text-sm text-text-secondary">{instanceName}</p>
        <p className="text-sm text-text-secondary">
          Upload the asset config workbook to build the case, asset, model, tag, and
          failure-mode tables for this instance.
        </p>
      </header>

      {initialSnapshot && (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-text-secondary">
          Last run: <span className="text-text-primary">{initialSnapshot.fileName}</span> at{" "}
          {new Date(initialSnapshot.ranAt).toLocaleString()} —{" "}
          <span className={initialSnapshot.result.ok ? "text-accent-green" : "text-accent-red"}>
            {initialSnapshot.result.ok ? "succeeded" : "failed"}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <input
          type="file"
          accept=".xlsx"
          {...register("file")}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
        {errors.file && <span className="text-sm text-accent-red">{errors.file.message}</span>}

        <button
          type="submit"
          disabled={status === "running"}
          className="w-fit rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {status === "running" ? "Running onboarding…" : "Run Onboarding"}
        </button>
      </form>

      {result && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-primary">
            {result.ok ? (
              <span className="text-accent-green">Onboarding complete</span>
            ) : (
              <span className="text-accent-red">Onboarding failed</span>
            )}
          </h2>
          {result.error && <p className="text-sm text-accent-red">{result.error}</p>}
          {result.log && (
            <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-text-secondary">
              {result.log}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
