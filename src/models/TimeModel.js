import mongoose from 'mongoose';

const Schema = mongoose.Schema;

export const TimeSchema = new Schema({
    hour: {
        type: Number,
        required: 'enter a number 1-24 indicating hour of the day'
    },
    minute: {
        type: Number,
        required: 'enter a value between 0-59 indicating minute'
    },

    numPills: Number, // number of pills taken
    dosage: Number, // dosage taken in mg

    // for easy scheduling
    repeatDaily: Boolean,
    repeatEveryOtherDay: Boolean,
    repeatOnceWeekly: Boolean, // if true, day-to-repeat is repeatDays

    // for custom scheduling
    repeatEveryBlankDays: Boolean, // if true, repeatFrequency specifies number of days
    repeatEveryBlankWeeks: Boolean, // if true, repeatFrequency specifies number of weeks
    repeatDays: String, // "MTWRFSN" (Mon, Tues, Wed, thUrs, Fri, Sat, suN)
                        // which days to take medication
    repeatFrequency: Number, // 1 = every week, 2 = every other week, ...

});