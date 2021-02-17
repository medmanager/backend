import mongoose from 'mongoose';
// import { MedicationSchema } from '../models/MedicationModel';
import { UserSchema } from '../models/userModel';
import _ from 'lodash';
import { EventSchema } from '../models/eventModel';

// const Medication = mongoose.model('Medication', MedicationSchema);
const User = mongoose.model('User', UserSchema);
const Event = mongoose.model('Event', EventSchema);

export const medicationCheck = () => {
    User.find((err, users) => {
        if (err) {
            console.log(err);
        } else {
            users.forEach((user, index) => {
                if (user.medications.length != user.currentEvents.length) {
                    let newEvent = new Event({
                       "timestamp": 1,
                       "reminderTime": 1, 
                       "medicationID": "7"
                    });
                    user.currentEvents.push(newEvent);
                    user.save((err, user) => {
                        if (err) {
                            console.log(err);
                        }
                    })
                }
            })
        }
    })
}

export const sendNotification = () => {
    console.log('take your medication noob');
}