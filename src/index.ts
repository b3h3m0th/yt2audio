#!/usr/bin/env bun

import inquirer from "inquirer";
import { spawn } from "bun";
import path from "path";
import { pathToFileURL } from "url";
import { existsSync, mkdirSync } from "fs";
import { sanitizeFilename, getBinaryPath } from "./utils/file";

const LOSSY_FORMATS = ["mp3", "aac", "ogg", "m4a"] as const;
const LOSSLESS_FORMATS = ["flac", "alac"] as const;
const UNCOMPRESSED_FORMATS = ["wav", "pcm"] as const;

const AUDIO_FORMATS = [
  ...LOSSY_FORMATS,
  ...LOSSLESS_FORMATS,
  ...UNCOMPRESSED_FORMATS,
] as const;

const MP3_BITRATES = ["128k", "192k", "256k", "320k"] as const;
const BIT_DEPTHS = [
  { name: "16-bit", value: 16 },
  { name: "24-bit", value: 24 },
] as const;

async function run() {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "url",
      message: "Enter YouTube URL:",
      validate: (input: string) =>
        input.startsWith("http") ? true : "Enter a valid URL",
    },
    {
      type: "select",
      name: "format",
      message: "Select audio format:",
      choices: AUDIO_FORMATS,
      loop: false,
      default: UNCOMPRESSED_FORMATS[0],
    },
    {
      type: "select",
      name: "bitrate",
      message: "Select bit rate (kbps):",
      choices: MP3_BITRATES,
      when: (answers) => LOSSY_FORMATS.includes(answers.format),
      default: MP3_BITRATES.at(-1),
    },
    {
      type: "select",
      name: "bitDepth",
      message: "Select bit depth:",
      choices: BIT_DEPTHS,
      when: (answers) =>
        LOSSLESS_FORMATS.includes(answers.format) ||
        UNCOMPRESSED_FORMATS.includes(answers.format),
      default: BIT_DEPTHS.at(-1)?.value,
    },
  ]);

  const { url, format, bitrate, bitDepth } = answers;

  let audioOptionArg = "";

  if (LOSSY_FORMATS.includes(format) && bitrate) {
    audioOptionArg = `-b:a ${bitrate}`;
  }

  if (LOSSLESS_FORMATS.includes(format) && bitDepth) {
    audioOptionArg = `-sample_fmt s${bitDepth}`;
  }

  if (UNCOMPRESSED_FORMATS.includes(format) && bitDepth) {
    audioOptionArg =
      bitDepth === "24" ? "-c:a pcm_s24le" : "-c:a pcm_s16le";
  }

  const ytDlpPath = getBinaryPath("yt-dlp.exe");
  const ffmpegPath = getBinaryPath("ffmpeg.exe");

  const titleProc = spawn({
    cmd: [ytDlpPath, "--print", "title", url],
    stdout: "pipe",
    stderr: "inherit",
  });

  const rawTitle = await new Response(titleProc.stdout).text();
  const titleExit = await titleProc.exited;

  if (titleExit !== 0) {
    console.error("Failed to fetch audio.");
    process.exit(1);
  }

  const outDirectory = "out";
  if (!existsSync(outDirectory)) {
    mkdirSync(outDirectory, { recursive: true });
  }

  const sanitizedTitle = sanitizeFilename(rawTitle);
  const outputTemplate = path.join(outDirectory, sanitizedTitle);

  const downloadProc = spawn({
    cmd: [
      ytDlpPath,
      "-f",
      "bestaudio",
      "-x",
      "--audio-format",
      format,
      "--ffmpeg-location",
      ffmpegPath,
      "--postprocessor-args",
      audioOptionArg,
      "-o",
      outputTemplate,
      url,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await downloadProc.exited;
  if (exitCode !== 0) {
    console.error("Failed to download audio.");
    process.exit(1);
  }

  const absolutePath = path.resolve(`${outputTemplate}.${format}`);
  const fileUrl = pathToFileURL(absolutePath);

  console.log(`Audio successfully saved to: ${fileUrl}`);
}

run();
