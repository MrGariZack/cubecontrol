import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface PnpRecord {
  readonly Name?: unknown;
  readonly Manufacturer?: unknown;
  readonly PNPDeviceID?: unknown;
}

export interface WindowsMidiMetadata {
  readonly name: string;
  readonly manufacturer?: string;
  readonly vendorId: number;
  readonly productId: number;
}

const PNP_QUERY = [
  "Get-CimInstance Win32_PnPEntity",
  "| Where-Object { $_.PNPClass -eq 'MEDIA' -and $_.PNPDeviceID -match 'VID_[0-9A-F]{4}&PID_[0-9A-F]{4}' }",
  "| Select-Object Name,Manufacturer,PNPDeviceID",
  "| ConvertTo-Json -Compress",
].join(" ");

function asRecords(value: unknown): readonly PnpRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is PnpRecord => item !== null);
  return value !== null && typeof value === "object" ? [value as PnpRecord] : [];
}

export function parseWindowsMidiMetadata(json: string): readonly WindowsMidiMetadata[] {
  if (json.trim() === "") return [];

  const records = asRecords(JSON.parse(json) as unknown);
  const metadata: WindowsMidiMetadata[] = [];
  for (const record of records) {
    if (typeof record.Name !== "string" || typeof record.PNPDeviceID !== "string") continue;
    const ids = /VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(record.PNPDeviceID);
    if (!ids?.[1] || !ids[2]) continue;

    metadata.push({
      name: record.Name,
      ...(typeof record.Manufacturer === "string" ? { manufacturer: record.Manufacturer } : {}),
      vendorId: Number.parseInt(ids[1], 16),
      productId: Number.parseInt(ids[2], 16),
    });
  }
  return metadata;
}

export async function getWindowsMidiMetadata(): Promise<readonly WindowsMidiMetadata[]> {
  if (process.platform !== "win32") return [];

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", PNP_QUERY],
      {
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    return parseWindowsMidiMetadata(stdout);
  } catch {
    // MIDI enumeration remains usable if WMI/CIM is unavailable or restricted.
    return [];
  }
}
