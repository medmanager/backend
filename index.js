import express from 'express';
import routes from './src/routes/Routes';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import jsonwebtoken from 'jsonwebtoken';
import * as cron from 'node-cron';
import { medicationCheck } from './src/controllers/cronController';

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

// JWT setup
app.use((req, res, next) => {
    if (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'JWT') {
        jsonwebtoken.verify(req.headers.authorization.split(' ')[1], 'ATLBANANA', (err, decode) => {
            // console.log(decode);
            if (err) req.user = undefined;
            req.user = decode;
            next();
        });
    } else {
        req.user = undefined;
        next();
    }
});

// automatically calls medicationCheck() at midnight every day
let task = cron.schedule("0 0 * * *", () => {
    medicationCheck();
});

// can use the task object to destroy task at a later time

routes(app);

app.listen(PORT, () => {
    //confirm server is running properly
    console.log(`server is running on port ${PORT}`);
});