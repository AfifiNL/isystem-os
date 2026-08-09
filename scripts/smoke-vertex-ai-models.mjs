import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";
import { createVertex } from "@ai-sdk/google-vertex";
import { embed, generateImage, generateText } from "ai";

function loadEnv() {
  for (const fileName of [".env.local", ".env.production.local"]) {
    const envPath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(envPath)) continue;

    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2] || "";
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]?.trim()) process.env[key] = value;
    }
  }
}

function getCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64?.trim();
  if (raw) return JSON.parse(raw);
  if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return undefined;
}

async function getAccessToken(credentials) {
  const auth = new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function smokeText(vertex, modelId) {
  const result = await generateText({
    model: vertex(modelId),
    prompt: "Output exactly: ok",
    // Current thinking models can spend part of this budget before emitting text.
    maxOutputTokens: 256,
  });
  const text = result.text.trim();
  if (text.toLowerCase() !== "ok") {
    throw new Error(`Expected exact text output "ok"; received ${JSON.stringify(text)}.`);
  }
  return text;
}

async function smokeEmbedding(vertex, modelId) {
  const result = await embed({
    model: vertex.embeddingModel(modelId),
    value: "Smoke test embedding text.",
    providerOptions: { vertex: { outputDimensionality: 768, taskType: "SEMANTIC_SIMILARITY" } },
  });
  return `${result.embedding.length} dimensions`;
}

async function smokeImage(vertex, modelId) {
  const result = await generateImage({
    model: vertex.image(modelId),
    prompt: "A single matte blue ceramic sphere on a neutral studio background, no text.",
    aspectRatio: "1:1",
    n: 1,
  });
  const image = result.images[0];
  if (!image?.uint8Array?.byteLength) throw new Error("No image bytes returned.");
  return `${image.mediaType || "image/unknown"}, ${image.uint8Array.byteLength} bytes`;
}

async function smokeLyria2({ project, token }) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/lyria-002:predict`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: "A calm instrumental ambient podcast bed.", negative_prompt: "vocals, spoken word" }],
      parameters: { sample_count: 1 },
    }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 240)}`);
  const json = await response.json();
  const audio = json.predictions?.[0];
  const audioData = audio?.audioContent ?? audio?.bytesBase64Encoded;
  if (!audioData) throw new Error("Lyria 2 response did not include audio bytes.");
  return `${audio.mimeType || "audio/wav"}, ${Buffer.from(audioData, "base64").byteLength} bytes`;
}

async function smokeLyria3({ project, token }) {
  const url = `https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/global/interactions`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "lyria-3-clip-preview",
      input: [{ type: "text", text: "A calm instrumental ambient podcast intro, no vocals or spoken word." }],
    }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 240)}`);
  const json = await response.json();
  const audio = json.outputs?.find((output) => output?.type === "audio");
  if (!audio?.data) throw new Error("Lyria 3 response did not include an audio output.");
  return `${audio.mime_type || "audio/mpeg"}, ${Buffer.from(audio.data, "base64").byteLength} bytes`;
}

async function smokeGeminiPodcastTts({ project, location, token }) {
  const normalizedLocation = location.startsWith("europe-") ? "eu"
    : location.startsWith("us-") ? "us"
      : ["global", "eu", "us", "northamerica-northeast1"].includes(location) ? location : "global";
  const host = normalizedLocation === "global" ? "texttospeech.googleapis.com" : `${normalizedLocation}-texttospeech.googleapis.com`;
  const response = await fetch(`https://${host}/v1/text:synthesize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": project,
    },
    body: JSON.stringify({
      input: {
        prompt: "Speak as a natural two-person podcast conversation.",
        multiSpeakerMarkup: {
          turns: [
            { speaker: "Host", text: "Welcome to this media smoke test." },
            { speaker: "Guest", text: "The podcast dialogue path is working." },
          ],
        },
      },
      voice: {
        languageCode: "en-US",
        modelName: "gemini-2.5-flash-tts",
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speakerAlias: "Host", speakerId: "Aoede" },
            { speakerAlias: "Guest", speakerId: "Kore" },
          ],
        },
      },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 240)}`);
  const json = await response.json();
  if (!json.audioContent) throw new Error("Gemini TTS response did not include audioContent.");
  return `audio/mpeg, ${Buffer.from(json.audioContent, "base64").byteLength} bytes`;
}

async function smokeChirp({ project, token }) {
  const region = process.env.GOOGLE_CHIRP_LOCATION || "eu";
  const url = `https://${region}-speech.googleapis.com/v2/projects/${project}/locations/${region}/recognizers/_:recognize`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      config: { autoDecodingConfig: {}, languageCodes: ["en-US"], model: "chirp_3" },
      content: "",
    }),
  });
  // Empty content is expected to fail, but auth/model/region errors surface here.
  return `${response.status}: ${(await response.text()).slice(0, 160)}`;
}

