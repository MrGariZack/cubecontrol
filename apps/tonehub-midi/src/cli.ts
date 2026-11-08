#!/usr/bin/env node

import { NodeMidiTransport } from "@tonehub/midi-transport-node";
import { Command } from "commander";
import { applyLiveIrCommand } from "./commands/apply-live-ir.js";
import { backupBankCommand } from "./commands/backup-bank.js";
import { captureCommand } from "./commands/capture.js";
import { compareCommand } from "./commands/compare.js";
import { decodeCommand } from "./commands/decode.js";
import { dumpIrRomCommand } from "./commands/dump-ir-rom.js";
import { identifyCommand } from "./commands/identify.js";
import { exportIrWavCommand } from "./commands/export-ir-wav.js";
import { importIrWavCommand } from "./commands/import-ir-wav.js";
import { listCommand } from "./commands/list.js";
import { loadIrCommand } from "./commands/load-ir.js";
import { monitorCommand } from "./commands/monitor.js";
import { persistIrRomCommand } from "./commands/persist-ir-rom.js";
import { probeCabinetIrCommand } from "./commands/probe-cabinet-ir.js";
import { readMemoryCommand } from "./commands/read-memory.js";
import { restoreBankCommand } from "./commands/restore-bank.js";
import { saveParamCommand } from "./commands/save-param.js";
import { scanIrRomCommand } from "./commands/scan-ir-rom.js";
import { writeMemoryCommand } from "./commands/write-memory.js";

const program = new Command()
  .name("tonehub-midi")
  .description("MIDI diagnostics and safe protocol probes for ToneHub hardware research")
  .version("0.0.0");

program
  .command("list")
  .description("List MIDI ports without opening or transmitting to them")
  .option("--json", "Emit machine-readable JSON")
  .action(async (options: { json?: boolean }) => {
    const transport = new NodeMidiTransport();
    try {
      await listCommand(transport, options);
    } finally {
      await transport.dispose();
    }
  });

program
  .command("monitor")
  .description("Passively monitor one MIDI input; never opens an output")
  .option("--input <id>", "Input port ID from the list command")
  .option("--duration <ms>", "Stop automatically after this many milliseconds")
  .option("--raw", "Also print native callback chunks before message assembly")
  .action(async (options: { input?: string; duration?: string; raw?: boolean }) => {
    const transport = new NodeMidiTransport();
    try {
      await monitorCommand(transport, options);
    } finally {
      await transport.dispose();
    }
  });

program
  .command("capture")
  .description("Passively save native chunks and assembled MIDI messages as JSON Lines")
  .argument("<file>", "Destination .jsonl file")
  .option("--input <id>", "Input port ID from the list command")
  .option("--duration <ms>", "Stop automatically after this many milliseconds")
  .option("--force", "Overwrite an existing capture file")
  .action(async (file: string, options: { input?: string; duration?: string; force?: boolean }) => {
    const transport = new NodeMidiTransport();
    try {
      await captureCommand(transport, file, options);
    } finally {
      await transport.dispose();
    }
  });

program
  .command("decode")
  .description("Decode complete MIDI messages from a JSONL or binary SysEx capture")
  .argument("<file>", "Capture file")
  .option("--json", "Emit machine-readable JSON")
  .action(async (file: string, options: { json?: boolean }) => {
    await decodeCommand(file, options);
  });

program
  .command("compare")
  .description("Compare complete MIDI messages in two capture files")
  .argument("<file1>", "First capture")
  .argument("<file2>", "Second capture")
  .option("--json", "Emit machine-readable JSON")
  .action(async (file1: string, file2: string, options: { json?: boolean }) => {
    await compareCommand(file1, file2, options);
  });

