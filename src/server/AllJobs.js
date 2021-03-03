import mongoose from 'mongoose';
import UserSchema from '../models/userModel';
import {scheduleWeeklyOccurrences} from '../controllers/cronController';
import schedule from 'node-schedule';

let User = mongoose.model('User', UserSchema);

// export default class AllJobs {
//     constructor() {
//         this.allJobs = [];
//         //schedule weekly jobs at sunday for every user and schedule all medications 
//         //that are currently stored in the database
//         this.initJobs = async () => {
//             let users = await User.find({});
//             //if there are no registered users, no need to do anything
//             if (users.length == 0) return;
//             //users.forEach(user => {
//                 // let medIds = [];
//                 // if (user.medications.length != 0) {
//                 //     let schedule = getScheduledDays(user, null, null);
//                 //     schedule.forEach(day => {
//                 //         day.forEach(med => {
//                 //             if (day >= new Date().getDay()) {
//                 //             }
//                 //         })
//                 //     });
//                 // }
//                 // user.medications.forEach(med => {
//                 //     let dosages = [];
//                 //     med.dosages.forEach(dosage => {
//                 //         dosages.push({dosageId: dosage._id})
//                 //     });
//                 //     medIds.push({medicationId: med._id, });
//                 // });
//                 // let time = "0 0 * * 0"; //run every week at the start of each Sunday
//                 // let job = cron.schedule(time, function() {
//                 //     scheduleWeeklyOccurrences(user._id);
//                 // });
//                 // this.allJobs.push({userId: user._id, weeklyJob: job, medications: []});
//             //});
//             //console.log(this.allJobs);
//         }
//     }
// }

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
    });
}