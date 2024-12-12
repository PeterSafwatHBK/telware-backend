import Chat from '@base/models/chatModel';
import VoiceCall from '@base/models/voiceCallModel';
import IVoiceCall from '@base/types/voiceCall';
import mongoose from 'mongoose';
import { Socket } from 'socket.io';

interface ClientSocketMap {
  [voiceCallId: string]: {
    [userId: string]: string;
  };
}

const clientSocketMap: ClientSocketMap = {};

export async function createVoiceCall(chatId: string, userId: string) {
  const chat = await Chat.findById(chatId);

  const voiceCall = new VoiceCall({
    callType: chat?.type === 'private' ? 'private' : 'group',
    senderId: new mongoose.Types.ObjectId(userId),
    chatId: new mongoose.Types.ObjectId(chatId),
  });

  await voiceCall.save();

  return voiceCall;
}

export async function addClientToCall(
  socket: Socket,
  userId: string,
  voiceCallId: string
) {
  // Add the client socket id into the map
  if (!clientSocketMap[voiceCallId]) clientSocketMap[voiceCallId] = {};
  clientSocketMap[voiceCallId][userId] = socket.id;

  // Add a user Id object into the call current participants.
  const voiceCall: IVoiceCall = await VoiceCall.findById(voiceCallId);
  const userIdObj = new mongoose.Types.ObjectId(userId);

  const userIdIndex = voiceCall.currentParticipants.indexOf(userIdObj);

  if (userIdIndex === -1) {
    voiceCall.currentParticipants.push(userIdObj);
  } else {
    voiceCall.currentParticipants[userIdIndex] = userIdObj;
  }

  await voiceCall.save();
  console.log(
    'voice call currentParticipants: ',
    voiceCall.currentParticipants
  );
  console.log('map data: ', clientSocketMap);
}

export function getClientSocketMap(): ClientSocketMap {
  return clientSocketMap;
}