program
  .command("identify")
  .description("Send only the physically captured, read-only identity request")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .option("--timeout <ms>", "Response timeout, maximum 10000 ms")
  .option("--confirm-read-only", "Confirm transmission of the known identity request")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      timeout?: string;
      confirmReadOnly?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await identifyCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("read-memory")
  .description("Send a captured-shape ReadMemory request (read-only; no writes)")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--memory <n>", "Memory selector (e.g. 5)")
  .requiredOption("--address <n>", "Address as decimal or 0x hex")
  .requiredOption("--length <n>", "Byte length to read")
  .option("--timeout <ms>", "Response timeout, maximum 10000 ms")
  .option("--confirm-read-only", "Confirm transmission of a ReadMemory request")
  .option("--no-handshake", "Skip the identity request before reading")
  .option("--decode", "Decode a 48-byte A+B+C preset bank (length must be 48)")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      memory: string;
      address: string;
      length: string;
      timeout?: string;
      confirmReadOnly?: boolean;
      handshake?: boolean;
      decode?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await readMemoryCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("scan-ir-rom")
  .description("Read-only probe of IR ROM slot headers (factory/extended bases)")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .option("--timeout <ms>", "Per-read timeout, maximum 10000 ms")
  .option("--confirm-read-only", "Confirm read-only IR ROM header scan")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      timeout?: string;
      confirmReadOnly?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await scanIrRomCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("probe-cabinet-ir")
  .description("Sweep live Cabinet 0..8 and score against IR ROM fingerprints")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--confirm-write", "Confirm live Cabinet writes + IR RAM reads")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      timeout?: string;
      confirmWrite?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await probeCabinetIrCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("export-ir-wav")
  .description("Export an IR ROM sector to mono PCM16 WAV @ 48 kHz")
  .requiredOption("--out <path>", "Output .wav path")
  .option("--slot <n>", "Read ROM slot 0..7 from the device")
  .option("--file <path>", "Read a local 4096-byte ROM sector .bin")
  .option("--input <id>", "MIDI input port ID (required with --slot)")
  .option("--output <id>", "MIDI output port ID (required with --slot)")
  .option("--timeout <ms>", "Per-read timeout, maximum 10000 ms")
  .option("--confirm-read-only", "Confirm read-only ROM dump when using --slot")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      out: string;
      slot?: string;
      file?: string;
      input?: string;
      output?: string;
      timeout?: string;
      confirmReadOnly?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await exportIrWavCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("import-ir-wav")
  .description("Convert a WAV impulse to IR ROM/live payloads; optional device apply")
  .requiredOption("--file <path>", "Input .wav (PCM16/24/32 or float32)")
  .option("--out <path>", "Write 4096-byte IR ROM sector .bin")
  .option("--input <id>", "MIDI input port ID (required for device ops)")
  .option("--output <id>", "MIDI output port ID (required for device ops)")
  .option("--slot <n>", "ROM slot 0..7 when persisting")
  .option("--cabinet <n>", "After persist/apply, set live Cabinet 0..8")
  .option("--volume <f32>", "ROM volume / live distance float", "0.5")
  .option("--presence <style>", "ROM header style: upload|factory", "upload")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--persist-rom", "Erase+write the ROM slot with the built sector")
  .option("--apply-live", "Write the derived 2052-byte live IR block")
  .option("--confirm-ir-rom-persist", "Confirm ROM erase/write")
  .option("--confirm-overwrite-cabinet", "Legacy flag accepted for compatibility")
  .option("--confirm-live-ir", "Confirm live IR RAM writes")
  .option("--confirm-write", "Confirm live Cabinet write")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      file: string;
      out?: string;
      input?: string;
      output?: string;
      slot?: string;
      cabinet?: string;
      volume?: string;
      presence?: string;
      timeout?: string;
      persistRom?: boolean;
      applyLive?: boolean;
      confirmIrRomPersist?: boolean;
      confirmOverwriteCabinet?: boolean;
      confirmLiveIr?: boolean;
      confirmWrite?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await importIrWavCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("load-ir")
  .description("One-shot: WAV → write and verify selected IR ROM slot → select cabinet")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--file <path>", "Input .wav (PCM16/24/32 or float32)")
  .requiredOption("--slot <n>", "IR ROM slot to overwrite (0..7)")
  .option("--cabinet <n>", "Live Cabinet after load (default: selected slot + 1)")
  .option("--volume <f32>", "ROM volume / live distance float", "0.5")
  .option("--presence <style>", "Override ROM header style: upload|factory")
  .option("--backup <path>", "Dump current ROM slot to this .bin before overwrite")
  .option("--out <path>", "Also write the built 4096-byte sector .bin")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--confirm-load", "Confirm ROM overwrite + Cabinet select")
  .option("--confirm-overwrite-cabinet", "Legacy flag accepted for compatibility")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      file: string;
      slot: string;
      cabinet?: string;
      volume?: string;
      presence?: string;
      backup?: string;
      out?: string;
      timeout?: string;
      confirmLoad?: boolean;
      confirmOverwriteCabinet?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await loadIrCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("dump-ir-rom")
  .description("Read-only dump of one IR ROM sector (4096 bytes; slot 0..8)")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--slot <n>", "Factory slot 0..7, or 8 for empty sentinel 0x71000")
  .option("--file <path>", "Optional path to write the raw 4096-byte sector")
  .option("--timeout <ms>", "Per-read timeout, maximum 10000 ms")
  .option("--confirm-read-only", "Confirm read-only IR ROM sector dump")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      slot: string;
      file?: string;
      timeout?: string;
      confirmReadOnly?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await dumpIrRomCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("persist-ir-rom")
  .description("Erase, write and verify the selected IR ROM slot")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption(
    "--file <path>",
    "IR ROM payload (.bin/.hex/JSON): 2056 bytes (zero-padded) or full 4096 sector",
  )
  .requiredOption("--slot <n>", "IR ROM slot to overwrite (0..7)")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--confirm-ir-rom-persist", "Confirm erase + ROM rewrite")
  .option("--confirm-overwrite-cabinet", "Legacy flag accepted for compatibility")
  .option("--no-pad-sector", "Do not zero-pad 2056→4096 (leaves erase tail 0xFF)")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      file: string;
      slot: string;
      timeout?: string;
      confirmIrRomPersist?: boolean;
      confirmOverwriteCabinet?: boolean;
      padSector?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await persistIrRomCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("apply-live-ir")
  .description("Apply a 2052-byte IR block to live RAM only (no erase / no ROM persist)")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--file <path>", "IR payload (.bin, .hex, or JSON with dataHex)")
  .option("--distance <f32>", "Override distance float32 at payload bytes 0..3")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--confirm-live-ir", "Confirm live-IR RAM writes (no ROM)")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      file: string;
      distance?: string;
      timeout?: string;
      confirmLiveIr?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await applyLiveIrCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("backup-bank")
  .description("Read the 48-byte A+B+C bank and write a ToneHub JSON backup file")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--file <path>", "Output JSON path")
  .option("--timeout <ms>", "Response timeout, maximum 10000 ms")
  .option("--confirm-read-only", "Confirm read-only bank backup")
  .option("--json", "Also emit the backup JSON on stdout")
  .action(
    async (options: {
      input: string;
      output: string;
      file: string;
      timeout?: string;
      confirmReadOnly?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await backupBankCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("restore-bank")
  .description("Overwrite the A+B+C bank from a ToneHub JSON backup (mutating)")
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--file <path>", "Input JSON backup path")
  .option("--live-slot <A|B|C>", "Slot pushed to live RAM after restore", "A")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--confirm-restore", "Confirm overwriting the full A+B+C bank")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      file: string;
      liveSlot?: string;
      timeout?: string;
      confirmRestore?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await restoreBankCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("save-param")
  .description(
    "Persist one preset field via CubeSuite Save path (live + full 48-byte bank + verify)",
  )
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--slot <A|B|C>", "Preset slot to patch inside the bank image")
  .requiredOption("--offset <n>", "Field offset 0..12 (live/preset map)")
  .requiredOption("--value <n>", "New byte value 0..255")
  .option("--timeout <ms>", "Per-step timeout, maximum 10000 ms")
  .option("--confirm-save", "Confirm persisting the full A+B+C bank")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      slot: string;
      offset: string;
      value: string;
      timeout?: string;
      confirmSave?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await saveParamCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program
  .command("write-memory")
  .description(
    "Send a one-byte live WriteMemory in 0x80000000..0x8000000c (mutating; no bank/Save)",
  )
  .requiredOption("--input <id>", "Explicit MIDI input port ID")
  .requiredOption("--output <id>", "Explicit MIDI output port ID")
  .requiredOption("--memory <n>", "Memory selector (must be 5 for live params)")
  .requiredOption("--address <n>", "Live address as decimal or 0x hex")
  .requiredOption("--data <byte>", "Single data byte (decimal or two hex digits)")
  .option("--timeout <ms>", "ACK timeout, maximum 10000 ms")
  .option("--confirm-write", "Confirm transmission of a live WriteMemory request")
  .option("--no-handshake", "Skip the identity request before writing")
  .option("--json", "Emit machine-readable JSON")
  .action(
    async (options: {
      input: string;
      output: string;
      memory: string;
      address: string;
      data: string;
      timeout?: string;
      confirmWrite?: boolean;
      handshake?: boolean;
      json?: boolean;
    }) => {
      const transport = new NodeMidiTransport();
      try {
        await writeMemoryCommand(transport, options);
      } finally {
        await transport.dispose();
      }
    },
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`tonehub-midi: ${message}`);
  process.exitCode = 1;
});
