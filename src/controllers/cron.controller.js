import apn from "apn";
import firebase from "firebase-admin";
import mongoose from "mongoose";
import schedule from "node-schedule";
import path from "path";
import { Platform } from "../constants";
import OccurrenceGroup from "../models/OccurrenceGroup";
import User from "../models/User";

/**
 * Helper function that schedules all the occurrence groups (that are scheduled in the future) in the db
 */
export const scheduleAllOccurrenceGroups = async () => {
    let groupsToSchedule = await OccurrenceGroup.find({
        scheduledDate: {
            $gte: new Date(),
        },
    }).exec();
    for (let group of groupsToSchedule) {
        // schedule notification jobs for the week
        schedule.scheduleJob(group._id.toString(), group.scheduledDate, () => {
            sendDosageNotification(group._id);
        });
    }
};

/**
 * Sends a dosage reminder push notification to the users device using APN for iOS and Firebase for Android.
 * Relevant documentation:
 * - https://docs.expo.io/push-notifications/sending-notifications-custom/ - For information on sending push notifications in general
 * - https://github.com/node-apn/node-apn - For sending apple push notifications
 * - https://firebase.google.com/docs/cloud-messaging/send-message - For sending android push notifications
 * @param {String} occurrenceGroupId Occurrence group identifier
 */
export const sendDosageNotification = async (occurrenceGroupId) => {
    let occurrenceGroup = await OccurrenceGroup.findById(
        occurrenceGroupId
    ).populate({
        path: "occurrences",
        model: "Occurrence",
        populate: {
            path: "dosage",
            model: "Dosage",
            populate: { path: "medication", model: "Medication" },
        },
    });

    if (!occurrenceGroup) {
        console.error(
            "Occurrence group not found. Unable to send notification."
        );
        return;
    }

    let user = await User.findById(occurrenceGroup.user);
    //check that at least one of the occurrences belongs to a dosage that has sendReminder as true
    let shouldSendNotification = false;
    for (let occurrence of occurrenceGroup.occurrences) {
        if (occurrence.dosage.sendReminder) {
            shouldSendNotification = true;
            break;
        }
    }

    //if the user has emergency contacts on,
    //create an emergency contact job and schedule it
    //we need an ID for the emergency contact job to differentiate
    //the emergency contact job from the occurrenceGroup job
    //NOTE: this code hasn't been tested
    if (user.settings.hasCaregiverContact) {
        console.log("we have caregiver contact");
        let emergencyJobId = mongoose.Types.ObjectId();
        occurrenceGroup.emergencyJobId = emergencyJobId;
        let dateToFire = new Date();
        let waitingTime = 1000 * 60;
        dateToFire = new Date(dateToFire.getTime() + waitingTime);
        schedule.scheduleJob(emergencyJobId.toString(), dateToFire, () => {
            sendEmergencyContactAlert(occurrenceGroup._id);
        });
    }

    //if we shouldn't send notification, delete occurrenceGroup and return
    //only delete if the user doesn't have emergency contacts enabled
    if (
        (!shouldSendNotification ||
            user.settings.notificationSettings.silenceAll) &&
        !user.settings.hasCaregiverContact
    ) {
        OccurrenceGroup.deleteOne({ _id: occurrenceGroup._id });
        return;
        //if the user still has emergency contacts enabled we don't want to delete occurrence group
    } else if (
        !shouldSendNotification ||
        user.settings.notificationSettings.silenceAll
    ) {
        return;
    }

    await occurrenceGroup.save();

    let alertMessage;
    if (user.settings.notificationSettings.hideMedName) {
        alertMessage =
            "It's time to take your medications. Open the MedManager app to see more.";
    } else {
        alertMessage = "It's time to take ";
        for (let i = 0; i < occurrenceGroup.occurrences.length; i++) {
            alertMessage +=
                occurrenceGroup.occurrences[i].dosage.dose +
                " " +
                occurrenceGroup.occurrences[i].dosage.medication.amountUnit +
                " of " +
                occurrenceGroup.occurrences[i].dosage.medication.name +
                " (" +
                occurrenceGroup.occurrences[i].dosage.medication.strength +
                " " +
                occurrenceGroup.occurrences[i].dosage.medication.strengthUnit +
                ")";

            //include comma at the end of this if it's not the end
            if (occurrenceGroup.occurrences.length == 2 && i == 0) {
                alertMessage += " and ";
            } else if (i == occurrenceGroup.occurrences.length - 2) {
                alertMessage += ", and ";
            } else if (
                occurrenceGroup.occurrences.length > 1 &&
                i != occurrenceGroup.occurrences.length - 1
            ) {
                alertMessage += ", ";
            }
        }
    }

    if (user.deviceInfo.os === Platform.iOS) {
        //ios logic
        const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID; // obtained from Apple developer account
        const APPLE_KEY_ID = process.env.APPLE_KEY_ID; // obtained from Apple developer account
        const options = {
            token: {
                key: path.resolve(
                    __dirname + "../../../MedManager_apns_key.p8" // obtained from Apple developer account
                ),
                keyId: APPLE_KEY_ID,
                teamId: APPLE_TEAM_ID,
            },
            production: false,
        };

        const apnProvider = new apn.Provider(options);
        const notification = new apn.Notification();

        notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        notification.sound = "ping.aiff";
        notification.alert = alertMessage;
        notification.payload = { occurrenceGroupId };
        notification.topic = "org.reactjs.native.example.MedManager";

        const deviceToken = user.deviceInfo.token;
        const deviceTokens = [deviceToken];
        const response = await apnProvider.send(notification, deviceTokens);
        if (response.sent.length) {
            console.log("Notification successfully sent");
        } else {
            console.log("Notification failed to send");
            console.log(options);
            for (const error of response.failed) {
                console.error(error);
            }
        }
    } else {
        /* This is the configuration file that contains the server key and account
        credentials that will allow us to send out firebase notifications. It will be 
        ignored by git (for security) */
        let serviceAccount = require("../../med-manager-3-firebase-adminsdk.json");

        // initializes firebase using the account credentials and the account database URL
        // (only initializes if this is the first notification sent out after the server starts up)

        // we have to check if the firebase app is already initialized as well because
        // firebase does not like it when you try to initialize another app
        if (firebase.apps.length === 0) {
            firebase.initializeApp({
                credential: firebase.credential.cert(serviceAccount),
                databaseURL:
                    "https://med-manager-eb6c0-default-rtdb.firebaseio.com/",
            });
        }

        // device token in order for firebase to know where to send the notification
        let registrationToken = user.deviceInfo.token;

        // Notification payload that contains notification content and the id information that the front end needs
        // to process the notification
        let payload = {
            notification: {
                title: "It's medication time!",
                body: alertMessage,
            },
            data: {
                occurrenceGroupId: occurrenceGroup._id.toString(),
            },
        };

        // options for notification
        let options = {
            priority: "high",
            timeToLive: 60 * 60 * 24,
        };

        // officially sends the notification and prints out either a confirmation or an error
        firebase
            .messaging()
            .sendToDevice(registrationToken, payload, options)
            .then(function (response) {
                console.log("sent firebase message: ", response);
            })
            .catch(function (error) {
                console.log("Error sending message: ", error);
            });
    }
};

