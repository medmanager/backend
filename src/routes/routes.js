import {
    addNewMedication,
    addOccurrence,
    deleteMedicationFromID,
    fuzzySearchWithString,
    getDosages,
    getMedicationFromID,
    getMedications,
    getOccurrenceFromID,
    getOccurrences,
    registerDeviceKey,
    updateMedicationFromID,
    getTrackingInfo,
} from "../controllers/controller";
import {
    login,
    loginRequired,
    register,
    verify,
    updateUserSettings,
    updateUser
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

    app.route("/occurrence/:occurrenceId").get(
        loginRequired,
        getOccurrenceFromID
    );

    app.route("/schedule/occurrences")
        .get(loginRequired, getOccurrences)
        .post(loginRequired, addOccurrence);

    app.route("/tracking").get(loginRequired, getTrackingInfo);

    app.route("/auth/register").post(register);

    app.route("/auth/verify/:token").get(verify);

    app.route("/login").post(login);

    //login required to logout ?????
    //  app.route("/logout").post(loginRequired, logout);

    app.route("/register/notifications").post(loginRequired, registerDeviceKey);

    app.route("/user/updatesettings").post(loginRequired, updateUserSettings);

    app.route("/user/update").post(loginRequired, updateUser);

    app.route("/medication/search/:searchStr")
        //currently we do not check for login
        //because search doesn't access a user's data
        .get(fuzzySearchWithString);
};

export default routes;
