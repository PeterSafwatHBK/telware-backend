import IMessage from '@base/types/message';
import mongoose from 'mongoose';
import Communication from './communicationModel';

const messageSchema = new mongoose.Schema<IMessage>({
  content: String,
  media: String,
  contentType: {
    type: String,
    enum: ['text', 'image', 'GIF', 'sticker', 'audio', 'video', 'file', 'link'],
    default: 'text',
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  isAppropriate: {
    type: Boolean,
    default: true,
  },
  isForward: {
    type: Boolean,
    default: false,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  isAnnouncement: {
    type: Boolean,
    default: false,
  },
  deliveredTo: [
    {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      default: [],
    },
  ],
  readBy: [
    {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      default: [],
    },
  ],
  parentMessageId: mongoose.Types.ObjectId,
  threadMessages: [
    {
      type: mongoose.Types.ObjectId,
      default: [],
    },
  ],
});

const Message = Communication.discriminator('Message', messageSchema);
export default Message;
