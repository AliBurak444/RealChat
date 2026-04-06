export class AudioMixer {
  private context: AudioContext;
  private destination: MediaStreamAudioDestinationNode;
  private sources: Map<string, MediaStreamAudioSourceNode> = new Map();

  constructor() {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
  }

  addStream(id: string, stream: MediaStream) {
    if (this.sources.has(id)) return;
    const source = this.context.createMediaStreamSource(stream);
    source.connect(this.destination);
    this.sources.set(id, source);
  }

  removeStream(id: string) {
    const source = this.sources.get(id);
    if (source) {
      source.disconnect();
      this.sources.delete(id);
    }
  }

  getMixedStream(): MediaStream {
    return this.destination.stream;
  }

  stop() {
    this.sources.forEach(source => source.disconnect());
    this.sources.clear();
    this.context.close();
  }
}

export class AudioStreamer {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onAudioData: (base64: string) => void;

  constructor(onAudioData: (base64: string) => void, stream?: MediaStream) {
    this.onAudioData = onAudioData;
    if (stream) {
      this.stream = stream;
    }
  }

  async start() {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.context = new AudioContext({ sampleRate: 16000 });
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const buffer = new ArrayBuffer(pcm16.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(i * 2, pcm16[i], true); // little endian
      }
      
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      this.onAudioData(base64);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextTime: number = 0;
  private destination: MediaStreamAudioDestinationNode | null = null;

  constructor() {
    this.context = new AudioContext({ sampleRate: 24000 }); // Gemini TTS usually 24kHz
    this.destination = this.context.createMediaStreamDestination();
  }

  getStream(): MediaStream | null {
    return this.destination?.stream || null;
  }

  playBase64Pcm(base64: string) {
    if (!this.context) return;
    
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new DataView(buffer);
    for (let i = 0; i < binary.length; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }
    
    const pcm16 = new Int16Array(buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const audioBuffer = this.context.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);
    if (this.destination) {
      source.connect(this.destination);
    }

    if (this.nextTime < this.context.currentTime) {
      this.nextTime = this.context.currentTime;
    }
    source.start(this.nextTime);
    this.nextTime += audioBuffer.duration;
  }

  interrupt() {
    if (this.context) {
      this.context.close();
      this.context = new AudioContext({ sampleRate: 24000 });
      this.destination = this.context.createMediaStreamDestination();
      this.nextTime = 0;
    }
  }

  stop() {
    if (this.context) {
      this.context.close();
      this.context = null;
      this.destination = null;
    }
  }
}
