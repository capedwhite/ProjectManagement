import { io } from "socket.io-client";

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
  withCredentials: true,
  autoConnect: false, // we'll connect manually when the chat component mounts
});