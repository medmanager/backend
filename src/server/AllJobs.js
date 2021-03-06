import mongoose from 'mongoose';
import UserSchema from '../models/userModel';
import {scheduleWeeklyOccurrences} from '../controllers/cronController';
import schedule from 'node-schedule';

let User = mongoose.model('User', UserSchema);

export const scheduleUserJobs = async () => {
    let users = await User.find({});
    users.forEach(user => {
        //first schedule doses for this week
        scheduleWeeklyOccurrences(user._id);

        let time = "0 0 * * 0"; //run every week at the start of each Sunday
        //nodeschedule allows editing of jobs based off user id, so pass in user._id
        //kind of weird, but id must be a string
        schedule.scheduleJob(user._id.toString(), time, function() {
            scheduleWeeklyOccurrences(user._id);
        });

        //DEBUG PRINT STATEMENTS
        //console.log(user)
        // user.medications.forEach(med => {
        //     //console.log(med);
        //     med.dosages.forEach(dose => {
        //         //console.log(dose);
        //         dose.occurrences.forEach(occurrence => {
        //             console.log(occurrence);
        //         });
        //     });
        // });
    });
}