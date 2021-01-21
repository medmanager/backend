import express from 'express';
import routes from './src/routes/routes';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

const app = express();
const PORT = 4000; //to run local

// mongoose connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/MedManagerdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// bodyparser setup
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

routes(app);

app.listen(PORT, () => {
    //confirm server is running properly
    console.log(`server is running on port ${PORT}`);
});