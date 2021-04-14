import { getDosages } from "./controllers/dosage.controller";
import {
    activateMedication,
    addNewMedication,
    deactivateMedication,
    deleteMedicationFromID,
    fuzzySearchMedicationName,
    getMedicationFromID,
    getMedications,
    getMedicationTrackingInfo,
    updateMedicationFromID,
} from "./controllers/medication.controller";
import {
    getOccurrenceFromID,
    getOccurrenceGroupFromID,
    getOccurrences,
    takeDosageOccurrence,
} from "./controllers/occurrence.controller";
import {
    getCurrentUser,
    login,
    loginRequired,
    register,
    registerDeviceKey,
    updateUser,
    updateUserSettings,
    verify,
} from "./controllers/user.controller";
import { seed } from "./seed";

const routes = (app) => {
    app.route("/seedDatabase").post(seed);

    app.route("/medication")
        .get(loginRequired, getMedications)
        .post(loginRequired, addNewMedication);

    app.route("/medication/:medicationID")
        //get a specific medication from ID
        .get(loginRequired, getMedicationFromID)
        .put(loginRequired, updateMedicationFromID)
        .delete(loginRequired, deleteMedicationFromID);

    app.route("/medication/:medicationID/deactivate").get(
        loginRequired,
        deactivateMedication
    );

    app.route("/medication/:medicationID/activate").get(
        loginRequired,
        activateMedication
    );

    app.route("/dosage").get(loginRequired, getDosages);

    app.route("/schedule/occurrence/:occurrenceId")
        .get(loginRequired, getOccurrenceFromID)
        .put(loginRequired, takeDosageOccurrence);

    app.route("/schedule/occurrences").get(loginRequired, getOccurrences);

    app.route("/schedule/occurrenceGroup/:occurrenceGroupId").get(
        loginRequired,
        getOccurrenceGroupFromID
    );

    app.route("/tracking").get(loginRequired, getMedicationTrackingInfo);

    app.route("/auth/register").post(register);

    app.route("/auth/verify/:token").get(verify);

    app.route("/auth/login").post(login);

    //login required to logout ?????
    //  app.route("/logout").post(loginRequired, logout);

    app.route("/register/notifications").post(loginRequired, registerDeviceKey);

    app.route("/user/updateSettings").put(loginRequired, updateUserSettings);

    app.route("/user/update").put(loginRequired, updateUser);

    app.route("/getCurrentUser").get(loginRequired, getCurrentUser);

    app.route("/medication/search/:searchStr")
        //currently we do not check for login
        //because search doesn't access a user's data
        .get(fuzzySearchMedicationName);
};

export default routes;
