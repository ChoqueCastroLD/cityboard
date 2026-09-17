import type { GameClient } from '../client/GameClient';
import { API_URL } from '../client/api';

const SETTINGS_KEY = 'capi:voice';
const LEVEL_INTERVAL_MS = 120;
const SPEAKING_THRESHOLD = 0.06;

export interface VoiceSettings {
  inputDeviceId: string | null;
  outputVolume: number;
}

export interface PeerVoice {
  connected: boolean;
  speaking: boolean;
  volume: number;
  muted: boolean;
}

export interface VoiceState {
  supported: boolean;
  enabled: boolean;
  connecting: boolean;
  muted: boolean;
  level: number;
  speaking: boolean;
  error: string | null;
  settings: VoiceSettings;
  peers: Record<string, PeerVoice>;
}

type Signal =
  | { kind: 'join' }
  | { kind: 'join-ack' }
  | { kind: 'leave' }
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice'; candidate: RTCIceCandidateInit };

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  analyser: AnalyserNode | null;
  volume: number;
  muted: boolean;
  connected: boolean;
  speaking: boolean;
  makingOffer: boolean;
  polite: boolean;
}

function readSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<VoiceSettings>) : {};
    return { inputDeviceId: typeof parsed.inputDeviceId === 'string' ? parsed.inputDeviceId : null, outputVolume: typeof parsed.outputVolume === 'number' ? Math.min(1, Math.max(0, parsed.outputVolume)) : 1 };
  } catch {
    return { inputDeviceId: null, outputVolume: 1 };
  }
}

function writeSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
  }
}

