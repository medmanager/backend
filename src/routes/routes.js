import { addNewMedication, getMedications, 
    getMedicationFromID, updateMedicationFromID, deleteMedicationFromID,
    fuzzySearchWithString, getOccurrences, addOccurrence, getDosages} from '../controllers/controller'
import {login, register, loginRequired, verify} from '../controllers/userControllers'


const routes = (app) => {

app.route('/medication')
   .get(loginRequired, getMedications)
   .post(loginRequired, addNewMedication)

app.route('/medication/:medicationID')
   //get a specific medication from ID
   .get(loginRequired, getMedicationFromID)
   .put(loginRequired, updateMedicationFromID)
   .delete(loginRequired, deleteMedicationFromID);

app.route('/dosage')
   .get(loginRequired, getDosages);

app.route('/schedule/occurrences')
   .get(loginRequired, getOccurrences)
   .post(loginRequired, addOccurrence);

app.route('/auth/register')
   .post(register);

app.route('/auth/verify/:token')
   .get(verify)

app.route('/login')
   .post(login);

app.route('/medication/search/:searchStr')
   //currently we do not check for login
   //because search doesn't access a user's data
   .get(fuzzySearchWithString);
};

export default routes;