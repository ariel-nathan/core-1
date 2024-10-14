"use client";

import { useMemo, useState } from "react";

import { processMarkdown } from "@/lib/markdown-parser";
import { usePipeline } from "@/lib/use-pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const [input, setInput] = useState<File | null>();
  const [progress, setProgress] = useState(0);

  const generateEmbedding = usePipeline(
    "feature-extraction",
    "Supabase/gte-small",
  );

  const isReady = useMemo(() => !!generateEmbedding, [generateEmbedding]);

  async function handleSubmit() {
    setProgress(0);

    if (!generateEmbedding) {
      throw new Error("Unable to generate embeddings");
    }

    if (!input) {
      throw new Error("No file selected");
    }

    const processedMd = processMarkdown(await input.text());

    console.log("Total sections:", processedMd.sections.length);

    const embeddings = [];
    for (const section of processedMd.sections) {
      const output = await generateEmbedding(section.content, {
        pooling: "mean",
        normalize: true,
      });

      setProgress(
        (progress) => progress + (1 / processedMd.sections.length) * 100,
      );

      console.log("Embedding generated");
      const embedding = JSON.stringify(Array.from(output.data));
      embeddings.push(embedding);
    }

    setProgress(100);

    console.log("All embeddings generated");
    console.log(embeddings);
  }

  return (
    <main className="container flex grow flex-col space-y-4 py-2">
      <div className="max-w-sm">
        <Label>File</Label>
        <Input
          type="file"
          accept=".md"
          onChange={(event) =>
            setInput(event.target.files && event.target.files[0])
          }
        />
      </div>
      <Progress value={progress} className="max-w-sm" />
      <Button
        disabled={!input || !isReady || progress !== 0}
        onClick={handleSubmit}
        className="max-w-sm"
      >
        {progress === 0
          ? "Generate Embeddings"
          : progress === 100
            ? "Done!"
            : "Generating..."}
      </Button>
    </main>
  );
}