async function main() {
  loadEnv();
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.GOOGLE_VERTEX_LOCATION;
  if (!project || !location) throw new Error("Missing GOOGLE_CLOUD_PROJECT/GOOGLE_CLOUD_LOCATION.");

  const imagesOnly = process.argv.includes("--images-only");
  const textOnly = process.argv.includes("--text-only");
  const podcastMediaOnly = process.argv.includes("--podcast-media-only");
  const lyria2Only = process.argv.includes("--lyria2-only");
  const credentials = getCredentials();
  const token = imagesOnly ? null : await getAccessToken(credentials);
  const vertex = createVertex({
    project,
    location: "global",
    baseURL: `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google`,
    googleAuthOptions: credentials ? { credentials } : undefined,
  });
  const imageVertex = createVertex({
    project,
    location: "global",
    baseURL: `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google`,
    googleAuthOptions: credentials ? { credentials } : undefined,
  });

  const imageChecks = [
    ["gemini-3.1-flash-lite-image", () => smokeImage(imageVertex, "gemini-3.1-flash-lite-image")],
    ["gemini-3.1-flash-image", () => smokeImage(imageVertex, "gemini-3.1-flash-image")],
  ];
  const podcastMediaChecks = [
    ["gemini-2.5-flash-tts native dialogue", () => smokeGeminiPodcastTts({ project, location, token })],
    ["lyria-3-clip-preview interactions", () => smokeLyria3({ project, token })],
    ["lyria-002 stable fallback", () => smokeLyria2({ project, token })],
  ];
  const textChecks = [
    ["gemini-3.5-flash-lite", () => smokeText(vertex, "gemini-3.5-flash-lite")],
    ["gemini-3.6-flash", () => smokeText(vertex, "gemini-3.6-flash")],
    ["gemini-3.5-flash rollback", () => smokeText(vertex, "gemini-3.5-flash")],
    ["gemini-3.1-pro-preview", () => smokeText(vertex, "gemini-3.1-pro-preview")],
  ];
  const checks = imagesOnly ? imageChecks
    : textOnly ? textChecks
    : lyria2Only ? [["lyria-002 stable fallback", () => smokeLyria2({ project, token })]]
      : podcastMediaOnly ? podcastMediaChecks : [
    ...textChecks,
    ["gemini-embedding-001", () => smokeEmbedding(vertex, "gemini-embedding-001")],
    ["gemini-embedding-2", () => smokeEmbedding(vertex, "gemini-embedding-2")],
    ["lyria-002", () => smokeLyria2({ project, token })],
    ["chirp_3", () => smokeChirp({ project, token })],
    ...imageChecks,
  ];

  let failedChecks = 0;
  for (const [name, check] of checks) {
    try {
      const result = await check();
      console.log(`✅ ${name}: ${result}`);
    } catch (error) {
      failedChecks += 1;
      console.error(`❌ ${name}:`, error.message);
    }
  }

  if (failedChecks > 0) {
    throw new Error(`${failedChecks} Vertex AI smoke check(s) failed.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
