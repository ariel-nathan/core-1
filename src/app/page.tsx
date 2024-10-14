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
  const [embeddings, setEmbeddings] = useState<string[]>([]);

  const pipelines = usePipeline("feature-extraction", "Supabase/gte-small");

  const isReady = useMemo(() => pipelines.length > 0, [pipelines]);

  async function handleSubmit() {
    setProgress(0);

    if (pipelines.length === 0) {
      throw new Error("Unable to generate embeddings");
    }

    if (!input) {
      throw new Error("No file selected");
    }

    const processedMd = processMarkdown(await input.text());

    console.log("Total sections:", processedMd.sections.length);

    const sectionCount = processedMd.sections.length;
    const sectionsPerWorker = Math.ceil(sectionCount / pipelines.length);

    const promises = pipelines.map(async (pipeline, index) => {
      const start = index * sectionsPerWorker;
      const end = Math.min(start + sectionsPerWorker, sectionCount);
      const workerEmbeddings = [];

      for (let i = start; i < end; i++) {
        const section = processedMd.sections[i];
        const output = await pipeline(section.content, {
          pooling: "mean",
          normalize: true,
        });

        setProgress((progress) => progress + (1 / sectionCount) * 100);

        console.log("Embedding generated");
        const embedding = JSON.stringify(Array.from(output.data));
        workerEmbeddings.push(embedding);
      }

      return workerEmbeddings;
    });

    const results = await Promise.all(promises);
    results.forEach((workerEmbeddings) => {
      setEmbeddings((embeddings) => [...embeddings, ...workerEmbeddings]);
    });

    setProgress(100);

    console.log("All embeddings generated!");
  }

  return (
    <main className="container flex grow flex-col space-y-4 py-4">
      <Input
        type="file"
        accept=".md"
        className="max-w-sm"
        onChange={(event) => {
          setProgress(0);
          setInput(event.target.files && event.target.files[0]);
        }}
      />
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
      <div className="max-w-sm">
        <Label>Embeddings</Label>
        <pre className="overflow-y-auto rounded border p-2">
          {embeddings.length === 0
            ? "No embeddings generated"
            : embeddings.map((embedding, index) => (
                <div key={index}>{embedding}</div>
              ))}
        </pre>
      </div>
    </main>
  );
}
