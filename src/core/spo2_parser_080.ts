export interface SpO2Data_080 {
  spo2: number | null; // null represents invalid/search state
  pr: number | null;
  ss: number;
  bar: number;
  waveform: number;
}

export type SpO2Callback_080 = (data: SpO2Data_080) => void;

export class SpO2Parser_080 {
  private buffer: number[] = [];
  private onDataParsed: SpO2Callback_080;

  constructor(onDataParsed: SpO2Callback_080) {
    this.onDataParsed = onDataParsed;
  }

  public parseChunk(chunk: Uint8Array) {
    for (let i = 0; i < chunk.length; i++) {
      this.buffer.push(chunk[i]);
    }
    this.processBuffer();
  }

  public reset() {
    this.buffer = [];
  }

  private processBuffer() {
    while (this.buffer.length >= 5) {
      // Find the sync byte (bit 7 is 1)
      if ((this.buffer[0] & 0x80) === 0x80) {
        // Check if the next 4 bytes have bit 7 as 0
        let isValidPacket = true;
        for (let i = 1; i < 5; i++) {
          if ((this.buffer[i] & 0x80) !== 0) {
            isValidPacket = false;
            break;
          }
        }

        if (isValidPacket) {
          this.extractData(this.buffer.slice(0, 5));
          this.buffer.splice(0, 5); // Remove the parsed packet
        } else {
          // Packet is corrupted, drop the sync byte and search again
          this.buffer.shift();
        }
      } else {
        // Not a sync byte, drop it
        this.buffer.shift();
      }
    }
  }

  private extractData(packet: number[]) {
    // Byte 1: bit 0~3 SS
    const ss = packet[0] & 0x0F;
    
    // Byte 2: bit 0~6 Waveform
    const waveform = packet[1] & 0x7F;

    // Byte 3: bit 0~3 BAR, bit 4 probe off, bit 5 search, bit 6 PR MSB
    const bar = packet[2] & 0x0F;
    const probeOff = (packet[2] & 0x10) !== 0;
    const prMsb = (packet[2] & 0x40) >> 6;

    // Byte 4: bit 0~6 PR LSB
    const prLsb = packet[3] & 0x7F;
    const pr = (prMsb << 7) | prLsb;

    // Byte 5: bit 0~6 SPO2
    const spo2 = packet[4] & 0x7F;

    let finalSpO2: number | null = spo2;
    let finalPr: number | null = pr;

    if (probeOff || spo2 === 0x7F) {
      // Some modules keep pulseSearch flag active even when outputting valid data, 
      // so we only invalidate if the probe is explicitly off or value is 0x7F
      finalSpO2 = null;
      finalPr = null;
    }

    this.onDataParsed({
      spo2: finalSpO2,
      pr: finalPr,
      ss,
      bar,
      waveform,
    });
  }
}
