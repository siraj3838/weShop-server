const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;




app.use(cors({
    origin: [
        'http://localhost:5173'
        // 'https://libary-manage.web.app',
        // 'https://libary-manage.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hq29e8f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

//  middle ware 
const logger = (req, res, next) => {
    console.log('log info:', req.method, req.url);
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ massage: 'unauthorized access' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ massage: 'unauthorized access' });
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect()
        const productCollection = client.db('weShopDB').collection('product');
        const userCollection = client.db('weShopDB').collection('user');
        const reviewCollection = client.db('weShopDB').collection('review');


        // jwt related
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        })

        // User Collection
        app.post('/users', async (req, res) => {
            const user = req.body;
            // unique one email one time
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        app.get('/users', logger, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // Product Collection
        app.post('/products', logger, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })
        app.get('/products', logger, async (req, res) => {
            const result = await productCollection.find().toArray();
            res.send(result);
        })

        // Product Collection
        app.post('/reviews', logger, async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })
        app.get('/reviews', logger, async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('weShop Server Running');
})
app.listen(port, () => {
    console.log(`weShop Running From ${port}`);
})
