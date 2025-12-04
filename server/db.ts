// MongoDB connection disabled - using in-memory storage (Maps) for now
// To re-enable MongoDB, uncomment the code below and set up a MongoDB instance

/*
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-research';

export const connectDB = async () => {
    try {
        if (mongoose.connection.readyState >= 1) {
            return;
        }

        await mongoose.connect(MONGODB_URI);
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);
        console.log(`MongoDB Database: ${mongoose.connection.name}`);
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
};
*/

export const connectDB = async () => {
    // Placeholder - database disabled for in-memory storage
    return Promise.resolve();
};
