import { addNewMedication, getMedications, 
    getMedicationFromID, updateMedicationFromID, deleteMedicationFromID,
    fuzzySearchWithString, deleteMedications, getOccurrences, addOccurrence, getDosages} from '../controllers/controller'
import {login, register, loginRequired, verify} from '../controllers/userControllers'


const routes = (app) => {

app.route('/medication')
   .get(loginRequired, getMedications)
   .post(loginRequired, addNewMedication)
   .delete(loginRequired, deleteMedicationFromID);

app.route('/medication/:medicationID')
   .delete(loginRequired, deleteMedicationFromID);

app.route('/medication/:medicationID')
   //get a specific medication from ID
   .get(loginRequired, getMedicationFromID)
   .put(loginRequired, updateMedicationFromID);

app.route('/dosage')
   .get(loginRequired, getDosages);

app.route('/schedule/occurrences')
   .get(loginRequired, getOccurrences)
   .post(loginRequired, addOccurrence);

app.route('/auth/register')
   .post(register);
   //register route

app.route('/auth/verify/:token')
   .get(verify)

app.route('/login')
   .post(login);
   //login route

app.route('/medication/search/:searchStr')
   //currently we do not check for login
   //because search doesn't access a user's data
   .get(fuzzySearchWithString);

   // MADE FOR DEBUGGING PURPOSES
app.route('/deleteAll')
   .delete(deleteMedications);
};

export default routes;