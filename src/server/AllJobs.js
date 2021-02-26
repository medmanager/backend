import mongoose from 'mongoose';
import UserSchema from '../models/userModel';
import * as cron from 'node-cron';

let User = mongoose.model('User', UserSchema);

export default class AllJobs {
    constructor() {
        this.allJobs = [];
        this.initJobs = async () => {
            let users = await User.find({});
            //if there are no registered users, no need to do anything
            if (users.length == 0) return;
            users.forEach(user => {
                this.allJobs.push(user);
            });
        }
    }
}