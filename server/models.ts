import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
    id: string;
    content: string;
    sender: 'participant' | 'moderator';
    timestamp: Date;
}

export interface ISession extends Document {
    participantId: string;
    moderatorId?: string;
    status: 'active' | 'inactive';
    lastActivity: Date;
    messages: IMessage[];
}

const MessageSchema = new Schema({
    id: { type: String, required: true },
    content: { type: String, required: true },
    sender: { type: String, enum: ['participant', 'moderator'], required: true },
    timestamp: { type: Date, default: Date.now }
});

const SessionSchema = new Schema({
    participantId: { type: String, required: true, unique: true },
    moderatorId: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastActivity: { type: Date, default: Date.now },
    messages: [MessageSchema]
}, {
    timestamps: true
});

export const Session = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
