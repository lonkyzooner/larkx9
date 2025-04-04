declare module 'livekit-client' {
  export class Room {
    constructor(options?: any);
    connect(url: string, token: string, options?: ConnectOptions): Promise<void>;
    disconnect(): void;
    on(event: RoomEvent, listener: (...args: any[]) => void): void;
    off(event: RoomEvent, listener: (...args: any[]) => void): void;
    localParticipant: LocalParticipant;
    state: ConnectionState;
  }

  export enum ConnectionState {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed'
  }

  export enum ConnectionQuality {
    EXCELLENT = 'excellent',
    GOOD = 'good',
    POOR = 'poor',
    UNKNOWN = 'unknown'
  }

  export enum RoomEvent {
    ParticipantConnected = 'participantConnected',
    ParticipantDisconnected = 'participantDisconnected',
    TrackPublished = 'trackPublished',
    TrackSubscribed = 'trackSubscribed',
    TrackUnsubscribed = 'trackUnsubscribed',
    Disconnected = 'disconnected',
    Connected = 'connected',
    ConnectionStateChanged = 'connectionStateChanged',
    ConnectionQualityChanged = 'connectionQualityChanged',
    MediaDevicesChanged = 'mediaDevicesChanged',
    Error = 'error'
  }

  export interface ConnectOptions {
    autoSubscribe?: boolean;
    rtcConfig?: RTCConfiguration;
  }

  export interface LocalParticipant {
    publishTrack(track: MediaStreamTrack, options?: TrackPublishOptions): Promise<LocalTrackPublication>;
    unpublishTrack(track: MediaStreamTrack): Promise<void>;
    setMicrophoneEnabled(enabled: boolean): Promise<boolean>;
    setCameraEnabled(enabled: boolean): Promise<boolean>;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    publishData(data: Uint8Array, options?: { reliable?: boolean }): Promise<void>;
  }

  export interface RemoteParticipant {
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    identity: string;
  }

  export interface TrackPublishOptions {
    name?: string;
    source?: Track.Source;
    stopMicTrackOnMute?: boolean;
  }

  export interface LocalTrackPublication {
    track: MediaStreamTrack;
    stop(): void;
  }

  export interface RemoteTrackPublication {
    track: Track;
    subscribe(): Promise<Track>;
    unsubscribe(): void;
  }

  export class Track {
    static Source: {
      Camera: string;
      Microphone: string;
      ScreenShare: string;
      ScreenShareAudio: string;
      Unknown: string;
    };
    static Kind: {
      Audio: string;
      Video: string;
      Unknown: string;
    };
    kind: string;
    attach(element?: HTMLMediaElement): HTMLMediaElement;
  }
}