/**
 * Function passed into emergency contact job
 * Find occurrence group and determine whether or not to send the emergency contact
 * a notification. The only case we want to send a message is when the user has
 * emergency contacts enabled (check again just incase they disabled it after this
 * job was scheduled) and the occurrence group exists and has at least one occurrence
 * on it that has not been taken by the patient.
 * @param {ObjectId} occurrenceGroupId
 */
const sendEmergencyContactAlert = async (occurrenceGroupId) => {
    let occurrenceGroup = await OccurrenceGroup.findById(
        occurrenceGroupId
    ).populate({
        path: "occurrences",
        model: "Occurrence",
        populate: {
            path: "dosage",
            model: "Dosage",
            populate: { path: "medication", model: "Medication" },
        },
    });
    //if occurrence group doesn't exist return
    if (occurrenceGroup == undefined) return;
    let user = await User.findById(occurrenceGroup.user);
    //if user doesn't exist return
    if (user == undefined) return;

    //if one of the occurrences hasn't been taken yet, we want to send a message
    let missedMeds = [];
    for (let occurrence of occurrenceGroup.occurrences) {
        if (!occurrence.isTaken) {
            missedMeds.push(occurrence);
        }
    }
    if (missedMeds.length == 0) return;

    // The dotenv library makes it so we can pull the Twilio account credentials from process environment
    // variables which are stored in a .env file that will be ignored by git. The file contains:
    //      - account SID
    //      - authentication token
    //      - phone number from which messages are sent
    // All variables were obtained from the Twilio account website www.twilio.com

    if (user.settings.hasCaregiverContact) {
        console.log("we get here!");
        const accountSID = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        let message = `Hello ${user.settings.caregiverContact.name}! Your contact, ${user.firstName} ${user.lastName}, did not take these medications: `;

        for (let i = 0; i < missedMeds.length; i++) {
            message +=
                missedMeds[i].dosage.dose +
                " " +
                missedMeds[i].dosage.medication.amountUnit +
                " of " +
                missedMeds[i].dosage.medication.name +
                " (" +
                missedMeds[i].dosage.medication.strength +
                " " +
                missedMeds[i].dosage.medication.strengthUnit +
                ")";

            //include comma at the end of this if it's not the end
            if (missedMeds.length == 2 && i == 0) {
                message += " and ";
            } else if (i == missedMeds.length - 2) {
                message += ", and ";
            } else if (missedMeds.length > 1 && i != missedMeds.length - 1) {
                message += ", ";
            }
        }

        console.log(message);
        console.log("+1" + user.settings.caregiverContact.phoneNumber);
        //initializes twilio using credentials
        const client = require("twilio")(accountSID, authToken);

        console.log(client);

        // creates message with a body, sender number, and receiver number and sends it
        client.messages
            .create({
                body: message,
                from: fromNumber,
                to: "+1" + user.settings.caregiverContact.phoneNumber,
            })
            .then((message) => console.log(message.sid))
            .catch((err) => console.error(err));
    }

    //delete occurrenceGroup (we don't need to remove the reference from each of the occurrences)
    await OccurrenceGroup.findByIdAndDelete(occurrenceGroup._id);
};
