import { addNewMedication } from '../controllers/controller'

const routes = (app) => {
    app.route('/medication')
        .post(addNewMedication);
};

export default routes;