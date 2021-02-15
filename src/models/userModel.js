import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MedicationSchema } from '../models/MedicationModel';

const Schema = mongoose.Schema;

export const UserSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    hashPassword: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    created_date: {
        type: Date,
        default: Date.now
    },
    medications: {
        type: [MedicationSchema],
        default: []
    }
    
});

UserSchema.methods.comparePassword = (password, hashPassword) => {
    return bcrypt.compareSync(password, hashPassword);
};