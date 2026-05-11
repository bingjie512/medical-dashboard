export interface ECGData_080 {
  waveform: number | null; // null if lead off
  hr: number | null; // null if invalid (-100) or lead off
  leadOff: boolean;
  packetRate: number; // Valid packet rate percentage (0-100)
}

export type ECGCallback_080 = (data: Partial<ECGData_080>) => void;

export class ECGParser_080 {
  private buffer: number[] = [];
  private onDataParsed: ECGCallback_080;
  
  private currentLeadOff: boolean = false;
  
  // Statistics
  private totalPackets: number = 0;
  private validPackets: number = 0;

  constructor(onDataParsed: ECGCallback_080) {
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
    this.currentLeadOff = false;
    this.totalPackets = 0;
    this.validPackets = 0;
  }

  private processBuffer() {
    while (this.buffer.length >= 10) {
      // Find possible Module ID (bit 7 is 0, others must have bit 7 as 1)
      if ((this.buffer[0] & 0x80) === 0) {
        // Only process ECG module (0x10) to compute valid rate for ECG specifically
        if (this.buffer[0] === 0x10) {
          let isValidPacket = true;
          for (let i = 1; i < 10; i++) {
            if ((this.buffer[i] & 0x80) === 0) {
              isValidPacket = false;
              break;
            }
          }

          if (isValidPacket) {
            this.totalPackets++;
            // Checksum verification
            let sum = 0;
            for (let i = 0; i < 9; i++) {
              sum += this.buffer[i] & 0x7F;
            }
            const checksum = sum & 0x7F;
            const packetChecksum = this.buffer[9] & 0x7F;

            if (checksum === packetChecksum) {
              this.validPackets++;
              this.extractData(this.buffer.slice(0, 10));
              this.buffer.splice(0, 10);
            } else {
              // Checksum failed, drop the first byte
              this.buffer.shift();
            }
          } else {
            // Corrupted packet
            this.buffer.shift();
          }
        } else {
           // Not ECG Module ID, drop it
           this.buffer.shift();
        }
      } else {
        // Not a module ID, drop it
        this.buffer.shift();
      }
    }
  }

  private extractData(packet: number[]) {
    const head = packet[1] & 0x7F;
    
    // Reconstruct bytes
    const subId = ((head & 0x01) << 7) | (packet[2] & 0x7F);
    const data1 = (((head & 0x02) >> 1) << 7) | (packet[3] & 0x7F);
    const data2 = (((head & 0x04) >> 2) << 7) | (packet[4] & 0x7F);

    const result: Partial<ECGData_080> = {
      packetRate: this.totalPackets > 0 ? (this.validPackets / this.totalPackets) * 100 : 100
    };

    if (subId === 0x02) {
      // ECG Waveform
      const value = (data1 << 8) | data2;
      result.waveform = value;
      if (this.currentLeadOff || value === 2048) { 
        // Lead off can sometimes be indicated by baseline 2048
      }
    } else if (subId === 0x04) {
      // Heart Rate
      let hr = (data1 << 8) | data2;
      if (hr > 32767) hr -= 65536;
      
      if (hr === -100 || hr < 0 || hr > 350) {
        result.hr = null;
      } else {
        result.hr = hr;
      }
    } else if (subId === 0x03) {
      // Lead Info
      this.currentLeadOff = data1 === 1;
      result.leadOff = this.currentLeadOff;
      if (this.currentLeadOff) {
        result.hr = null;
        result.waveform = null;
      }
    }

    if (Object.keys(result).length > 0) {
      this.onDataParsed(result);
    }
  }
}
