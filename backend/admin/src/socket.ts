// backend/admin/src/socket.ts
import { io } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './socket-events';
import type { Socket } from 'socket.io-client';

const URL = import.meta.env.VITE_ADMIN_SOCKET_URL || window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1200,
  reconnectionDelayMax: 5000,
  timeout: 5000,
  transports: ['websocket'],
  forceNew: true,
});
