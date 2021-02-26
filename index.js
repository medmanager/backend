import express from 'express';
import routes from './src/routes/Routes';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import jsonwebtoken from 'jsonwebtoken';
import AllJobs from './src/server/AllJobs';

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
            req.user = decode._id;
            next();
        });
    } else {
        req.user = undefined;
        next();
    }
});

//when server reloads we must schedule all of the jobs for our 
// let allJobs = new AllJobs();
// allJobs.initJobs();

routes(app);

app.listen(PORT, () => {
    //confirm server is running properly
    console.log(`server is running on port ${PORT}`);
});