const supported = typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export class VoiceMesh {
  private readonly peers = new Map<string, Peer>();
  private readonly listeners = new Set<(state: VoiceState) => void>();
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];
  private levelTimer: number | null = null;
  private unsubscribeRtc: (() => void) | null = null;
  private unsubscribeClient: (() => void) | null = null;
  private state: VoiceState = { supported, enabled: false, connecting: false, muted: false, level: 0, speaking: false, error: null, settings: readSettings(), peers: {} };

  constructor(
    private readonly client: GameClient,
    private readonly myId: string,
  ) {
    this.unsubscribeRtc = client.subscribeRtc(({ from, payload }) => void this.onSignal(from, payload as Signal));
    this.unsubscribeClient = client.subscribe(() => this.pruneAbsent());
  }

  getState(): VoiceState {
    return this.state;
  }

  subscribe(listener: (state: VoiceState) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  async enable(): Promise<void> {
    if (!supported) return this.patch({ error: 'Tu navegador no admite chat de voz.' });
    if (this.state.enabled || this.state.connecting) return;
    this.patch({ connecting: true, error: null });
    try {
      const [stream, config] = await Promise.all([this.openMicrophone(), this.loadIceServers()]);
      this.stream = stream;
      this.iceServers = config;
      this.startMeter();
      this.patch({ enabled: true, connecting: false, muted: false });
      for (const id of this.others()) this.client.sendRtc(id, { kind: 'join' });
    } catch (e) {
      this.patch({ connecting: false, error: describeMediaError(e) });
    }
  }

  disable(): void {
    if (!this.state.enabled) return;
    for (const id of this.peers.keys()) this.client.sendRtc(id, { kind: 'leave' });
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.stopMeter();
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.patch({ enabled: false, muted: false, level: 0, speaking: false, peers: {} });
  }

  setMuted(muted: boolean): void {
    for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = !muted;
    this.patch({ muted });
  }

  setPeerVolume(id: string, volume: number): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.volume = Math.min(2, Math.max(0, volume));
    this.applyVolume(peer);
    this.publishPeers();
  }

  setPeerMuted(id: string, muted: boolean): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.muted = muted;
    this.applyVolume(peer);
    this.publishPeers();
  }

  setOutputVolume(volume: number): void {
    const settings = { ...this.state.settings, outputVolume: Math.min(1, Math.max(0, volume)) };
    writeSettings(settings);
    this.patch({ settings });
    for (const peer of this.peers.values()) this.applyVolume(peer);
  }

  async setInputDevice(deviceId: string | null): Promise<void> {
    const settings = { ...this.state.settings, inputDeviceId: deviceId };
    writeSettings(settings);
    this.patch({ settings });
    if (!this.state.enabled) return;
    try {
      const next = await this.openMicrophone();
      const track = next.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !this.state.muted;
      for (const peer of this.peers.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'audio');
        await sender?.replaceTrack(track);
      }
      for (const old of this.stream?.getTracks() ?? []) old.stop();
      this.stream = next;
      this.startMeter();
    } catch (e) {
      this.patch({ error: describeMediaError(e) });
    }
  }

  dispose(): void {
    this.disable();
    this.unsubscribeRtc?.();
    this.unsubscribeClient?.();
    void this.context?.close();
    this.context = null;
  }

  private others(): string[] {
    const presence = this.client.getPresence();
    return this.client
      .getState()
      .players.filter((p) => p.id !== this.myId && !p.bankrupt && (presence === null || presence.has(p.id)))
      .map((p) => p.id);
  }

  private pruneAbsent(): void {
    if (!this.state.enabled) return;
    const present = new Set(this.others());
    for (const id of [...this.peers.keys()]) if (!present.has(id)) this.closePeer(id);
  }

  private async onSignal(from: string, signal: Signal): Promise<void> {
    if (!this.state.enabled) return;
    switch (signal.kind) {
      case 'join':
        this.client.sendRtc(from, { kind: 'join-ack' });
        await this.connectTo(from);
        return;
      case 'join-ack':
        await this.connectTo(from);
        return;
      case 'leave':
        this.closePeer(from);
        return;
      case 'offer': {
        const peer = this.ensurePeer(from);
        const collision = peer.makingOffer || peer.pc.signalingState !== 'stable';
        if (collision && !peer.polite) return;
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        await peer.pc.setLocalDescription();
        this.client.sendRtc(from, { kind: 'answer', sdp: peer.pc.localDescription?.sdp ?? '' });
        return;
      }
      case 'answer': {
        const peer = this.peers.get(from);
        if (peer && peer.pc.signalingState === 'have-local-offer') await peer.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        return;
      }
      case 'ice': {
        const peer = this.peers.get(from);
        if (!peer) return;
        try {
          await peer.pc.addIceCandidate(signal.candidate);
        } catch {
        }
        return;
      }
    }
  }

  private async connectTo(id: string): Promise<void> {
    const peer = this.ensurePeer(id);
    if (peer.polite || peer.pc.signalingState !== 'stable' || peer.pc.connectionState === 'connected') return;
    peer.makingOffer = true;
    try {
      await peer.pc.setLocalDescription();
      this.client.sendRtc(id, { kind: 'offer', sdp: peer.pc.localDescription?.sdp ?? '' });
    } finally {
      peer.makingOffer = false;
    }
  }

  private ensurePeer(id: string): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    audio.dataset.voicePeer = id;
    document.body.append(audio);
    const peer: Peer = { pc, audio, analyser: null, volume: 1, muted: false, connected: false, speaking: false, makingOffer: false, polite: this.myId > id };
    for (const track of this.stream?.getAudioTracks() ?? []) pc.addTrack(track, this.stream!);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.client.sendRtc(id, { kind: 'ice', candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      audio.srcObject = stream;
      this.applyVolume(peer);
      void audio.play().catch(() => undefined);
      peer.analyser = this.analyserFor(stream);
    };
    pc.onconnectionstatechange = () => {
      peer.connected = pc.connectionState === 'connected';
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.closePeer(id);
      else this.publishPeers();
    };
    pc.onnegotiationneeded = () => void this.connectTo(id);
    this.peers.set(id, peer);
    this.publishPeers();
    return peer;
  }

  private closePeer(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
    this.peers.delete(id);
    this.publishPeers();
  }

  private applyVolume(peer: Peer): void {
    peer.audio.volume = peer.muted ? 0 : Math.min(1, peer.volume * this.state.settings.outputVolume);
    peer.audio.muted = peer.muted;
  }

  private async openMicrophone(): Promise<MediaStream> {
    const deviceId = this.state.settings.inputDeviceId;
    const constraints: MediaStreamConstraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } };
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (!deviceId) throw e;
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    }
  }

  private async loadIceServers(): Promise<RTCIceServer[]> {
    try {
      const res = await fetch(`${API_URL}/api/rtc/config`);
      const body = (await res.json()) as { iceServers?: RTCIceServer[] };
      return body.iceServers?.length ? body.iceServers : this.iceServers;
    } catch {
      return this.iceServers;
    }
  }

  private analyserFor(stream: MediaStream): AnalyserNode | null {
    try {
      this.context ??= new AudioContext();
      const source = this.context.createMediaStreamSource(stream);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      return analyser;
    } catch {
      return null;
    }
  }

  private startMeter(): void {
    this.stopMeter();
    if (this.stream) this.localAnalyser = this.analyserFor(this.stream);
    this.levelTimer = window.setInterval(() => {
      const level = this.state.muted ? 0 : measure(this.localAnalyser);
      let changed = false;
      for (const peer of this.peers.values()) {
        const speaking = !peer.muted && measure(peer.analyser) > SPEAKING_THRESHOLD;
        if (speaking !== peer.speaking) {
          peer.speaking = speaking;
          changed = true;
        }
      }
      const speaking = level > SPEAKING_THRESHOLD;
      if (changed || Math.abs(level - this.state.level) > 0.01 || speaking !== this.state.speaking) {
        this.patch({ level, speaking, peers: changed ? this.snapshotPeers() : this.state.peers });
      }
    }, LEVEL_INTERVAL_MS);
  }

  private stopMeter(): void {
    if (this.levelTimer !== null) window.clearInterval(this.levelTimer);
    this.levelTimer = null;
    this.localAnalyser = null;
  }

  private snapshotPeers(): Record<string, PeerVoice> {
    const out: Record<string, PeerVoice> = {};
    for (const [id, peer] of this.peers) out[id] = { connected: peer.connected, speaking: peer.speaking, volume: peer.volume, muted: peer.muted };
    return out;
  }

  private publishPeers(): void {
    this.patch({ peers: this.snapshotPeers() });
  }

  private patch(partial: Partial<VoiceState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }
}

function measure(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (const sample of data) {
    const v = (sample - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

function describeMediaError(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permiso de micrófono denegado. Actívalo en el navegador para hablar.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró ningún micrófono.';
  if (name === 'NotReadableError') return 'Otra aplicación está usando el micrófono.';
  return e instanceof Error ? e.message : 'No se pudo iniciar el chat de voz.';
}
