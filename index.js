const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
colors = require('colors');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;

//middle were
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.me4a0fb.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
            res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        await client.connect()
        console.log('db connect'.yellow);

    } catch (error) {
        console.log(error.name.bgRed, error.message.bold.italic)
    }
}
run()

const appointmentCollection = client.db('dbDantist').collection('appointmentOptions');
const bookingCollection = client.db('dbDantist').collection('bookings');
const usersCollection = client.db('dbDantist').collection('users');
const doctorCollection = client.db('dbDantist').collection('doctors');

// verify admin middle were
const adminVerify = async (req, res, next) => {
    console.log('inside admin verify', req.decoded.email);
    const decodedEmail = req.decoded.email;
    const query = { email: decodedEmail };
    const user = await usersCollection.findOne(query);

    if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next()
}

//endpoint
//get all data in appointmentOption
app.get('/appointmentOption', async (req, res) => {
    try {
        const query = {};
        const date = req.query.date;
        const options = await appointmentCollection.find(query).toArray();
        const bookingQuery = { appointmentDate: date };
        const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
        // console.log(alreadyBooked);
        options.forEach(option => {
            const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
            const bookSlots = optionBooked.map(book => book.slot);
            const remainingSlots = option.slots.filter(slot => !bookSlots.includes(slot));
            option.slots = remainingSlots;
            // console.log(date, option.name, remainingSlots.length);

        })
        res.send(options)


    } catch (error) {
        console.error(error.name.bgRed, error.message.italic);
    }
})

// add a doctor api end point
app.post('/addDoctor', verifyJWT, adminVerify, async (req, res) => {
    try {
        const addDoctor = req.body;
        const doctor = await doctorCollection.insertOne(addDoctor);
        res.send(doctor)
    } catch (error) {

        console.error(error.name.bgRed, error.message.italic)
    }
})

// get all doctors
app.get('/doctors', verifyJWT, adminVerify, async (req, res) => {
    try {
        const query = {};
        const doctors = await doctorCollection.find(query).toArray()
        res.send(doctors)
    } catch (error) {
        console.error(error.name.bgRed, error.message.italic);
    }
})

// // delete doctor with id 
app.delete('/doctors/:id', verifyJWT, adminVerify, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const doctor = await doctorCollection.deleteOne(query);
        res.send(doctor)
    } catch (error) {
        console.error(error.name.bgRed, error.message.italic)
    }
})

// get appointment specialty for add a doctor
app.get('/appointmentSpecial', async (req, res) => {
    try {
        const query = {};
        const result = await appointmentCollection.find(query).project({ name: 1 }).toArray();
        res.send(result)
    } catch (error) {
        console.log(error.name.bgRed, error.message.italic);
    }
})

// get data with email
app.get('/bookings', verifyJWT, async (req, res) => {
    const email = req.query.email;
    // console.log(req.headers.authorization);
    const decodedEmail = req.decoded.email;
    if (decodedEmail !== email) {
        return res.status(403).send({ message: 'forbidden access' })
    }
    const query = { email: email };
    const bookings = await bookingCollection.find(query).toArray();
    res.send(bookings);
})

// booking data with post method
app.post('/bookings', async (req, res) => {
    try {
        const booking = req.body;
        // console.log(booking);
        const query = {
            appointmentDate: booking.appointmentDate,
            email: booking.email,
            treatment: booking.treatment,

        }

        const alreadyBooked = await bookingCollection.find(query).toArray();

        if (alreadyBooked.length) {
            const message = `you have already booked on  ${booking.appointmentDate}`
            return res.send({ acknowledge: false, message })
        }
        const result = await bookingCollection.insertOne(booking);
        res.send(result)

    } catch (error) {
        res.send({
            success: false,
            message: 'could not get data',
            error: error.name,
        })
    }
})

// get all users api end point
app.get('/users', async (req, res) => {
    try {
        const query = {};
        const users = await usersCollection.find(query).toArray();
        res.send(users);
    } catch (error) {
        console.error(error.name, error.message,)
    }
})

// save user with post method
app.post('/users', async (req, res) => {
    const user = req.body;
    console.log(user);
    const result = await usersCollection.insertOne(user);
    res.send(result)
})


// jwt token system
app.get('/jwt', async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);

    if (user) {
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.send({ accessToken: token })
    }
    res.status(403).send({ accessToken: '' })
    // console.log(result);
    // res.send({ token: 'get token' })
})

// is admin ? cheque api
app.get('/users/admin/:email', async (req, res) => {
    try {

        const email = req.params.email;
        const query = { email };
        const user = await usersCollection.findOne(query);
        res.send({ isAdmin: user?.role === 'admin' })
    } catch (error) {
        console.error(error.name.bgRed, error.message.italic)
    }
})

//make admin with put method
app.put('/users/admin/:id', verifyJWT, adminVerify, async (req, res) => {
    try {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
            $set: {
                role: 'admin'
            }
        }
        const result = await usersCollection.updateOne(filter, updateDoc, options);
        res.send(result)
    } catch (error) {
        console.error(error.name, error.message);
    }
})



app.get('/', (req, res) => {
    res.send('i am subha doctors father');
})

app.listen(port, () => console.log(`port is running on ${port}`))