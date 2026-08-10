# `@tonehub/midi-transport-native`

TypeScript `MidiTransport` over a platform `NativeMidiHost`. No Node, no RtMidi.

## Host contract

Implement `NativeMidiHost` in a React Native / Capacitor plugin:

| Platform | Suggested mapping |
|---|---|
| Android | `MidiManager` + `MidiDevice` / `MidiInputPort` / `MidiOutputPort` |
| iOS | CoreMIDI (`MIDIClient`, `MIDIPort`, `MIDISysexSendRequest` for large SysEx) |

Port ids are host-defined (e.g. `android:input:0`, `coremidi:output:1`). Deliver **byte chunks**,
not assembled messages — `@tonehub/midi-core` / `CubeBabyLink` reassemble SysEx.

## Usage

```ts
import { NativeMidiTransport } from "@tonehub/midi-transport-native";
import { CubeBabySession } from "@tonehub/cube-baby-api";

const transport = new NativeMidiTransport(myAndroidOrIosHost);
const session = await CubeBabySession.open(transport, {
  inputPortId: "android:input:0",
  outputPortId: "android:output:0",
});
```

For browser / Capacitor WebView MIDI, prefer `@tonehub/midi-transport-web`.
