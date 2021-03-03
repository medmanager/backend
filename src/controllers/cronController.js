import _ from 'lodash';
import { getScheduledDays, getUser} from './controller';
import schedule from 'node-schedule';

/** 
 * When a new medication is added, schedule new jobs for the week
 * and store array of occurrences
 * ASSUME OTHER MEDS HAVE ALREADY BEEN SCHEDULED
 */
export const scheduleNewMedication = async (user, medication) => {
    let occurrences = getScheduledDays(user);
    occurrences.forEach(day => {
        day.forEach(med => {
            user.medications.forEach(uMed => {
                if (med.medicationId == medication._id == uMed._id) {
                    //found new med to schedule
                    med.datesWTime.forEach(dose => {
                        uMed.dosages.forEach(uDose => {
                            let now = new Date();
                            console.log(dose);
                            if (dose.dosageId == uDose._id && now.getTime() < dose.date.getTime()) {
                                //create occurrence
                                let occurrence = {
                                    isTaken: false,
                                    isComplete: false,
                                    timeTaken: null,
                                    scheduledDate: dose.date,
                                };
                                uDose.occurrences.push(occurrence);
                            }
                        });
                    });
                }
            });
     
        })
    });
    //SAVING USER WILL AUTO GENERATE OCCURRENCE ID'S FOR US TO USE
    try {
        user = await user.save();
    } catch (err) {
        //not quite sure what to do when user fails to save
        console.log("user cannot be saved");
        return {error: true};
    }
    user.medications.forEach(med => {
        //find new med
        if (medication._id == med._id) {
            med.dosages.forEach(dosage => {
                dosage.occurrences.forEach(occurrence => {
                    //only schedule a job for the dose if reminders are toggled
                    if (dosage.sendReminder) {
                        schedule.scheduleJob(occurrence._id.toString(), occurrence.scheduledDate, function() {
                            sendNotification();
                        });
                    }
                });
            });
        }
    });
    return {error: false};
};

/**
 * function to schedule weekly dosage occurrences for the week
 * Must create an occurrence entry array for each dosage
 */
export const scheduleWeeklyOccurrences = async (userId) => {
    let user = await getUser(userId);
    user = removePastOccurrences(user);
    let occurrences = getScheduledDays(user);
    occurrences.forEach(day => {
        day.forEach(med => {
            user.medications.forEach(uMed => {
                if (med.medicationId == uMed._id) {
                    //we found the right med
                    med.datesWTime.forEach(dose => {
                        uMed.dosages.forEach(uDose => {
                            //ensure we find the right dose and that the occurrence hasn't already passed
                            let now = new Date();
                            if (dose.dosageId == uDose._id && now.getTime() < dose.date.getTime()) {
                                //we found the right dose
                                //create new occurrence to add
                                let occurrence = {
                                    isTaken: false,
                                    isComplete: false,
                                    timeTaken: null,
                                    scheduledDate: dose.date,
                                    //make id length of occurrences
                                };
                                uDose.occurrences.push(occurrence);
                            }
                        });
                    });
                }
            });
        });
    });
    //SAVING USER WILL AUTO GENERATE OCCURRENCE ID'S FOR US TO USE
    try {
        user = await user.save();
    } catch (err) {
        //not quite sure what to do when user fails to save
        console.log("user cannot be saved");
        return {error: true, message: err};
    }
    user.medications.forEach(med => {
        med.dosages.forEach(dosage => {
            dosage.occurrences.forEach(occurrence => {
                //only schedule a job for the dose if reminders are toggled
                if (dosage.sendReminder) {
                    schedule.scheduleJob(occurrence._id.toString(), occurrence.scheduledDate, function() {
                        sendNotification();
                    });
                }
            });
        });
    });
    return {error: false};
};

/**
 * Helper function for scheduleWeeklyOccurrences that removes
 * all past occurrences before scheduling the ones for this week.
 * This is to ensure we don't over populate the occurrences
 */
const removePastOccurrences = (user) => {
    user.medications.forEach(med => {
        med.dosages.forEach(dosage => {
            dosage.occurrences = [];
        });
    });
    return user;
};

export const sendNotification = () => {
    console.log('take your medication');
}