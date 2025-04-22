export interface RoomSettings {
  diagramCode?: string;
}

export interface RoomData {
  key: string;
  users: string[];
  moderator: string;
  connectedUsers: Record<string, boolean>;
  createdAt?: string;
  lastActivity?: string;
  settings: RoomSettings;
}

export interface WebSocketErrorData {
  error?: string;
  message?: string;
  code?: number;
}

export interface WebSocketMessage {
  type: string;
  roomData?: RoomData;
  settings?: RoomSettings;
  error?: string;
  message?: string;
  user?: string;
  isConnected?: boolean;
}