import {
    addNewMedication,
    deleteMedicationFromID,
    fuzzySearchWithString,
    getDosages,
    getMedicationFromID,
    getMedications,
    getOccurrenceFromID,
    getOccurrenceGroupFromID,
    getOccurrences,
    getTrackingInfo,
    registerDeviceKey,
    takeDosageOccurrence,
    updateMedicationFromID,
} from "../controllers/controller";
import {
    login,
    loginRequired,
    register,
    verify,
} from "../controllers/userControllers";

const routes = (app) => {
    app.route("/medication")
        .get(loginRequired, getMedications)
        .post(loginRequired, addNewMedication);

    app.route("/medication/:medicationID")
        //get a specific medication from ID
        .get(loginRequired, getMedicationFromID)
        .put(loginRequired, updateMedicationFromID)
        .delete(loginRequired, deleteMedicationFromID);

    app.route("/dosage").get(loginRequired, getDosages);

    app.route("/schedule/occurrence/:occurrenceId")
        .get(loginRequired, getOccurrenceFromID)
        .post(loginRequired, takeDosageOccurrence);

    app.route("/schedule/occurrences").get(loginRequired, getOccurrences);

    app.route("/schedule/occurrenceGroup/:occurrenceGroupId").get(
        loginRequired,
        getOccurrenceGroupFromID
    );

    app.route("/tracking").get(loginRequired, getTrackingInfo);

    app.route("/auth/register").post(register);

    app.route("/auth/verify/:token").get(verify);

    app.route("/auth/login").post(login);

    //login required to logout ?????
    //  app.route("/logout").post(loginRequired, logout);

    app.route("/register/notifications").post(loginRequired, registerDeviceKey);

    app.route("/medication/search/:searchStr")
        //currently we do not check for login
        //because search doesn't access a user's data
        .get(fuzzySearchWithString);
};

export default routes;
